/**
 * Selection utilities - shared operations on selected items
 *
 * Note: Selection STATE is managed by SvelteFlow (source of truth).
 * These utilities operate on the current selection.
 */

import { get } from 'svelte/store';
import { graphStore } from '$lib/stores/graph';
import { eventStore } from '$lib/stores/events';
import { historyStore } from '$lib/stores/history';

/**
 * Delete all selected nodes, annotations, and events as a single undoable operation.
 *
 * @returns true if any items were deleted
 */
export function deleteSelectedItems(): boolean {
	const selectedNodeIds = get(graphStore.selectedNodeIds);
	const selectedEventIds = get(eventStore.selectedEventIds);

	if (selectedNodeIds.size === 0 && selectedEventIds.size === 0) {
		return false;
	}

	return historyStore.mutate(() => {
		// Delete selected nodes and annotations
		for (const nodeId of selectedNodeIds) {
			// Check if it's an annotation or a regular node
			if (graphStore.getAnnotation(nodeId)) {
				graphStore.removeAnnotation(nodeId);
			} else {
				graphStore.removeNode(nodeId);
			}
		}

		// Delete selected events (location depends on navigation context)
		if (graphStore.isAtRoot()) {
			for (const eventId of selectedEventIds) {
				eventStore.removeEvent(eventId);
			}
		} else {
			for (const eventId of selectedEventIds) {
				graphStore.removeSubsystemEvent(eventId);
			}
		}

		return true;
	});
}
