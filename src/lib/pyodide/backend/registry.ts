/**
 * Backend Registry
 * Factory and management for Python execution backends
 */

import type { Backend } from './types';
import { PyodideBackend } from './pyodide/backend';

export type BackendType = 'pyodide' | 'local' | 'remote';

let currentBackend: Backend | null = null;
let currentBackendType: BackendType | null = null;

/**
 * Get the current backend, creating a Pyodide backend if none exists
 */
export function getBackend(): Backend {
	if (!currentBackend) {
		currentBackend = createBackend('pyodide');
		currentBackendType = 'pyodide';
	}
	return currentBackend;
}

/**
 * Create a backend by type
 */
export function createBackend(type: BackendType): Backend {
	switch (type) {
		case 'pyodide':
			return new PyodideBackend();
		case 'local':
		case 'remote':
			throw new Error(`Backend type '${type}' not yet implemented`);
		default:
			throw new Error(`Unknown backend type: ${type}`);
	}
}

/**
 * Switch to a different backend
 * Terminates the current backend before creating the new one
 */
export function switchBackend(type: BackendType): Backend {
	if (currentBackend) {
		currentBackend.terminate();
	}
	currentBackend = createBackend(type);
	currentBackendType = type;
	return currentBackend;
}

/**
 * Get the current backend type
 */
export function getBackendType(): BackendType | null {
	return currentBackendType;
}

/**
 * Check if a backend is currently active
 */
export function hasBackend(): boolean {
	return currentBackend !== null;
}

/**
 * Terminate the current backend
 */
export function terminateBackend(): void {
	if (currentBackend) {
		currentBackend.terminate();
		currentBackend = null;
		currentBackendType = null;
	}
}
