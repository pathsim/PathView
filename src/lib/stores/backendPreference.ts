/**
 * Backend Preference store
 * Manages whether the client prefers to run pathview via Pyodide local WebAssembly or with API calls to a Flask backend
 * with localStorage persistence
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type BackendPreference = 'pyodide' | 'flask';

// Get initial backend preference from localStorage or system preference
function getIntialBackendPreference(): BackendPreference {
	if (!browser || typeof window == "undefined") return 'flask';

	const stored = localStorage.getItem('pathview-backend-preference');
	if (stored === 'pyodide' || stored === 'flask') {
		return stored;
	}

	return 'pyodide';
}

// Create the backend preference store
const backendPreference = writable<BackendPreference>(getIntialBackendPreference());

// Apply backend preference to document and persist
backendPreference.subscribe((value) => {
	if (!browser || typeof window == "undefined") return;

	// Persist to localStorage
	localStorage.setItem('pathview-backend-preference', value);
});

// Theme store with actions
export const backendPreferenceStore = {
	subscribe: backendPreference.subscribe,

	/**
	 * Toggle between a preference for flask or pyodide
	 */
	toggle(): void {
		backendPreference.update((current) => (current === 'pyodide' ? 'flask' : 'pyodide'));
		if(typeof window !== "undefined") {
			// To avoid complications with the initialization state of the Pyodide Backend class I will just reload the page
			window.location.reload()
		}
	},

	/**
	 * Set specific preference
	 */
	set(newPreference: BackendPreference): void {
		backendPreference.set(newPreference);
	},

	/**
	 * Get current preference value
	 */
	get(): BackendPreference {
		let current: BackendPreference = 'pyodide';
		backendPreference.subscribe((value) => (current = value))();
		return current;
	}
};
