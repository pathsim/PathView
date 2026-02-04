/**
 * Port Labels Store
 *
 * Controls global visibility of port labels inside nodes.
 * Toggle with 'L' key. Persists to localStorage.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'pathview-portLabels';

function getInitialValue(): boolean {
	if (!browser) return false;
	return localStorage.getItem(STORAGE_KEY) === 'true';
}

const store = writable<boolean>(getInitialValue());

// Persist to localStorage on change
store.subscribe((value) => {
	if (browser) {
		localStorage.setItem(STORAGE_KEY, String(value));
	}
});

export const portLabelsStore = {
	subscribe: store.subscribe,
	toggle(): void {
		store.update((current) => !current);
	},
	set(value: boolean): void {
		store.set(value);
	},
	get(): boolean {
		return get(store);
	}
};
