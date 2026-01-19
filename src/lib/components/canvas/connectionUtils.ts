/**
 * Connection utilities for SvelteFlow canvas
 */

import { get } from 'svelte/store';
import { graphStore } from '$lib/stores/graph';

/**
 * Find the first available (unconnected) input port for a node
 * Returns null if no ports are available
 */
export function findFirstAvailableInputPort(nodeId: string): number | null {
	const graphNodes = get(graphStore.nodesArray);
	const node = graphNodes.find((n) => n.id === nodeId);
	if (!node) return null;

	const currentConnections = get(graphStore.connections);
	const connectedInputPorts = new Set(
		currentConnections.filter((c) => c.targetNodeId === nodeId).map((c) => c.targetPortIndex)
	);

	// Find first unconnected port
	for (let i = 0; i < node.inputs.length; i++) {
		if (!connectedInputPorts.has(i)) {
			return i;
		}
	}

	return null;
}
