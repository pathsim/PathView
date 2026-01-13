/**
 * Store for managing the event properties dialog
 */
import { writable, get } from 'svelte/store';

const internal = writable<string | null>(null);

export const eventDialogStore = {
	subscribe: internal.subscribe,

	open(eventId: string): void {
		internal.set(eventId);
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
export const openEventDialog = (eventId: string) => eventDialogStore.open(eventId);
export const closeEventDialog = () => eventDialogStore.close();
