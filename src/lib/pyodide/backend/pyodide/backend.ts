/**
 * Pyodide Backend
 * Implements the Backend interface using Pyodide in a Web Worker
 */

import { get } from 'svelte/store';
import type { Backend, BackendState, REPLRequest, REPLResponse, REPLErrorResponse } from '../types';
import { backendState } from '../state';
import { TIMEOUTS } from '$lib/constants/python';
import { PROGRESS_MESSAGES, STATUS_MESSAGES } from '$lib/constants/messages';
import type { BackendPreference } from '$lib/types';

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

/**
 * Pyodide Backend Implementation
 *
 * Runs Python code via Pyodide in a Web Worker.
 * Supports streaming with code injection between generator steps.
 */
export class PyodideBackend implements Backend {
	private worker: Worker | null = null;
	private messageId = 0;
	private pendingRequests = new Map<string, PendingRequest>();
	private isInitializing = false;
	private backendPreference : null | BackendPreference = "pyodide";

	private streamState: StreamState = {
		id: null,
		onData: null,
		onDone: null,
		onError: null
	};

	// Output callbacks
	private stdoutCallback: ((value: string) => void) | null = null;
	private stderrCallback: ((value: string) => void) | null = null;

	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	async init(): Promise<void> {
		const state = this.getState();

		// Already initialized or loading - nothing to do
		if (this.worker && (state.initialized || state.loading)) {
			return;
		}

		// Terminate existing worker if it exists (e.g., after error)
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}

		backendState.update((s) => ({
			...s,
			loading: true,
			error: null,
			progress: PROGRESS_MESSAGES.STARTING_WORKER
		}));
		this.isInitializing = true;

		try {
			console.log("(backend.ts, init) The backend preference is: ", this.backendPreference)
			this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

			this.worker.onmessage = (event: MessageEvent<REPLResponse>) => {
				this.handleResponse(event.data);
			};

			console.log("The worker is: ", this.worker)

			this.worker.onerror = (event) => {
				backendState.update((s) => ({
					...s,
					loading: false,
					error: event.message || 'Worker error'
				}));
			};

			// Send init message
			this.sendRequest({ type: 'init', backendPreference: this.backendPreference });

			// Wait for ready
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error('Initialization timeout')),
					TIMEOUTS.INIT
				);

				const unsubscribe = backendState.subscribe((state) => {
					if (state.initialized) {
						clearTimeout(timeout);
						unsubscribe();
						resolve();
					}
					if (state.error) {
						clearTimeout(timeout);
						unsubscribe();
						reject(new Error(state.error));
					}
				});
			});
		} catch (error) {
			backendState.update((s) => ({
				...s,
				loading: false,
				error: error instanceof Error ? error.message : String(error)
			}));
			throw error;
		}
	}

	terminate(): void {
		// Reject all pending requests and clear their timeouts
		for (const [, request] of this.pendingRequests) {
			clearTimeout(request.timeoutId);
			request.reject(new Error('Backend terminated'));
		}
		this.pendingRequests.clear();

		// Clear stream state
		this.streamState = {
			id: null,
			onData: null,
			onDone: null,
			onError: null
		};

		// Terminate worker
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}

		// Reset state
		backendState.reset();
	}

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

	async exec(code: string, timeout: number = TIMEOUTS.SIMULATION): Promise<void> {
		if (!this.worker) {
			await this.init();
		}

		if (!this.isReady()) {
			throw new Error('Backend not initialized');
		}

		const id = this.generateId();

		return new Promise<void>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error('Execution timeout'));
				}
			}, timeout);

			this.pendingRequests.set(id, {
				resolve: () => resolve(),
				reject,
				timeoutId
			});

			this.sendRequest({ type: 'exec', id, code });
		});
	}

	async evaluate<T = unknown>(expr: string, timeout: number = TIMEOUTS.SIMULATION): Promise<T> {
		if (!this.worker) {
			await this.init();
		}

		if (!this.isReady()) {
			throw new Error('Backend not initialized');
		}

		const id = this.generateId();

		return new Promise<T>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error('Evaluation timeout'));
				}
			}, timeout);

			this.pendingRequests.set(id, {
				resolve: (value) => {
					if (value === undefined) {
						reject(new Error('No value returned from eval'));
						return;
					}
					try {
						resolve(JSON.parse(value) as T);
					} catch {
						console.log("Error in evaluating the expression:", value)
						reject(new Error(`Failed to parse eval result: ${value}`));
					}
				},
				reject,
				timeoutId
			});

			this.sendRequest({ type: 'eval', id, expr });
		});
	}

	// -------------------------------------------------------------------------
	// Streaming
	// -------------------------------------------------------------------------

	startStreaming<T>(
		expr: string,
		onData: (data: T) => void,
		onDone: () => void,
		onError: (error: Error) => void
	): void {
		if (!this.worker) {
			onError(new Error('Backend not initialized'));
			return;
		}

		if (!this.isReady()) {
			onError(new Error('Backend not initialized'));
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
			onError
		};

		this.sendRequest({ type: 'stream-start', id, expr });
	}

	stopStreaming(): void {
		if (!this.worker || !this.streamState.id) return;

		// Just send stop message - worker will send stream-done which triggers callback
		this.sendRequest({ type: 'stream-stop' });
	}

	isStreaming(): boolean {
		return this.streamState.id !== null;
	}

	execDuringStreaming(code: string): void {
		if (!this.worker || !this.streamState.id) {
			console.warn('Cannot exec during streaming: no active stream');
			return;
		}
		this.sendRequest({ type: 'stream-exec', code });
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
	// Private Methods
	// -------------------------------------------------------------------------

	private generateId(): string {
		return `repl_${++this.messageId}`;
	}

	private sendRequest(request: REPLRequest): void {
		if (!this.worker) {
			console.log(`Within sendRequest() I have an uninitialized worker!`) // Debugging console
			throw new Error('Worker not initialized');
		}
		this.worker.postMessage(request);
	}

	private handleResponse(response: REPLResponse): void {
		switch (response.type) {
			case 'ready':
				backendState.update((s) => ({
					...s,
					initialized: true,
					loading: false,
					progress: STATUS_MESSAGES.READY
				}));
				this.isInitializing = false;
				break;

			case 'progress':
				backendState.update((s) => ({ ...s, progress: response.value || '' }));
				break;

			case 'ok':
				if (response.id && this.pendingRequests.has(response.id)) {
					const pending = this.pendingRequests.get(response.id)!;
					clearTimeout(pending.timeoutId);
					pending.resolve(undefined);
					this.pendingRequests.delete(response.id);
				}
				break;

			case 'value':
				if (response.id && this.pendingRequests.has(response.id)) {
					const pending = this.pendingRequests.get(response.id)!;
					clearTimeout(pending.timeoutId);
					pending.resolve(response.value);
					this.pendingRequests.delete(response.id);
				}
				break;

			case 'error':
				this.handleError(response);
				break;

			case 'stdout':
				if (response.value && this.stdoutCallback) {
					this.stdoutCallback(response.value);
				}
				break;

			case 'stderr':
				if (response.value && this.stderrCallback) {
					this.stderrCallback(response.value);
				}
				break;

			case 'stream-data':
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

			case 'stream-done':
				if (response.id === this.streamState.id && this.streamState.onDone) {
					this.streamState.onDone();
					this.streamState = {
						id: null,
						onData: null,
						onDone: null,
						onError: null
					};
				}
				break;
		}
	}

	private handleError(response: REPLErrorResponse): void {
		const { id, error, traceback } = response;
		const errorMsg = traceback ? `${error}\n${traceback}` : error || 'Unknown error';

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
				onError: null
			};
		}

		backendState.update((s) => ({ ...s, error: error || 'Unknown error' }));
	}

	setBackendPreference(currentBackendPreference : null | BackendPreference):void {
		console.log("(backend.ts) Setting backend preference: ", currentBackendPreference)
		this.backendPreference = currentBackendPreference
	}

	getBackendPreference(): null | BackendPreference {
		return this.backendPreference
	}
}
