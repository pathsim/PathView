/**
 * Global confirmation modal store
 * Provides a promise-based API for showing confirmation dialogs
 */

import { writable } from 'svelte/store';

export interface ConfirmationOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
}

interface ConfirmationState {
	open: boolean;
	options: ConfirmationOptions | null;
	resolve: ((value: boolean) => void) | null;
}

const initialState: ConfirmationState = {
	open: false,
	options: null,
	resolve: null
};

const store = writable<ConfirmationState>(initialState);

/**
 * Show a confirmation dialog and wait for user response
 * @returns Promise that resolves to true if confirmed, false if cancelled
 */
function show(options: ConfirmationOptions): Promise<boolean> {
	return new Promise((resolve) => {
		store.set({
			open: true,
			options: {
				confirmText: 'Confirm',
				cancelText: 'Cancel',
				...options
			},
			resolve
		});
	});
}

/**
 * Confirm the dialog (called by modal component)
 */
function confirm(): void {
	store.update((state) => {
		if (state.resolve) {
			state.resolve(true);
		}
		return initialState;
	});
}

/**
 * Cancel the dialog (called by modal component)
 */
function cancel(): void {
	store.update((state) => {
		if (state.resolve) {
			state.resolve(false);
		}
		return initialState;
	});
}

export const confirmationStore = {
	subscribe: store.subscribe,
	show,
	confirm,
	cancel
};
