/**
 * Node updates store
 * Triggers node re-renders when rotation or other internal changes happen
 */

import { writable, get } from 'svelte/store';

const pendingUpdates = writable<string[]>([]);

export const nodeUpdatesStore = {
	subscribe: pendingUpdates.subscribe,

	/**
	 * Queue nodes for update (e.g., after rotation)
	 */
	queueUpdate(nodeIds: string[]): void {
		pendingUpdates.update(current => [...current, ...nodeIds]);
	},

	/**
	 * Clear pending updates after processing
	 */
	clear(): void {
		pendingUpdates.set([]);
	},

	/**
	 * Get current pending updates
	 */
	get(): string[] {
		return get(pendingUpdates);
	}
};
