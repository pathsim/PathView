/**
 * Pinned Previews store
 * Controls whether plot previews are shown on all recording nodes
 */

import { writable } from 'svelte/store';

// Create the store
const pinned = writable<boolean>(false);

export const pinnedPreviewsStore = {
	subscribe: pinned.subscribe,

	/**
	 * Toggle pinned state
	 */
	toggle(): void {
		pinned.update((current) => !current);
	},

	/**
	 * Set pinned state
	 */
	set(value: boolean): void {
		pinned.set(value);
	}
};
