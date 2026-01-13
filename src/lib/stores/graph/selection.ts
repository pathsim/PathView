/**
 * Graph store - Selection management
 *
 * Selection is managed by SvelteFlow as the source of truth.
 * These functions trigger SvelteFlow updates, which then sync back to stores.
 */

import { get } from 'svelte/store';
import { selectedNodeIds, getCurrentGraph, isAtRootLevel } from './state';
import { triggerSelectNodes, triggerClearSelection } from '$lib/stores/viewActions';
import { eventStore } from '$lib/stores/events';

/**
 * Select a node (triggers SvelteFlow update)
 */
export function selectNode(id: string, addToSelection = false): void {
	if (addToSelection) {
		// Get currently selected nodes and add the new one
		const current = get(selectedNodeIds);
		triggerSelectNodes([...current, id], true);
	} else {
		triggerSelectNodes([id], false);
	}
}

/**
 * Deselect a node (triggers SvelteFlow update)
 */
export function deselectNode(id: string): void {
	const current = get(selectedNodeIds);
	const remaining = [...current].filter(nodeId => nodeId !== id);
	triggerSelectNodes(remaining, false);
}

/**
 * Clear selection (triggers SvelteFlow update)
 */
export function clearSelection(): void {
	triggerClearSelection();
}

/**
 * Check if any nodes are currently selected
 */
export function hasSelection(): boolean {
	return get(selectedNodeIds).size > 0;
}

/**
 * Select all nodes and events in current context (triggers SvelteFlow update)
 */
export function selectAll(): void {
	const graph = getCurrentGraph();

	// Get all node IDs
	const allNodeIds = Array.from(graph.nodes.keys());

	// Get all event IDs (from eventStore at root, from subsystem graph otherwise)
	const allEventIds = isAtRootLevel()
		? Array.from(get(eventStore.events).keys())
		: Array.from(graph.events.keys());

	triggerSelectNodes([...allNodeIds, ...allEventIds], false);
}
