/**
 * Graph store - Connection operations
 */

import { get } from 'svelte/store';
import type { Connection } from '$lib/nodes/types';
import {
	rootNodes,
	rootConnections,
	generateId,
	getCurrentGraph,
	updateCurrentConnections
} from './state';

/**
 * Add a connection between two ports
 */
export function addConnection(
	sourceNodeId: string,
	sourcePortIndex: number,
	targetNodeId: string,
	targetPortIndex: number
): Connection | null {
	const currentGraph = getCurrentGraph();
	const sourceNode = currentGraph.nodes.get(sourceNodeId);
	const targetNode = currentGraph.nodes.get(targetNodeId);

	if (!sourceNode || !targetNode) {
		console.error('Invalid node IDs for connection');
		return null;
	}

	if (sourcePortIndex >= sourceNode.outputs.length || targetPortIndex >= targetNode.inputs.length) {
		console.error('Invalid port indices for connection');
		return null;
	}

	// Check if target port already has a connection
	const connections = currentGraph.connections;
	const portOccupied = connections.some(
		c => c.targetNodeId === targetNodeId && c.targetPortIndex === targetPortIndex
	);

	if (portOccupied) {
		console.warn('Target port already has a connection');
		return null;
	}

	const connection: Connection = {
		id: generateId(),
		sourceNodeId,
		sourcePortIndex,
		targetNodeId,
		targetPortIndex
	};

	updateCurrentConnections(c => [...c, connection]);

	return connection;
}

/**
 * Remove a connection
 */
export function removeConnection(id: string): void {
	updateCurrentConnections(c => c.filter(conn => conn.id !== id));
}

/**
 * Get all connections recursively (for code generation)
 */
export function getAllConnections(): { connection: Connection; subsystemId?: string }[] {
	const all: { connection: Connection; subsystemId?: string }[] = [];

	// Root connections
	for (const conn of get(rootConnections)) {
		all.push({ connection: conn });
	}

	// Collect from subsystems
	const collectConnections = (nodes: Map<string, unknown> | unknown[], parentId?: string) => {
		const nodeList = nodes instanceof Map ? Array.from(nodes.values()) : nodes;
		for (const node of nodeList as { id: string; graph?: { connections: Connection[]; nodes: unknown[] } }[]) {
			if (node.graph) {
				for (const conn of node.graph.connections) {
					all.push({ connection: conn, subsystemId: node.id });
				}
				collectConnections(node.graph.nodes, node.id);
			}
		}
	};
	collectConnections(get(rootNodes));

	return all;
}
