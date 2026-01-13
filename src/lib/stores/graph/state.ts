/**
 * Graph store - Core state (writable and derived stores)
 */

import { writable, derived, get } from 'svelte/store';
import type { NodeInstance, Connection, SubsystemGraph, Annotation } from '$lib/nodes/types';
import type { EventInstance } from '$lib/events/types';
import { NODE_TYPES } from '$lib/constants/nodeTypes';

/**
 * Node with path information for global search
 */
export interface SearchableNode {
	node: NodeInstance;
	path: string[];        // Subsystem IDs: [] = root, ['sub1'] = inside sub1
	pathNames: string[];   // Display names: ['Root'] or ['Root', 'SubsystemA']
	depth: number;         // 0 = root level
}

// ==================== WRITABLE STORES ====================

/** Root level nodes */
export const rootNodes = writable<Map<string, NodeInstance>>(new Map());

/** Root level connections */
export const rootConnections = writable<Connection[]>([]);

/** Root level annotations */
export const rootAnnotations = writable<Map<string, Annotation>>(new Map());

/** Navigation path: [] = root, ['sub1'] = inside sub1, ['sub1', 'sub2'] = nested */
export const currentPath = writable<string[]>([]);

/** Selected node IDs (within current context) */
export const selectedNodeIds = writable<Set<string>>(new Set());

// ==================== RE-EXPORTS ====================

// Re-export generateId from utils for backwards compatibility
export { generateId } from '$lib/stores/utils';

// ==================== HELPER FUNCTIONS ====================

/**
 * Get a subsystem node by following a path from root
 */
export function getSubsystemByPath(path: string[]): NodeInstance | null {
	if (path.length === 0) return null;

	let currentNodes = get(rootNodes);
	let subsystem: NodeInstance | null = null;

	for (let i = 0; i < path.length; i++) {
		const node = currentNodes.get(path[i]);
		if (!node || node.type !== NODE_TYPES.SUBSYSTEM) return null;
		subsystem = node;
		if (i < path.length - 1 && node.graph) {
			currentNodes = new Map(node.graph.nodes.map(n => [n.id, n]));
		}
	}

	return subsystem;
}

/**
 * Get the current graph (nodes/connections/annotations/events) based on navigation path
 */
export function getCurrentGraph(): {
	nodes: Map<string, NodeInstance>;
	connections: Connection[];
	annotations: Map<string, Annotation>;
	events: Map<string, EventInstance>;
} {
	const path = get(currentPath);

	if (path.length === 0) {
		// Root level - events are managed by eventStore, return empty map here
		return {
			nodes: get(rootNodes),
			connections: get(rootConnections),
			annotations: get(rootAnnotations),
			events: new Map()
		};
	}

	const subsystem = getSubsystemByPath(path);
	if (!subsystem || !subsystem.graph) {
		return { nodes: new Map(), connections: [], annotations: new Map(), events: new Map() };
	}

	// For Interface node, derive name/color/ports from parent Subsystem
	const nodesWithDerivedInterface = subsystem.graph.nodes.map(node => {
		if (node.type === NODE_TYPES.INTERFACE) {
			return {
				...node,
				name: subsystem.name,
				color: subsystem.color,
				// Subsystem inputs → Interface outputs (signals coming in)
				outputs: subsystem.inputs.map((port, i) => ({
					id: `${node.id}-output-${i}`,
					nodeId: node.id,
					name: `in ${i}`,
					direction: 'output' as const,
					index: i,
					color: port.color
				})),
				// Subsystem outputs → Interface inputs (signals going out)
				inputs: subsystem.outputs.map((port, i) => ({
					id: `${node.id}-input-${i}`,
					nodeId: node.id,
					name: `out ${i}`,
					direction: 'input' as const,
					index: i,
					color: port.color
				}))
			};
		}
		return node;
	});

	return {
		nodes: new Map(nodesWithDerivedInterface.map(n => [n.id, n])),
		connections: subsystem.graph.connections,
		annotations: new Map((subsystem.graph.annotations || []).map(a => [a.id, a])),
		events: new Map((subsystem.graph.events || []).map(e => [e.id, e]))
	};
}

/**
 * Update a subsystem's graph by path
 */
export function updateSubsystemGraph(
	path: string[],
	updater: (graph: SubsystemGraph) => SubsystemGraph
): void {
	if (path.length === 0) return;

	rootNodes.update(root => {
		const newRoot = new Map(root);

		// Navigate to parent and update the subsystem
		const updateNested = (nodes: Map<string, NodeInstance>, remainingPath: string[]): Map<string, NodeInstance> => {
			if (remainingPath.length === 0) return nodes;

			const [currentId, ...rest] = remainingPath;
			const node = nodes.get(currentId);

			if (!node || node.type !== NODE_TYPES.SUBSYSTEM) return nodes;

			const newNodes = new Map(nodes);

			if (rest.length === 0) {
				// This is the target subsystem
				const newGraph = updater(node.graph || { nodes: [], connections: [] });
				newNodes.set(currentId, { ...node, graph: newGraph });
			} else {
				// Need to go deeper - preserve all graph properties (annotations, events)
				const childNodes = new Map((node.graph?.nodes || []).map(n => [n.id, n]));
				const updatedChildNodes = updateNested(childNodes, rest);
				newNodes.set(currentId, {
					...node,
					graph: {
						nodes: Array.from(updatedChildNodes.values()),
						connections: node.graph?.connections || [],
						annotations: node.graph?.annotations,
						events: node.graph?.events
					}
				});
			}

			return newNodes;
		};

		return updateNested(newRoot, path);
	});
}

/**
 * Get the parent Subsystem node (for Interface operations)
 */
export function getParentSubsystem(): NodeInstance | null {
	const path = get(currentPath);
	if (path.length === 0) return null;
	return getSubsystemByPath(path);
}

// ==================== LEVEL-AWARE UPDATE HELPERS ====================

/**
 * Update nodes at the current level (root or subsystem)
 * Handles the Map vs Array difference between root and subsystem levels
 */
export function updateCurrentNodes(
	mapUpdater: (nodes: Map<string, NodeInstance>) => Map<string, NodeInstance>,
	arrayUpdater: (nodes: NodeInstance[]) => NodeInstance[]
): void {
	const path = get(currentPath);

	if (path.length === 0) {
		rootNodes.update(mapUpdater);
	} else {
		updateSubsystemGraph(path, graph => ({
			...graph,
			nodes: arrayUpdater(graph.nodes)
		}));
	}
}

/**
 * Update a single node by ID at the current level
 * Returns true if the node was found and updated
 */
export function updateNodeById(
	id: string,
	transform: (node: NodeInstance) => NodeInstance
): void {
	updateCurrentNodes(
		// Map updater (root)
		nodes => {
			const node = nodes.get(id);
			if (node) {
				const newMap = new Map(nodes);
				newMap.set(id, transform(node));
				return newMap;
			}
			return nodes;
		},
		// Array updater (subsystem)
		nodes => nodes.map(n => n.id === id ? transform(n) : n)
	);
}

/**
 * Add a node at the current level
 */
export function addNodeToCurrentLevel(node: NodeInstance): void {
	updateCurrentNodes(
		nodes => {
			const newMap = new Map(nodes);
			newMap.set(node.id, node);
			return newMap;
		},
		nodes => [...nodes, node]
	);
}

/**
 * Remove a node by ID at the current level
 */
export function removeNodeFromCurrentLevel(id: string): void {
	updateCurrentNodes(
		nodes => {
			const newMap = new Map(nodes);
			newMap.delete(id);
			return newMap;
		},
		nodes => nodes.filter(n => n.id !== id)
	);
}

/**
 * Update connections at the current level
 * Both root and subsystem use arrays, so only one updater needed
 */
export function updateCurrentConnections(
	updater: (connections: Connection[]) => Connection[]
): void {
	const path = get(currentPath);

	if (path.length === 0) {
		rootConnections.update(updater);
	} else {
		updateSubsystemGraph(path, graph => ({
			...graph,
			connections: updater(graph.connections)
		}));
	}
}

/**
 * Update both nodes and connections at the current level.
 *
 * Note: At root level, this performs two separate store updates (not truly atomic).
 * Subscribers may briefly see intermediate state. This is acceptable because:
 * 1. Each individual store update is atomic
 * 2. Svelte batches synchronous updates before re-rendering
 * 3. History snapshots are taken before this is called
 *
 * At subsystem level, the update is truly atomic (single store update).
 */
export function updateCurrentNodesAndConnections(
	nodeMapUpdater: (nodes: Map<string, NodeInstance>) => Map<string, NodeInstance>,
	nodeArrayUpdater: (nodes: NodeInstance[]) => NodeInstance[],
	connectionUpdater: (connections: Connection[]) => Connection[]
): void {
	const path = get(currentPath);

	if (path.length === 0) {
		rootNodes.update(nodeMapUpdater);
		rootConnections.update(connectionUpdater);
	} else {
		updateSubsystemGraph(path, graph => ({
			...graph,
			nodes: nodeArrayUpdater(graph.nodes),
			connections: connectionUpdater(graph.connections)
		}));
	}
}

/**
 * Update annotations at the current level
 * Handles the Map vs Array difference between root and subsystem levels
 */
export function updateCurrentAnnotations(
	mapUpdater: (annotations: Map<string, Annotation>) => Map<string, Annotation>,
	arrayUpdater: (annotations: Annotation[]) => Annotation[]
): void {
	const path = get(currentPath);

	if (path.length === 0) {
		rootAnnotations.update(mapUpdater);
	} else {
		updateSubsystemGraph(path, graph => ({
			...graph,
			annotations: arrayUpdater(graph.annotations || [])
		}));
	}
}

/**
 * Check if we're currently at root level
 */
export function isAtRootLevel(): boolean {
	return get(currentPath).length === 0;
}

// ==================== DERIVED STORES ====================

/** Current context nodes (based on navigation path) */
export const currentNodes = derived(
	[rootNodes, currentPath],
	() => getCurrentGraph().nodes
);

/** Current context connections */
export const currentConnections = derived(
	[rootNodes, rootConnections, currentPath],
	() => getCurrentGraph().connections
);

/** Current context annotations */
export const currentAnnotations = derived(
	[rootNodes, rootAnnotations, currentPath],
	() => getCurrentGraph().annotations
);

/** Subsystem events (root events are in eventStore) */
export const currentSubsystemEvents = derived(
	[rootNodes, currentPath],
	() => getCurrentGraph().events
);

/** Nodes as array */
export const nodesArray = derived(currentNodes, ($nodes) => Array.from($nodes.values()));

/** Selected nodes */
export const selectedNodes = derived([currentNodes, selectedNodeIds], ([$nodes, $selectedIds]) =>
	Array.from($selectedIds)
		.map((id) => $nodes.get(id))
		.filter((n): n is NodeInstance => n !== undefined)
);

/** Breadcrumbs for navigation UI */
export const breadcrumbs = derived([rootNodes, currentPath], ([$rootNodes, $path]) => {
	const crumbs: { id: string; name: string }[] = [{ id: '', name: 'Root' }];

	let currentNodes = $rootNodes;
	for (const subsystemId of $path) {
		const node = currentNodes.get(subsystemId);
		if (node && node.type === NODE_TYPES.SUBSYSTEM) {
			crumbs.push({ id: subsystemId, name: node.name });
			if (node.graph) {
				currentNodes = new Map(node.graph.nodes.map(n => [n.id, n]));
			}
		}
	}

	return crumbs;
});
