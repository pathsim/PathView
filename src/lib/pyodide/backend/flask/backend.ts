/**
 * Flask Backend
 * Implements the Backend interface using a Flask server with subprocess workers.
 *
 * Mirrors the Pyodide worker's message-passing pattern:
 * - exec/eval use simple request/response
 * - streaming uses start + poll (like postMessage with stream-data/stream-done)
 */

import type { Backend, BackendState } from '../types';
import { backendState } from '../state';
import { TIMEOUTS } from '$lib/constants/python';
import { STATUS_MESSAGES } from '$lib/constants/messages';
import { PYTHON_PACKAGES } from '$lib/constants/dependencies';

/** Polling interval for stream results (ms) */
const STREAM_POLL_INTERVAL = 30;

/** BroadcastChannel name for cross-tab session coordination */
const SESSION_CHANNEL = 'flask-session';

export class FlaskBackend implements Backend {
	private host: string;
	private sessionId: string;
	private messageId = 0;
	private _isStreaming = false;
	private streamPollTimer: ReturnType<typeof setTimeout> | null = null;
	private serverInitPromise: Promise<void> | null = null;
	private broadcastChannel: BroadcastChannel | null = null;

	// Stream callbacks — same shape as PyodideBackend's streamState
	private streamState: {
		onData: ((data: unknown) => void) | null;
		onDone: (() => void) | null;
		onError: ((error: Error) => void) | null;
	} = { onData: null, onDone: null, onError: null };

	// Output callbacks
	private stdoutCallback: ((value: string) => void) | null = null;
	private stderrCallback: ((value: string) => void) | null = null;

	constructor(host: string) {
		this.host = host.replace(/\/$/, '');
		const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('flask-session-id') : null;
		if (stored) {
			this.sessionId = stored;
		} else {
			this.sessionId = crypto.randomUUID();
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem('flask-session-id', this.sessionId);
			}
		}

		// Listen for session termination from other tabs
		if (typeof BroadcastChannel !== 'undefined') {
			this.broadcastChannel = new BroadcastChannel(SESSION_CHANNEL);
			this.broadcastChannel.onmessage = (event) => {
				if (event.data?.type === 'session-terminated') {
					this.serverInitPromise = null;
					backendState.reset();
				}
			};
		}
	}

	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	async init(): Promise<void> {
		const state = this.getState();
		if (state.initialized || state.loading) return;

		backendState.update((s) => ({
			...s,
			loading: true,
			error: null,
			progress: 'Connecting to Flask server...'
		}));

		try {
			const resp = await fetch(`${this.host}/api/health`, {
				signal: AbortSignal.timeout(TIMEOUTS.INIT)
			});
			if (!resp.ok) throw new Error(`Server health check failed: ${resp.status}`);

			backendState.update((s) => ({ ...s, progress: 'Initializing Python worker...' }));

			const initResp = await fetch(`${this.host}/api/init`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Session-ID': this.sessionId
				},
				body: JSON.stringify({ packages: PYTHON_PACKAGES }),
				signal: AbortSignal.timeout(TIMEOUTS.INIT)
			});
			const initData = await initResp.json();

			if (initData.type === 'error') throw new Error(initData.error);

			if (initData.messages) {
				for (const msg of initData.messages) {
					if (msg.type === 'stdout' && this.stdoutCallback) this.stdoutCallback(msg.value);
					if (msg.type === 'stderr' && this.stderrCallback) this.stderrCallback(msg.value);
					if (msg.type === 'progress') {
						backendState.update((s) => ({ ...s, progress: msg.value }));
					}
				}
			}

			this.serverInitPromise = Promise.resolve();

			backendState.update((s) => ({
				...s,
				initialized: true,
				loading: false,
				progress: STATUS_MESSAGES.READY
			}));
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			backendState.update((s) => ({ ...s, loading: false, error: `Flask backend error: ${msg}` }));
			throw error;
		}
	}

	terminate(): void {
		this.stopStreaming();
		this._isStreaming = false;
		this.streamState = { onData: null, onDone: null, onError: null };

		fetch(`${this.host}/api/session`, {
			method: 'DELETE',
			headers: { 'X-Session-ID': this.sessionId }
		}).catch(() => {});

		// Notify other tabs that the session was terminated
		this.broadcastChannel?.postMessage({ type: 'session-terminated' });

		this.serverInitPromise = null;
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
	// Lazy server init
	// -------------------------------------------------------------------------

	private ensureServerInit(): Promise<void> {
		if (this.serverInitPromise) return this.serverInitPromise;

		this.serverInitPromise = (async () => {
			const resp = await fetch(`${this.host}/api/init`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Session-ID': this.sessionId
				},
				body: JSON.stringify({ packages: PYTHON_PACKAGES }),
				signal: AbortSignal.timeout(TIMEOUTS.INIT)
			});
			const data = await resp.json();
			if (data.type === 'error') throw new Error(data.error);
			if (data.messages) {
				for (const msg of data.messages) {
					if (msg.type === 'stdout' && this.stdoutCallback) this.stdoutCallback(msg.value);
					if (msg.type === 'stderr' && this.stderrCallback) this.stderrCallback(msg.value);
				}
			}
		})();

		// Clear on failure so subsequent calls retry instead of returning the rejected promise
		this.serverInitPromise.catch(() => {
			this.serverInitPromise = null;
		});

		return this.serverInitPromise;
	}

	// -------------------------------------------------------------------------
	// Execution
	// -------------------------------------------------------------------------

	async exec(code: string, timeout: number = TIMEOUTS.SIMULATION): Promise<void> {
		await this.ensureServerInit();
		const id = this.generateId();

		const resp = await fetch(`${this.host}/api/exec`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Session-ID': this.sessionId
			},
			body: JSON.stringify({ id, code }),
			signal: AbortSignal.timeout(timeout)
		});

		const data = await resp.json();
		if (data.stdout && this.stdoutCallback) this.stdoutCallback(data.stdout);
		if (data.stderr && this.stderrCallback) this.stderrCallback(data.stderr);

		if (data.type === 'error') {
			this.handleWorkerError(data);
			const errorMsg = data.traceback ? `${data.error}\n${data.traceback}` : data.error;
			throw new Error(errorMsg);
		}
	}

	async evaluate<T = unknown>(expr: string, timeout: number = TIMEOUTS.SIMULATION): Promise<T> {
		await this.ensureServerInit();
		const id = this.generateId();

		const resp = await fetch(`${this.host}/api/eval`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Session-ID': this.sessionId
			},
			body: JSON.stringify({ id, expr }),
			signal: AbortSignal.timeout(timeout)
		});

		const data = await resp.json();
		if (data.stdout && this.stdoutCallback) this.stdoutCallback(data.stdout);
		if (data.stderr && this.stderrCallback) this.stderrCallback(data.stderr);

		if (data.type === 'error') {
			this.handleWorkerError(data);
			const errorMsg = data.traceback ? `${data.error}\n${data.traceback}` : data.error;
			throw new Error(errorMsg);
		}

		if (data.value === undefined) throw new Error('No value returned from eval');
		return JSON.parse(data.value) as T;
	}

	// -------------------------------------------------------------------------
	// Streaming — mirrors Pyodide worker's postMessage pattern via polling
	// -------------------------------------------------------------------------

	startStreaming<T>(
		expr: string,
		onData: (data: T) => void,
		onDone: () => void,
		onError: (error: Error) => void
	): void {
		if (this._isStreaming) {
			this.stopStreaming();
		}

		const id = this.generateId();
		this._isStreaming = true;
		this.streamState = {
			onData: onData as (data: unknown) => void,
			onDone,
			onError
		};

		// Start stream on server, then poll for results
		this.ensureServerInit()
			.then(() =>
				fetch(`${this.host}/api/stream/start`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Session-ID': this.sessionId
					},
					body: JSON.stringify({ id, expr })
				})
			)
			.then((resp) => resp.json())
			.then((data) => {
				if (data.type === 'error') {
					throw new Error(data.error);
				}
				// Start polling loop — same as Pyodide worker's onmessage dispatching
				this.pollStreamResults();
			})
			.catch((error) => {
				this._isStreaming = false;
				onError(error instanceof Error ? error : new Error(String(error)));
				this.streamState = { onData: null, onDone: null, onError: null };
			});
	}

	stopStreaming(): void {
		if (!this._isStreaming) return;

		// Stop polling timer — the server will send stream-done which triggers onDone
		if (this.streamPollTimer) {
			clearTimeout(this.streamPollTimer);
			this.streamPollTimer = null;
		}

		// Tell server to stop, then do one final poll to get the stream-done message
		fetch(`${this.host}/api/stream/stop`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Session-ID': this.sessionId
			}
		})
			.then(() => this.pollStreamResults())
			.catch(() => {
				// If final poll fails, clean up locally
				this._isStreaming = false;
				if (this.streamState.onDone) {
					this.streamState.onDone();
				}
				this.streamState = { onData: null, onDone: null, onError: null };
			});
	}

	isStreaming(): boolean {
		return this._isStreaming;
	}

	execDuringStreaming(code: string): void {
		if (!this._isStreaming) {
			console.warn('Cannot exec during streaming: no active stream');
			return;
		}

		fetch(`${this.host}/api/stream/exec`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Session-ID': this.sessionId
			},
			body: JSON.stringify({ code })
		}).catch(() => {});
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

	/**
	 * Check if a response indicates the worker crashed or timed out.
	 * If so, clear serverInitPromise so the next request triggers re-init.
	 */
	private handleWorkerError(data: Record<string, unknown>): void {
		const errorType = data.errorType as string | undefined;
		if (errorType === 'worker-crashed' || errorType === 'timeout') {
			this.serverInitPromise = null;
			if (this.stderrCallback) {
				this.stderrCallback('Python worker crashed, restarting on next request...\n');
			}
		}
	}

	/**
	 * Poll the server for stream messages and dispatch them to callbacks.
	 * This mirrors the Pyodide backend's handleResponse for stream-data/stream-done.
	 */
	private async pollStreamResults(): Promise<void> {
		if (!this._isStreaming) return;

		try {
			const resp = await fetch(`${this.host}/api/stream/poll`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Session-ID': this.sessionId
				}
			});

			const data = await resp.json();

			if (!Array.isArray(data?.messages)) {
				throw new Error(data?.error || 'Invalid poll response');
			}

			for (const msg of data.messages) {
				this.handleStreamMessage(msg);
				if (!this._isStreaming) return; // done or error stopped streaming
			}

			// Schedule next poll if still streaming
			if (this._isStreaming) {
				this.streamPollTimer = setTimeout(() => this.pollStreamResults(), STREAM_POLL_INTERVAL);
			}
		} catch (error) {
			this._isStreaming = false;
			if (this.streamState.onError) {
				this.streamState.onError(error instanceof Error ? error : new Error(String(error)));
			}
			this.streamState = { onData: null, onDone: null, onError: null };
		}
	}

	/**
	 * Handle a single message from the worker — same dispatch as PyodideBackend.handleResponse
	 */
	private handleStreamMessage(msg: Record<string, unknown>): void {
		const type = msg.type as string;

		switch (type) {
			case 'stream-data': {
				if (this.streamState.onData && msg.value) {
					try {
						this.streamState.onData(JSON.parse(msg.value as string));
					} catch {
						// Ignore parse errors
					}
				}
				break;
			}
			case 'stream-done': {
				this._isStreaming = false;
				if (this.streamState.onDone) {
					this.streamState.onDone();
				}
				this.streamState = { onData: null, onDone: null, onError: null };
				break;
			}
			case 'stdout': {
				if (this.stdoutCallback && msg.value) {
					this.stdoutCallback(msg.value as string);
				}
				break;
			}
			case 'stderr': {
				if (this.stderrCallback && msg.value) {
					this.stderrCallback(msg.value as string);
				}
				break;
			}
			case 'error': {
				this._isStreaming = false;
				if (this.streamState.onError) {
					const errorMsg = msg.traceback
						? `${msg.error}\n${msg.traceback}`
						: (msg.error as string) || 'Unknown error';
					this.streamState.onError(new Error(errorMsg));
				}
				this.streamState = { onData: null, onDone: null, onError: null };
				break;
			}
		}
	}
}
