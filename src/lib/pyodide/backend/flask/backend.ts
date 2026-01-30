/**
 * Flask Backend Implementation
 *
 * Runs Python code via API rqeuests to a Flask web server
 * Supports streaming with code injection between generator steps.
 * The pyodide backend has a general handler function which handles the responses that a Web Worker provides
 * however, we directly handle data given the fact that we don't instantiate a worker and use a Flask web server
 */

import { STATUS_MESSAGES } from "$lib/constants/messages";
import { TIMEOUTS } from "$lib/constants/python";
import { getFlaskBackendUrl } from "$lib/utils/flaskRoutes";
import { backendState } from "../state";
import type {
	Backend,
	BackendState,
	REPLErrorResponse,
	REPLResponse,
} from "../types";

interface PendingRequest {
	resolve: (value: string | undefined) => void;
	reject: (error: Error) => void;
	timeoutId: ReturnType<typeof setTimeout>;
}

interface StreamState {
	id: string | null;
	onData: ((data: unknown) => void) | null;
	onDone: (() => void) | null;
	onError: ((error: Error) => void) | null;
}

interface BackendRequest {
	type:
		| "exec"
		| "eval"
		| "evaluate"
		| "stream-start"
		| "stream-exec"
		| "stream-stop";
	id?: string;
	code?: null | string;
	expr?: null | string;
}

export class FlaskBackend implements Backend {
	streamingCodeQueue: string[] = [];
	streamingActive: boolean = false;

	private streamState: StreamState = {
		id: null,
		onData: null,
		onDone: null,
		onError: null,
	};
	private pendingRequests = new Map<string, PendingRequest>();
	private messageId = 0;
	private isInitializing = false

	// Output callbacks
	private stdoutCallback: ((value: string) => void) | null = null;
	private stderrCallback: ((value: string) => void) | null = null;

	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	async init(): Promise<void> {
		const state = this.getState();
		if (state.initialized || state.loading) return;
		
		let id = this.generateId()

		this.isInitializing = true

		let data:any = await fetch(getFlaskBackendUrl()+"/initialize").then(res => res.json())

		if(data.success) {
			this.handleResponse({
				type: "stdout",
				value: "Your backend preference has been set to a Flask web server, initialization has already occured",
			});

			this.handleResponse({ type: "ready" });
		} else {
			let error = data.error
			this.handleError({
				type: "error",
				error: error
			})
			this.isInitializing = false
			backendState.update((s) => ({
				...s,
				loading: false,
				error: error instanceof Error ? error.message : String(error)
			}));
			throw error;
		}
	}

	terminate(): void {}

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	getState(): BackendState {
		return backendState.get();
	}

	subscribe(callback: (state: BackendState) => void): () => void {
		return backendState.subscribe(callback);
	}

	isReady(): boolean {
		return this.getState().initialized;
	}

	isLoading(): boolean {
		return this.getState().loading;
	}

	getError(): string | null {
		return this.getState().error;
	}

	// -------------------------------------------------------------------------
	// Execution
	// -------------------------------------------------------------------------

	async exec(
		code: string,
		timeout: number = TIMEOUTS.SIMULATION,
	): Promise<void> {
		const id = this.generateId();

		return new Promise<void>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error("Execution timeout"));
				}
			}, timeout);

			this.pendingRequests.set(id, {
				resolve: () => resolve(),
				reject,
				timeoutId,
			});

			this.handleRequest({ type: "exec", id, code });
		});
	}

	async evaluate<T = unknown>(
		expr: string,
		timeout: number = TIMEOUTS.SIMULATION,
	): Promise<T> {
		const id = this.generateId();

		return new Promise<T>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error("Evaluation timeout"));
				}
			}, timeout);

			this.pendingRequests.set(id, {
				resolve: (value) => {
					if (value === undefined) {
						reject(new Error("No value returned from eval"));
						return;
					}
					try {
						resolve(JSON.parse(value) as T);
					} catch {
						reject(
							new Error(`Failed to parse eval result: ${value}`),
						);
					}
				},
				reject,
				timeoutId,
			});

			this.handleRequest({ type: "eval", id, expr });
		});
	}

	// -------------------------------------------------------------------------
	// Streaming
	// -------------------------------------------------------------------------

	startStreaming<T>(
		expr: string,
		onData: (data: T) => void,
		onDone: () => void,
		onError: (error: Error) => void,
	): void {
		if (!this.isReady()) {
			onError(new Error("Backend not initialized"));
			return;
		}

		// Stop any existing stream
		if (this.streamState.id) {
			this.stopStreaming();
		}

		const id = this.generateId();
		this.streamState = {
			id,
			onData: onData as (data: unknown) => void,
			onDone,
			onError,
		};

		this.handleRequest({ type: "stream-start", id, expr });
	}

	stopStreaming(): void {
		if (!this.streamState.id) return;

		this.handleRequest({ type: "stream-stop" });
	}

	execDuringStreaming(code: string): void {
		if (!this.streamState.id) {
			console.warn("Cannot exec during streaming: no active stream");
			return;
		}
		this.handleRequest({ type: "stream-exec", code });
	}

	isStreaming(): boolean {
		return this.streamState.id != null;
	}

	private async runStreamingLoop(id: string, expr: string): Promise<void> {
		try {
			this.streamingActive = true;

			this.streamingCodeQueue.length = 0;

			// Unlike the Pyodide version, we only need a while loop to go through commands that are queued up,
			// It isn't necessary that we maintain a while loop while streaming as we are reading it with the fetch API

			while (this.streamingCodeQueue.length > 0) {
				const code = this.streamingCodeQueue.shift()!;
				try {
					// Simply sending requests to the Flask api to execute code,
					// we only really care if errors are produced so we don't handle any data response.
					// There is also no need for streaming data here....

					let data = await fetch(
						getFlaskBackendUrl() + "/execute-code",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({ code: code }),
						},
					).then((res) => res.json());
					if (data.success && data.output) {
						this.handleResponse({
							type: "stdout",
							value: data.output,
						});
					} else {
						throw Error(data.error);
					}
				} catch (error) {
					const errorMsg =
						error instanceof Error ? error.message : String(error);
					this.handleResponse({
						type: "stderr",
						value: `Stream exec error: ${errorMsg}`,
					});
				}
			}

			let response = await fetch(getFlaskBackendUrl() + "/streamData");

			if (response.body) {
				for await (const chunk of response.body) {
					let resArray: string[] = [];

					const decoder = new TextDecoder("utf-8");
					let jsonString = decoder.decode(chunk);

					const responseSubstr = "success";

					/* Sometimes within the same chunk I'll receive more than one API response
					 * such that it appears liked jsonString = "{"success":...,"data":...}{"success":...,"data":...}"
					 * so we need to take the time to break it up into its individual requests
					 * */

					let doneBreakingUp = false;

					while (
						jsonString.indexOf(responseSubstr) &&
						!doneBreakingUp
					) {
						let firstIndex = jsonString.indexOf(responseSubstr);

						let remainingString = jsonString.slice(
							firstIndex + responseSubstr.length,
							jsonString.length,
						);
						let secondIndex =
							remainingString.indexOf(responseSubstr);

						if (secondIndex == -1 || firstIndex == -1) {
							resArray.push(jsonString);
							doneBreakingUp = true;
						} else {
							let request = jsonString.slice(
								firstIndex - 2,
								firstIndex +
									responseSubstr.length +
									secondIndex -
									2,
							);
							resArray.push(request);
							jsonString = jsonString.slice(
								firstIndex +
									responseSubstr.length +
									secondIndex -
									2,
								jsonString.length,
							);
						}
					}

					let dataChunks = resArray.flatMap((res) => {
						let parsedResponse = JSON.parse(res);
						if (
							parsedResponse.success &&
							!parsedResponse.result.done &&
							parsedResponse.result.result
						) {
							return parsedResponse;
						} else {
							return [];
						}
					});

					for (let dataChunk of dataChunks) {
						console.log("Streaming data: ", dataChunk.result)
						this.handleResponse({
							type: "stream-data",
							id,
							value: JSON.stringify(dataChunk.result) as string,
						});
					}
				}
			}
		} catch (error) {
			return this.runTracebackWithFlask(id, error);
		} finally {
			this.streamingActive = false;
			this.handleResponse({ type: "stream-done", id });
		}
	}

	// -------------------------------------------------------------------------
	// Output Callbacks
	// -------------------------------------------------------------------------

	onStdout(callback: (value: string) => void): void {
		this.stdoutCallback = callback;
	}

	onStderr(callback: (value: string) => void): void {
		this.stderrCallback = callback;
	}

	// -------------------------------------------------------------------------
	// Private Functions
	// -------------------------------------------------------------------------
	private handleError(response: REPLErrorResponse): void {
		const { id, error, traceback } = response;
		const errorMsg = traceback
			? `${error}\n${traceback}`
			: error || "Unknown error";

		// Handle pending request errors
		if (id && this.pendingRequests.has(id)) {
			const pending = this.pendingRequests.get(id)!;
			clearTimeout(pending.timeoutId);
			pending.reject(new Error(errorMsg));
			this.pendingRequests.delete(id);
		}

		// Handle streaming errors
		if (id === this.streamState.id && this.streamState.onError) {
			this.streamState.onError(new Error(errorMsg));
			this.streamState = {
				id: null,
				onData: null,
				onDone: null,
				onError: null,
			};
		}

		backendState.update((s) => ({ ...s, error: error || "Unknown error" }));
	}

	private async runTracebackWithFlask(
		id: string,
		error: unknown,
	): Promise<void> {
		const errorMsg = error instanceof Error ? error.message : String(error);
		let traceback: string | undefined;

		try {
			traceback = (
				await fetch(getFlaskBackendUrl() + "/traceback")
					.then((res) => res.json())
					.then((res) => res.json)
			).traceback as string;
		} catch (error) {
			// Ignore as in the Pyodide framework
		}

		this.handleResponse({ type: "error", id, error: errorMsg, traceback });
	}

	private handleResponse(response: REPLResponse): void {
		switch (response.type) {
			case "ready":
				backendState.update((s) => ({
					...s,
					initialized: true,
					loading: false,
					progress: STATUS_MESSAGES.READY,
				}));
				this.isInitializing = false
				break;

			case "progress":
				backendState.update((s) => ({
					...s,
					progress: response.value || "",
				}));
				break;

			case "ok":
				if (response.id && this.pendingRequests.has(response.id)) {
					const pending = this.pendingRequests.get(response.id)!;
					clearTimeout(pending.timeoutId);
					pending.resolve(undefined);
					this.pendingRequests.delete(response.id);
				}
				break;

			case "value":
				if (response.id && this.pendingRequests.has(response.id)) {
					const pending = this.pendingRequests.get(response.id)!;
					clearTimeout(pending.timeoutId);
					pending.resolve(response.value);
					this.pendingRequests.delete(response.id);
				}
				break;

			case "error":
				this.handleError(response);
				break;

			case "stdout":
				if (response.value && this.stdoutCallback) {
					this.stdoutCallback(response.value);
				}
				break;

			case "stderr":
				if (response.value && this.stderrCallback) {
					this.stderrCallback(response.value);
				}
				break;

			case "stream-data":
				if (
					response.id === this.streamState.id &&
					this.streamState.onData &&
					response.value
				) {
					try {
						this.streamState.onData(JSON.parse(response.value));
					} catch {
						// Ignore parse errors
					}
				}
				break;

			case "stream-done":
				if (
					response.id === this.streamState.id &&
					this.streamState.onDone
				) {
					this.streamState.onDone();
					this.streamState = {
						id: null,
						onData: null,
						onDone: null,
						onError: null,
					};
				}
				break;
		}
	}

	private generateId(): string {
		return `flask_repl_${++this.messageId}`;
	}

	private async handleRequest(request: BackendRequest) {
		let { type, id, code, expr } = request;
		id = "id" in request ? (request.id as string) : "";

		switch (type) {
			case "exec":
				try {
					let data = await fetch(
						getFlaskBackendUrl() + "/execute-code",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({ namespace: localStorage.getItem("namespace"), code: code }),
						},
					).then((res) => res.json());
					if (data.success && !data.error) {
						localStorage.setItem("namespace", data.namespace)
						console.log("The data given from /execute-code", data)
						if (data.output) {
							this.handleResponse({
								type: "stdout",
								value: data.output,
							});
						}
						this.handleResponse({ type: "ok", id });
					} else {
						throw Error(data.error);
					}
				} catch (error) {
					// This traceback may actually be unnecessary in all Flaskc ases,
					// unless there is someway that the error output doesn't fully capture all the relevant information
					return this.runTracebackWithFlask(id, error);
				}
				break;

			case "eval":
				try {
					let data = await fetch(
						getFlaskBackendUrl() + "/evaluate-expression",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({ expr: expr }),
						},
					).then((res) => res.json());
					if (data.success && !data.error) {
						if (data.output) {
							this.handleResponse({
								type: "stdout",
								value: data.output,
							});
						}
						this.handleResponse({
							type: "value",
							id,
							value: JSON.stringify(data.result) as string,
						});
					} else {
						throw Error(data.error);
					}
				} catch (error) {
					return this.runTracebackWithFlask(id, error);
				}
				break;

			case "stream-start":
				if (!id || typeof expr !== "string") {
					throw new Error(
						"Invalid stream-start request: missing id or expr",
					);
				}
				// Don't await - let it run autonomously
				this.runStreamingLoop(id, expr);
				break;

			case "stream-exec":
				if (typeof code === "string" && this.isStreaming()) {
					// Queue code to be executed between generator steps
					this.streamingCodeQueue.push(code);
				}
				break;

			case "stream-stop":
				this.streamingActive = false;
				break;
			default:
				throw new Error(`Unknown message type: ${type}`);
		}
	}
}
