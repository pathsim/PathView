/**
 * Store for managing the global code preview dialog
 * Used by context menus to show code without opening properties dialog
 */

import { writable } from 'svelte/store';

interface CodePreviewState {
	code: string;
	title: string;
}

const { subscribe, set } = writable<CodePreviewState | null>(null);

export const codePreviewStore = {
	subscribe,
	open(code: string, title: string) {
		set({ code, title });
	},
	close() {
		set(null);
	}
};
