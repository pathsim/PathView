/**
 * Backend Registry
 * Factory and management for Python execution backends
 */

import type { Backend } from './types';
import { PyodideBackend } from './pyodide/backend';
import type { BackendPreference } from '$lib/types';
import { backendPreferenceStore } from '$lib/stores';

export type BackendType = 'pyodide' | 'local' | 'remote';

let currentBackend: Backend | null = null;
let currentBackendType: BackendPreference | null = null;

/**
 * Get the current backend, creating a Pyodide backend if none exists
 */
export function getBackend(): Backend {
	let currentBackendPreference = backendPreferenceStore.get()
	if (!currentBackend) {
		if(currentBackendPreference == null) currentBackendPreference = "pyodide"
		currentBackend = createBackend(currentBackendPreference);
	}
	if(getBackendType() !== currentBackendPreference) {
		switchBackend(currentBackendPreference)
	}
	return currentBackend;
}

/**
 * Create a backend by type
 */
export function createBackend(type: null |  BackendPreference): Backend {
	console.log("(registry.ts, createBackend) Current Backend Preference is: ", type)
	switch (type) {
		case 'pyodide':
		case null:
			return new PyodideBackend();
		case 'flask':
			let backend = new PyodideBackend()
			backend.setBackendPreference("flask")
			return backend
		// case 'remote':
		// 	throw new Error(`Backend type '${type}' not yet implemented`);
		default:
			throw new Error(`Unknown backend type: ${type}`);
	}
}

/**
 * Switch to a different backend
 * Terminates the current backend before creating the new one
 */
export function switchBackend(type: BackendPreference | null): Backend {
	console.log("(registry.ts, switchBackend) Switching backend type to ", type)
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
export function getBackendType(): BackendPreference | null {
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
