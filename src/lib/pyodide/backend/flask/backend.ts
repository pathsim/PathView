/**
 * Flask Backend
 * Implements the Backend interface using a Flask server with subprocess workers
 */

import type { Backend, BackendState } from '../types';
import { backendState } from '../state';
import { TIMEOUTS } from '$lib/constants/python';
import { STATUS_MESSAGES } from '$lib/constants/messages';
import { PYTHON_PACKAGES } from '$lib/constants/dependencies';

/**
 * Flask Backend Implementation
 *
 * Communicates with a Flask server that manages Python subprocess workers.
 * Each browser session gets its own isolated Python process on the server.
 * Supports streaming via Server-Sent Events (SSE).
 */
export class FlaskBackend implements Backend {
	private host: string;
	private sessionId: string;
	private messageId = 0;
	private _isStreaming = false;
	private streamAbortController: AbortController | null = null;

	// Stream state
	private streamState: {
		onData: ((data: unknown) => void) | null;
		onDone: (() => void) | null;
		onError: ((error: Error) => void) | null;
	} = { onData: null, onDone: null, onError: null };

	// Output callbacks
	private stdoutCallback: ((value: string) => void) | null = null;
	private stderrCallback: ((value: string) => void) | null = null;

	constructor(host: string) {
		this.host = host.replace(/\/$/, ''); // strip trailing slash
		// Get or create session ID from sessionStorage
		const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('flask-session-id') : null;
		if (stored) {
			this.sessionId = stored;
		} else {
			this.sessionId = crypto.randomUUID();
			if (typeof sessionStorage !== 'undefined') {
				sessionStorage.setItem('flask-session-id', this.sessionId);
			}
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
			// Health check
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), TIMEOUTS.INIT);

			const resp = await fetch(`${this.host}/api/health`, {
				signal: controller.signal
			});
			clearTimeout(timeout);

			if (!resp.ok) {
				throw new Error(`Server health check failed: ${resp.status}`);
			}

			// Initialize worker with packages from the shared config (single source of truth)
			backendState.update((s) => ({ ...s, progress: 'Initializing Python worker...' }));

			const initController = new AbortController();
			const initTimeout = setTimeout(() => initController.abort(), TIMEOUTS.INIT);

			const initResp = await fetch(`${this.host}/api/init`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Session-ID': this.sessionId
				},
				body: JSON.stringify({ packages: PYTHON_PACKAGES }),
				signal: initController.signal
			});
			clearTimeout(initTimeout);

			const initData = await initResp.json();

			if (initData.type === 'error') {
				throw new Error(initData.error);
			}

			// Forward any stdout/stderr messages from init
			if (initData.messages) {
				for (const msg of initData.messages) {
					if (msg.type === 'stdout' && this.stdoutCallback) this.stdoutCallback(msg.value);
					if (msg.type === 'stderr' && this.stderrCallback) this.stderrCallback(msg.value);
					if (msg.type === 'progress') {
						backendState.update((s) => ({ ...s, progress: msg.value }));
					}
				}
			}

			backendState.update((s) => ({
				...s,
				initialized: true,
				loading: false,
				progress: STATUS_MESSAGES.READY
			}));
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			backendState.update((s) => ({
				...s,
				loading: false,
				error: `Flask backend error: ${msg}`
			}));
			throw error;
		}
	}

	terminate(): void {
		// Abort any active stream
		if (this.streamAbortController) {
			this.streamAbortController.abort();
			this.streamAbortController = null;
		}

		// Clear stream state
		this._isStreaming = false;
		this.streamState = { onData: null, onDone: null, onError: null };

		// Kill server-side session (fire and forget)
		fetch(`${this.host}/api/session`, {
			method: 'DELETE',
			headers: { 'X-Session-ID': this.sessionId }
		}).catch(() => {});

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
		const id = this.generateId();
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const resp = await fetch(`${this.host}/api/exec`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Session-ID': this.sessionId
				},
				body: JSON.stringify({ id, code }),
				signal: controller.signal
			});

			const data = await resp.json();

			// Forward stdout/stderr from response
			if (data.stdout && this.stdoutCallback) this.stdoutCallback(data.stdout);
			if (data.stderr && this.stderrCallback) this.stderrCallback(data.stderr);

			if (data.type === 'error') {
				const errorMsg = data.traceback ? `${data.error}\n${data.traceback}` : data.error;
				throw new Error(errorMsg);
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new Error('Execution timeout');
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async evaluate<T = unknown>(expr: string, timeout: number = TIMEOUTS.SIMULATION): Promise<T> {
		const id = this.generateId();
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const resp = await fetch(`${this.host}/api/eval`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Session-ID': this.sessionId
				},
				body: JSON.stringify({ id, expr }),
				signal: controller.signal
			});

			const data = await resp.json();

			// Forward stdout/stderr from response
			if (data.stdout && this.stdoutCallback) this.stdoutCallback(data.stdout);
			if (data.stderr && this.stderrCallback) this.stderrCallback(data.stderr);

			if (data.type === 'error') {
				const errorMsg = data.traceback ? `${data.error}\n${data.traceback}` : data.error;
				throw new Error(errorMsg);
			}

			if (data.value === undefined) {
				throw new Error('No value returned from eval');
			}

			return JSON.parse(data.value) as T;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new Error('Evaluation timeout');
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
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
		if (!this.isReady()) {
			onError(new Error('Backend not initialized'));
			return;
		}

		// Stop any existing stream
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

		this.streamAbortController = new AbortController();

		// Start SSE stream
		this.consumeSSEStream(id, expr, this.streamAbortController.signal);
	}

	stopStreaming(): void {
		if (!this._isStreaming) return;

		// Send stop to server
		fetch(`${this.host}/api/stream/stop`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Session-ID': this.sessionId
			}
		}).catch(() => {});

		// Abort the SSE connection
		if (this.streamAbortController) {
			this.streamAbortController.abort();
			this.streamAbortController = null;
		}
	}

	isStreaming(): boolean {
		return this._isStreaming;
	}

	execDuringStreaming(code: string): void {
		if (!this._isStreaming) {
			console.warn('Cannot exec during streaming: no active stream');
			return;
		}

		// Fire and forget
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
	 * Consume an SSE stream from /api/stream, dispatching events to callbacks.
	 */
	private async consumeSSEStream(id: string, expr: string, signal: AbortSignal): Promise<void> {
		try {
			const resp = await fetch(`${this.host}/api/stream`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Session-ID': this.sessionId
				},
				body: JSON.stringify({ id, expr }),
				signal
			});

			if (!resp.ok || !resp.body) {
				throw new Error(`Stream request failed: ${resp.status}`);
			}

			const reader = resp.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				// Process complete SSE messages (separated by double newlines)
				const parts = buffer.split('\n\n');
				buffer = parts.pop() || ''; // Keep incomplete last part

				for (const part of parts) {
					if (!part.trim()) continue;

					// Parse SSE fields
					let eventType = '';
					let eventData = '';

					for (const line of part.split('\n')) {
						if (line.startsWith('event: ')) {
							eventType = line.slice(7);
						} else if (line.startsWith('data: ')) {
							eventData = line.slice(6);
						}
					}

					if (!eventType) continue;

					this.handleSSEEvent(eventType, eventData);

					if (eventType === 'done' || eventType === 'error') {
						return;
					}
				}
			}
		} catch (error) {
			if (signal.aborted) {
				// Aborted by stopStreaming — call onDone
				this._isStreaming = false;
				if (this.streamState.onDone) {
					this.streamState.onDone();
				}
				this.streamState = { onData: null, onDone: null, onError: null };
				return;
			}
			this._isStreaming = false;
			if (this.streamState.onError) {
				this.streamState.onError(error instanceof Error ? error : new Error(String(error)));
			}
			this.streamState = { onData: null, onDone: null, onError: null };
		}
	}

	private handleSSEEvent(eventType: string, data: string): void {
		switch (eventType) {
			case 'data': {
				if (this.streamState.onData) {
					try {
						const parsed = JSON.parse(data);
						this.streamState.onData(parsed);
					} catch {
						// Ignore parse errors
					}
				}
				break;
			}
			case 'stdout': {
				if (this.stdoutCallback) {
					try {
						this.stdoutCallback(JSON.parse(data));
					} catch {
						this.stdoutCallback(data);
					}
				}
				break;
			}
			case 'stderr': {
				if (this.stderrCallback) {
					try {
						this.stderrCallback(JSON.parse(data));
					} catch {
						this.stderrCallback(data);
					}
				}
				break;
			}
			case 'done': {
				this._isStreaming = false;
				if (this.streamState.onDone) {
					this.streamState.onDone();
				}
				this.streamState = { onData: null, onDone: null, onError: null };
				break;
			}
			case 'error': {
				this._isStreaming = false;
				if (this.streamState.onError) {
					try {
						const parsed = JSON.parse(data);
						const msg = parsed.traceback
							? `${parsed.error}\n${parsed.traceback}`
							: parsed.error || 'Unknown error';
						this.streamState.onError(new Error(msg));
					} catch {
						this.streamState.onError(new Error(data || 'Stream error'));
					}
				}
				this.streamState = { onData: null, onDone: null, onError: null };
				backendState.update((s) => ({ ...s, error: 'Stream error' }));
				break;
			}
		}
	}
}
