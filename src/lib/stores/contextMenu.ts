/**
 * Context menu store
 * Manages context menu state for nodes, edges, and canvas
 */

import { writable, get } from 'svelte/store';
import type { Position } from '$lib/types';

export type ContextMenuTarget =
	| { type: 'node'; nodeId: string }
	| { type: 'event'; eventId: string }
	| { type: 'edge'; edgeId: string }
	| { type: 'canvas' }
	| { type: 'selection'; nodeIds: string[] }
	| { type: 'annotation'; annotationId: string }
	| { type: 'plot'; nodeId: string; plotEl: HTMLDivElement };

interface ContextMenuState {
	open: boolean;
	position: Position;
	target: ContextMenuTarget | null;
}

const state = writable<ContextMenuState>({
	open: false,
	position: { x: 0, y: 0 },
	target: null
});

export const contextMenuStore = {
	subscribe: state.subscribe,

	/**
	 * Open context menu for a node
	 */
	openForNode(nodeId: string, position: Position): void {
		state.set({
			open: true,
			position,
			target: { type: 'node', nodeId }
		});
	},

	/**
	 * Open context menu for an event
	 */
	openForEvent(eventId: string, position: Position): void {
		state.set({
			open: true,
			position,
			target: { type: 'event', eventId }
		});
	},

	/**
	 * Open context menu for multiple selected nodes
	 */
	openForSelection(nodeIds: string[], position: Position): void {
		state.set({
			open: true,
			position,
			target: { type: 'selection', nodeIds }
		});
	},

	/**
	 * Open context menu for an edge
	 */
	openForEdge(edgeId: string, position: Position): void {
		state.set({
			open: true,
			position,
			target: { type: 'edge', edgeId }
		});
	},

	/**
	 * Open context menu for canvas (empty area)
	 */
	openForCanvas(position: Position): void {
		state.set({
			open: true,
			position,
			target: { type: 'canvas' }
		});
	},

	/**
	 * Open context menu for an annotation
	 */
	openForAnnotation(annotationId: string, position: Position): void {
		state.set({
			open: true,
			position,
			target: { type: 'annotation', annotationId }
		});
	},

	/**
	 * Open context menu for a plot
	 */
	openForPlot(nodeId: string, plotEl: HTMLDivElement, position: Position): void {
		state.set({
			open: true,
			position,
			target: { type: 'plot', nodeId, plotEl }
		});
	},

	/**
	 * Close the context menu
	 */
	close(): void {
		state.set({
			open: false,
			position: { x: 0, y: 0 },
			target: null
		});
	},

	/**
	 * Get current state
	 */
	getState(): ContextMenuState {
		return get(state);
	}
};
