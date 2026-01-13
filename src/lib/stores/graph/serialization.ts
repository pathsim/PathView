/**
 * Graph store - Serialization (toJSON, fromJSON, clear)
 */

import { get } from 'svelte/store';
import type { NodeInstance, Connection, Annotation } from '$lib/nodes/types';
import { NODE_TYPES } from '$lib/constants/nodeTypes';
import {
	rootNodes,
	rootConnections,
	rootAnnotations,
	currentPath,
	selectedNodeIds,
	type SearchableNode
} from './state';

/**
 * Clear the entire graph
 */
export function clear(): void {
	rootNodes.set(new Map());
	rootConnections.set([]);
	rootAnnotations.set(new Map());
	currentPath.set([]);
	selectedNodeIds.set(new Set());
}

/**
 * Get current state as JSON-serializable object (nested structure)
 */
export function toJSON(): { nodes: NodeInstance[]; connections: Connection[]; annotations: Annotation[] } {
	return {
		nodes: Array.from(get(rootNodes).values()),
		connections: get(rootConnections),
		annotations: Array.from(get(rootAnnotations).values())
	};
}

/**
 * Load state from JSON
 */
export function fromJSON(nodeList: NodeInstance[], connectionList: Connection[], annotationList?: Annotation[]): void {
	if (!nodeList || !Array.isArray(nodeList)) {
		rootNodes.set(new Map());
	} else {
		rootNodes.set(new Map(nodeList.map(n => [n.id, n])));
	}
	rootConnections.set(connectionList || []);
	rootAnnotations.set(new Map((annotationList || []).map(a => [a.id, a])));
	currentPath.set([]);
	selectedNodeIds.set(new Set());
}

/**
 * Get all nodes with their path information (for global search)
 * Excludes Interface nodes as they're internal to subsystems
 */
export function getAllNodesWithPaths(): SearchableNode[] {
	const results: SearchableNode[] = [];

	const collectNodes = (
		nodes: NodeInstance[],
		path: string[],
		pathNames: string[]
	) => {
		for (const node of nodes) {
			// Skip Interface nodes - they're internal
			if (node.type === NODE_TYPES.INTERFACE) continue;

			results.push({
				node,
				path: [...path],
				pathNames: [...pathNames],
				depth: path.length
			});

			// Recurse into subsystems
			if (node.graph) {
				collectNodes(
					node.graph.nodes,
					[...path, node.id],
					[...pathNames, node.name]
				);
			}
		}
	};

	collectNodes(Array.from(get(rootNodes).values()), [], ['Root']);
	return results;
}

