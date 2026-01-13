/**
 * Backend State Store
 * Shared state management for all backend implementations
 */

import { writable, get } from 'svelte/store';
import type { BackendState } from './types';

const initialState: BackendState = {
	initialized: false,
	loading: false,
	error: null,
	progress: ''
};

const internal = writable<BackendState>(initialState);

/**
 * Backend state store
 * Tracks initialization status, loading state, errors, and progress
 */
export const backendState = {
	subscribe: internal.subscribe,
	get: () => get(internal),
	set: internal.set,
	update: internal.update,
	reset: () => internal.set(initialState)
};
