/**
 * Connection validation and utilities for SvelteFlow canvas
 */

import { get } from 'svelte/store';
import { graphStore } from '$lib/stores/graph';
import { nodeRegistry } from '$lib/nodes';
import { HANDLE_ID } from '$lib/constants/handles';

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

/**
 * Check if a target port is already connected
 */
export function isPortOccupied(nodeId: string, portIndex: number): boolean {
	const currentConnections = get(graphStore.connections);
	return currentConnections.some(
		(c) => c.targetNodeId === nodeId && c.targetPortIndex === portIndex
	);
}

/**
 * Check if a node can accept more input ports
 */
export function canAddInputPort(nodeId: string): boolean {
	const graphNodes = get(graphStore.nodesArray);
	const node = graphNodes.find((n) => n.id === nodeId);
	if (!node) return false;

	const typeDef = nodeRegistry.get(node.type);
	if (!typeDef) return false;

	// Check if maxInputs allows more ports
	return typeDef.ports.maxInputs === null || node.inputs.length < typeDef.ports.maxInputs;
}

/**
 * Find a connection by edge properties (source, target, handles)
 */
export function findConnectionByEdge(
	source: string,
	target: string,
	sourceHandle: string | null,
	targetHandle: string | null
): { id: string; sourcePortIndex: number; targetPortIndex: number } | null {
	const currentConnections = get(graphStore.connections);

	// Try to parse port indices from handles
	if (sourceHandle && targetHandle) {
		const { sourceIndex, targetIndex } = HANDLE_ID.parseConnection(sourceHandle, targetHandle);

		if (sourceIndex !== null && targetIndex !== null) {
			const conn = currentConnections.find(
				(c) =>
					c.sourceNodeId === source &&
					c.sourcePortIndex === sourceIndex &&
					c.targetNodeId === target &&
					c.targetPortIndex === targetIndex
			);

			if (conn) {
				return {
					id: conn.id,
					sourcePortIndex: sourceIndex,
					targetPortIndex: targetIndex
				};
			}
		}
	}

	return null;
}
