/**
 * Store for managing the block properties dialog
 */
import { writable, get } from 'svelte/store';

const internal = writable<string | null>(null);

export const nodeDialogStore = {
	subscribe: internal.subscribe,

	open(nodeId: string): void {
		internal.set(nodeId);
	},

	close(): void {
		internal.set(null);
	},

	isOpen(): boolean {
		return get(internal) !== null;
	},

	getOpenId(): string | null {
		return get(internal);
	}
};

// Convenience function exports for ergonomic usage
export const openNodeDialog = (nodeId: string) => nodeDialogStore.open(nodeId);
export const closeNodeDialog = () => nodeDialogStore.close();
