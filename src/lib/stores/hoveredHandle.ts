import { writable } from 'svelte/store';

// Hovered handle (single handle hover)
export const hoveredHandle = writable<{ nodeId: string; handleId: string; color?: string } | null>(null);

// Selected node for edge highlighting (separate from hover)
export const selectedNodeHighlight = writable<{ nodeId: string; color?: string } | null>(null);
