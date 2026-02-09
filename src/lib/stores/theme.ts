/**
 * Theme store
 * Manages light/dark theme with localStorage persistence
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

// Get initial theme from localStorage or system preference
function getInitialTheme(): Theme {
	if (!browser) return 'dark';

	// URL parameter has highest priority
	const urlTheme = new URL(window.location.href).searchParams.get('theme');
	if (urlTheme === 'dark' || urlTheme === 'light') {
		localStorage.setItem('pathview-theme', urlTheme);
		document.documentElement.setAttribute('data-theme', urlTheme);
		return urlTheme;
	}

	const stored = localStorage.getItem('pathview-theme');
	if (stored === 'light' || stored === 'dark') {
		return stored;
	}

	// Check system preference
	if (window.matchMedia('(prefers-color-scheme: light)').matches) {
		return 'light';
	}

	return 'dark';
}

// Create the theme store
const theme = writable<Theme>(getInitialTheme());

// Apply theme to document and persist
theme.subscribe((value) => {
	if (!browser) return;

	// Set data-theme attribute on document
	document.documentElement.setAttribute('data-theme', value);

	// Persist to localStorage
	localStorage.setItem('pathview-theme', value);
});

// Theme store with actions
export const themeStore = {
	subscribe: theme.subscribe,

	/**
	 * Toggle between light and dark
	 */
	toggle(): void {
		theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
	},

	/**
	 * Set specific theme
	 */
	set(newTheme: Theme): void {
		theme.set(newTheme);
	},

	/**
	 * Get current theme value
	 */
	get(): Theme {
		let current: Theme = 'dark';
		theme.subscribe((value) => (current = value))();
		return current;
	}
};
