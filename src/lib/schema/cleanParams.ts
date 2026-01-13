/**
 * Shared param cleaning utilities for file export
 */

import type { NodeInstance } from '$lib/nodes/types';
import { nodeRegistry } from '$lib/nodes';

/**
 * Clean node params for export:
 * - Remove empty values (null, undefined, '')
 * - Remove params not in type definition (dead params)
 * - Keep internal UI params (starting with _) for layout preservation
 */
export function cleanNodeParams(node: NodeInstance): Record<string, unknown> {
	const typeDef = nodeRegistry.get(node.type);
	const validParamNames = new Set(typeDef?.params.map(p => p.name) || []);

	const cleaned: Record<string, unknown> = {};
	for (const [name, value] of Object.entries(node.params)) {
		// Skip empty values
		if (value === null || value === undefined || value === '') continue;
		// Keep internal UI params (e.g., _rotation) for layout
		if (name.startsWith('_')) {
			cleaned[name] = value;
			continue;
		}
		// Skip params not in type definition (dead params)
		if (!validParamNames.has(name)) continue;

		cleaned[name] = value;
	}
	return cleaned;
}

/**
 * Recursively clean params for a node and all nodes in its subsystem graph
 */
export function cleanNodeForExport(node: NodeInstance): NodeInstance {
	const cleaned = {
		...node,
		params: cleanNodeParams(node)
	};

	// Recursively clean subsystem graphs
	if (cleaned.graph?.nodes) {
		cleaned.graph = {
			...cleaned.graph,
			nodes: cleaned.graph.nodes.map(n => cleanNodeForExport(n))
		};
	}

	return cleaned;
}
