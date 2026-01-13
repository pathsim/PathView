/**
 * Drop target bridge
 * Bridges drop events from outside SvelteFlow context to handlers inside
 * Note: This is not a reactive store - it's a callback registration utility
 */

type DropHandler = (event: DragEvent) => void;

let dropHandler: DropHandler | null = null;

export const dropTargetBridge = {
	registerDropHandler(handler: DropHandler): void {
		dropHandler = handler;
	},

	handleDrop(event: DragEvent): void {
		if (dropHandler) {
			dropHandler(event);
		}
	}
};
