/**
 * Clipboard store for copy/paste operations
 * Stores deep clones of nodes, connections, and events
 */

import { writable, get } from 'svelte/store';
import type { NodeInstance, Connection } from '$lib/nodes/types';
import type { EventInstance } from '$lib/events/types';
import type { Position } from '$lib/types';
import { graphStore, regenerateGraphIds } from '$lib/stores/graph';
import { eventStore } from '$lib/stores/events';
import { historyStore } from '$lib/stores/history';
import { NODE_TYPES } from '$lib/constants/nodeTypes';
import { generateId } from '$lib/stores/utils';
import { deleteSelectedItems } from '$lib/stores/selection';

interface ClipboardContent {
	nodes: NodeInstance[];
	connections: Connection[];
	events: EventInstance[];
	// Center of the copied selection (for positioning on paste)
	center: Position;
}

const clipboard = writable<ClipboardContent | null>(null);

/**
 * Calculate the bounding box center of a set of items with positions
 */
function calculateCenter(items: Array<{ position: Position }>): Position {
	if (items.length === 0) return { x: 0, y: 0 };

	let minX = Infinity, minY = Infinity;
	let maxX = -Infinity, maxY = -Infinity;

	for (const item of items) {
		minX = Math.min(minX, item.position.x);
		minY = Math.min(minY, item.position.y);
		maxX = Math.max(maxX, item.position.x);
		maxY = Math.max(maxY, item.position.y);
	}

	return {
		x: (minX + maxX) / 2,
		y: (minY + maxY) / 2
	};
}

/**
 * Copy selected nodes and events to clipboard
 */
function copy(): boolean {
	const selectedNodeIds = get(graphStore.selectedNodeIds);
	const selectedEventIds = get(eventStore.selectedEventIds);

	if (selectedNodeIds.size === 0 && selectedEventIds.size === 0) {
		return false;
	}

	const nodesMap = get(graphStore.nodes);
	const connections = get(graphStore.connections);

	// Deep clone selected nodes (excluding Interface blocks)
	const copiedNodes: NodeInstance[] = [];
	for (const id of selectedNodeIds) {
		const node = nodesMap.get(id);
		if (node && node.type !== NODE_TYPES.INTERFACE) {
			copiedNodes.push(JSON.parse(JSON.stringify(node)));
		}
	}

	// Find connections where BOTH source and target are in the selection
	const copiedConnections: Connection[] = [];
	for (const conn of connections) {
		if (selectedNodeIds.has(conn.sourceNodeId) && selectedNodeIds.has(conn.targetNodeId)) {
			copiedConnections.push(JSON.parse(JSON.stringify(conn)));
		}
	}

	// Deep clone selected events
	const copiedEvents: EventInstance[] = [];
	if (graphStore.isAtRoot()) {
		for (const id of selectedEventIds) {
			const event = eventStore.getEvent(id);
			if (event) {
				copiedEvents.push(JSON.parse(JSON.stringify(event)));
			}
		}
	} else {
		// Inside subsystem - events from subsystem
		for (const id of selectedEventIds) {
			const event = graphStore.getSubsystemEvent(id);
			if (event) {
				copiedEvents.push(JSON.parse(JSON.stringify(event)));
			}
		}
	}

	// Calculate center of all copied items
	const allItems = [
		...copiedNodes.map(n => ({ position: n.position })),
		...copiedEvents.map(e => ({ position: e.position }))
	];
	const center = calculateCenter(allItems);

	clipboard.set({
		nodes: copiedNodes,
		connections: copiedConnections,
		events: copiedEvents,
		center
	});

	return true;
}

/**
 * Paste clipboard contents at target position
 * @param targetPosition - Position to center the pasted items at (flow coordinates)
 * @returns IDs of pasted nodes and events
 */
function paste(targetPosition: Position): { nodeIds: string[]; eventIds: string[] } {
	const content = get(clipboard);
	if (!content || (content.nodes.length === 0 && content.events.length === 0)) {
		return { nodeIds: [], eventIds: [] };
	}

	return historyStore.mutate(() => {
		// Calculate offset from original center to target position
		const offset = {
			x: targetPosition.x - content.center.x,
			y: targetPosition.y - content.center.y
		};

		// Map from old node ID to new node ID
		const nodeIdMap = new Map<string, string>();
		const nodesToPaste: NodeInstance[] = [];

		// Prepare nodes with new IDs and offset positions
		for (const node of content.nodes) {
			const newId = generateId();
			nodeIdMap.set(node.id, newId);

			const newNode: NodeInstance = {
				...node,
				id: newId,
				position: {
					x: node.position.x + offset.x,
					y: node.position.y + offset.y
				},
				inputs: node.inputs.map((port, index) => ({
					...port,
					id: `${newId}-input-${index}`,
					nodeId: newId
				})),
				outputs: node.outputs.map((port, index) => ({
					...port,
					id: `${newId}-output-${index}`,
					nodeId: newId
				}))
			};

			// Recursively regenerate IDs in subsystem graph (handles nested subsystems)
			if (newNode.graph) {
				newNode.graph = regenerateGraphIds(newNode.graph);
			}

			nodesToPaste.push(newNode);
		}

		// Prepare connections with remapped IDs
		const connectionsToPaste: Connection[] = [];
		for (const conn of content.connections) {
			const newSourceId = nodeIdMap.get(conn.sourceNodeId);
			const newTargetId = nodeIdMap.get(conn.targetNodeId);

			if (newSourceId && newTargetId) {
				connectionsToPaste.push({
					id: generateId(),
					sourceNodeId: newSourceId,
					sourcePortIndex: conn.sourcePortIndex,
					targetNodeId: newTargetId,
					targetPortIndex: conn.targetPortIndex
				});
			}
		}

		// Clear selection before paste
		graphStore.clearSelection();
		eventStore.clearSelection();

		// Paste nodes and connections using graphStore
		const nodeIds = graphStore.pasteNodes(nodesToPaste, connectionsToPaste);

		// Paste events
		const eventIds: string[] = [];
		for (const event of content.events) {
			const newPosition = {
				x: event.position.x + offset.x,
				y: event.position.y + offset.y
			};

			if (graphStore.isAtRoot()) {
				// Add event at root level
				const newEvent = eventStore.addEvent(event.type, newPosition, event.name);
				if (newEvent) {
					// Copy params and color
					if (Object.keys(event.params).length > 0) {
						eventStore.updateEventParams(newEvent.id, event.params);
					}
					if (event.color) {
						eventStore.updateEventColor(newEvent.id, event.color);
					}
					eventIds.push(newEvent.id);
					eventStore.selectEvent(newEvent.id, true);
				}
			} else {
				// Add event to subsystem
				const newId = generateId();
				const newEvent: EventInstance = {
					...event,
					id: newId,
					position: newPosition
				};
				graphStore.addSubsystemEvent(newEvent);
				eventIds.push(newId);
			}
		}

		return { nodeIds, eventIds };
	});
}

/**
 * Cut selected nodes and events (copy + delete)
 * @returns true if something was cut
 */
function cut(): boolean {
	// First copy the selection
	if (!copy()) {
		return false;
	}

	// Then delete selected items
	deleteSelectedItems();
	return true;
}

/**
 * Check if clipboard has content
 */
function hasContent(): boolean {
	const content = get(clipboard);
	return content !== null && (content.nodes.length > 0 || content.events.length > 0);
}

/**
 * Clear clipboard
 */
function clear(): void {
	clipboard.set(null);
}

/**
 * Get clipboard content summary (for UI feedback)
 */
function getSummary(): { nodes: number; connections: number; events: number } | null {
	const content = get(clipboard);
	if (!content) return null;
	return {
		nodes: content.nodes.length,
		connections: content.connections.length,
		events: content.events.length
	};
}

export const clipboardStore = {
	subscribe: clipboard.subscribe,
	copy,
	cut,
	paste,
	hasContent,
	clear,
	getSummary
};
