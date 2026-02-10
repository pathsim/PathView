/**
 * Backend Module
 * Provides a general-purpose streaming REPL interface for Python execution
 *
 * This module abstracts the Python execution backend, allowing different
 * implementations (Pyodide, local server, remote) to be swapped.
 */

// Re-export types
export type { Backend, BackendState, REPLRequest, REPLResponse } from './types';

// Re-export state store
export { backendState } from './state';

// Re-export registry
export {
	getBackend,
	createBackend,
	switchBackend,
	getBackendType,
	hasBackend,
	terminateBackend,
	setFlaskHost,
	type BackendType
} from './registry';

// Re-export backend implementations
export { PyodideBackend } from './pyodide/backend';
export { FlaskBackend } from './flask/backend';

// ============================================================================
// Backward-Compatible Convenience Functions
// These delegate to the current backend and maintain API compatibility
// ============================================================================

import { getBackend, switchBackend, setFlaskHost } from './registry';
import { backendState } from './state';
import { consoleStore } from '$lib/stores/console';

/**
 * Initialize backend from URL parameters.
 * Reads `?backend=flask` and `?host=...` from the current URL.
 * Call this early in page mount, before any backend usage.
 */
export function initBackendFromUrl(): void {
	if (typeof window === 'undefined') return;
	const params = new URLSearchParams(window.location.search);
	const backendParam = params.get('backend');
	const hostParam = params.get('host');

	if (backendParam === 'flask') {
		if (hostParam) {
			setFlaskHost(hostParam);
		}
		switchBackend('flask');
	}
}

// Alias for backward compatibility
export const replState = {
	subscribe: backendState.subscribe
};

/**
 * Initialize the backend
 */
export async function init(): Promise<void> {
	const backend = getBackend();

	// Set up console output callbacks
	backend.onStdout((value) => consoleStore.output(value));
	backend.onStderr((value) => consoleStore.error(value));

	// Log initialization progress
	const unsubscribe = backend.subscribe((state) => {
		if (state.progress && state.loading) {
			consoleStore.info(state.progress);
		}
	});

	try {
		consoleStore.info('Initializing Python REPL...');
		await backend.init();
		consoleStore.info('Python REPL ready');
	} finally {
		unsubscribe();
	}
}

/**
 * Terminate the backend
 */
export function terminate(): void {
	getBackend().terminate();
}

/**
 * Execute Python code (no return value)
 */
export async function exec(code: string, timeout?: number): Promise<void> {
	return getBackend().exec(code, timeout);
}

/**
 * Evaluate a Python expression and return the result
 */
export async function evaluate<T = unknown>(expr: string, timeout?: number): Promise<T> {
	return getBackend().evaluate<T>(expr, timeout);
}

/**
 * Start autonomous streaming
 */
export function startStreaming<T>(
	expr: string,
	onData: (data: T) => void,
	onDone: () => void,
	onError: (error: Error) => void
): void {
	getBackend().startStreaming(expr, onData, onDone, onError);
}

/**
 * Stop streaming
 */
export function stopStreaming(): void {
	getBackend().stopStreaming();
}

/**
 * Check if streaming is active
 */
export function isStreaming(): boolean {
	return getBackend().isStreaming();
}

/**
 * Execute code during active streaming (queued for next loop iteration)
 */
export function execDuringStreaming(code: string): void {
	getBackend().execDuringStreaming(code);
}

/**
 * Check if backend is ready
 */
export function isReady(): boolean {
	return getBackend().isReady();
}

/**
 * Check if backend is loading
 */
export function isLoading(): boolean {
	return getBackend().isLoading();
}

/**
 * Get current error (if any)
 */
export function getError(): string | null {
	return getBackend().getError();
}
