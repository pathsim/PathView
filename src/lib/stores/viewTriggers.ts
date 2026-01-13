/**
 * View triggers - reactive stores for triggering view actions from outside SvelteFlow context
 */

import { writable, get } from 'svelte/store';

// Fit view padding in pixels - accounts for open panels
export interface FitViewPadding {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export const fitViewPadding = writable<FitViewPadding>({
	top: 100,
	right: 20,
	bottom: 20,
	left: 70
});

export function setFitViewPadding(padding: FitViewPadding): void {
	fitViewPadding.set(padding);
}

// Fit view trigger - increment to trigger fit view
export const fitViewTrigger = writable(0);

export function triggerFitView(): void {
	fitViewTrigger.update((n) => n + 1);
}

// Zoom triggers
export const zoomInTrigger = writable(0);
export const zoomOutTrigger = writable(0);

export function triggerZoomIn(): void {
	zoomInTrigger.update((n) => n + 1);
}

export function triggerZoomOut(): void {
	zoomOutTrigger.update((n) => n + 1);
}

// Pan trigger - stores delta to pan by
export const panTrigger = writable<{ x: number; y: number; id: number }>({ x: 0, y: 0, id: 0 });

export function triggerPan(delta: { x: number; y: number }): void {
	panTrigger.update((current) => ({ ...delta, id: current.id + 1 }));
}

// Focus on specific node trigger
export const focusNodeTrigger = writable<{ nodeId: string; id: number }>({ nodeId: '', id: 0 });

export function triggerFocusNode(nodeId: string): void {
	focusNodeTrigger.update((current) => ({ nodeId, id: current.id + 1 }));
}

// Clear selection trigger - allows clearing SvelteFlow selection from outside
export const clearSelectionTrigger = writable(0);

export function triggerClearSelection(): void {
	clearSelectionTrigger.update((n) => n + 1);
}

// Nudge trigger - nudges all selected nodes by delta
export const nudgeTrigger = writable<{ x: number; y: number; id: number }>({ x: 0, y: 0, id: 0 });

export function triggerNudge(delta: { x: number; y: number }): void {
	nudgeTrigger.update((current) => ({ ...delta, id: current.id + 1 }));
}

// Select node trigger - selects specific nodes in SvelteFlow
// nodeIds: array of node IDs to select
// addToSelection: if false, clears existing selection first
export const selectNodeTrigger = writable<{ nodeIds: string[]; addToSelection: boolean; id: number }>({
	nodeIds: [],
	addToSelection: false,
	id: 0
});

export function triggerSelectNodes(nodeIds: string[], addToSelection = false): void {
	selectNodeTrigger.update((current) => ({ nodeIds, addToSelection, id: current.id + 1 }));
}
