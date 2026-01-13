/**
 * View utilities - coordinate conversion and selection utilities for use outside SvelteFlow context
 */

type ScreenToFlowConverter = (screenPos: { x: number; y: number }) => { x: number; y: number };
type HasSelectionFn = () => boolean;

let screenToFlowConverterFn: ScreenToFlowConverter | null = null;
let hasSelectionFn: HasSelectionFn | null = null;

export function registerScreenToFlowConverter(converter: ScreenToFlowConverter): void {
	screenToFlowConverterFn = converter;
}

export function screenToFlow(screenPos: { x: number; y: number }): { x: number; y: number } {
	if (screenToFlowConverterFn) {
		return screenToFlowConverterFn(screenPos);
	}
	// Fallback - just return as-is (no zoom/pan adjustment)
	return screenPos;
}

export function registerHasSelection(fn: HasSelectionFn): void {
	hasSelectionFn = fn;
}

export function hasAnySelection(): boolean {
	return hasSelectionFn ? hasSelectionFn() : false;
}

export function getViewportCenter(): { x: number; y: number } {
	// Get the canvas element to determine its screen dimensions
	const canvasEl = document.querySelector('.svelte-flow') as HTMLElement;
	if (!canvasEl) {
		return { x: 400, y: 300 };
	}

	const bounds = canvasEl.getBoundingClientRect();
	// Calculate center of the canvas in screen coordinates
	const screenCenter = {
		x: bounds.left + bounds.width / 2,
		y: bounds.top + bounds.height / 2
	};

	// Convert to flow coordinates
	return screenToFlow(screenCenter);
}
