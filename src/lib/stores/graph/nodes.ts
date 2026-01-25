/**
 * Graph store - Node CRUD operations
 */

import { get } from 'svelte/store';
import type { NodeInstance, PortInstance, Connection, Annotation } from '$lib/nodes/types';
import type { Position } from '$lib/types';
import { nodeRegistry } from '$lib/nodes/registry';
import { NODE_TYPES } from '$lib/constants/nodeTypes';
import {
	rootNodes,
	rootConnections,
	currentPath,
	selectedNodeIds,
	generateId,
	getCurrentGraph,
	updateSubsystemGraph,
	addNodeToCurrentLevel,
	updateNodeById,
	updateCurrentNodes,
	updateCurrentConnections,
	updateCurrentNodesAndConnections,
	updateCurrentAnnotations
} from './state';
import { regenerateGraphIds, createPorts } from './helpers';
import { syncPortNamesFromLabels } from './ports';
import { triggerSelectNodes } from '$lib/stores/viewActions';
import { portLabelParams } from '$lib/nodes/uiConfig';

/**
 * Add a new node to the current graph context
 */
export function addNode(
	type: string,
	position: Position,
	name?: string
): NodeInstance | null {
	const typeDef = nodeRegistry.get(type);
	if (!typeDef) {
		console.error(`Unknown node type: ${type}`);
		return null;
	}

	const id = generateId();
	const node: NodeInstance = {
		id,
		type,
		name: name || typeDef.name,
		position,
		inputs: createPorts(id, 'input', typeDef.ports.inputs),
		outputs: createPorts(id, 'output', typeDef.ports.outputs),
		params: {} // Start empty - defaults shown as placeholders, code gen uses Python defaults
	};

	// If it's a Subsystem, initialize with empty graph and Interface
	if (type === NODE_TYPES.SUBSYSTEM) {
		const interfaceId = generateId();
		const interfaceNode: NodeInstance = {
			id: interfaceId,
			type: NODE_TYPES.INTERFACE,
			name: node.name,
			position: { x: 100, y: 100 },
			inputs: [],
			outputs: [],
			params: {}
		};
		node.graph = {
			nodes: [interfaceNode],
			connections: []
		};
	}

	addNodeToCurrentLevel(node);

	return node;
}

/**
 * Remove a node from the current graph context
 */
export function removeNode(id: string): void {
	const currentGraph = getCurrentGraph();
	const node = currentGraph.nodes.get(id);
	if (!node) return;

	// Prevent deletion of Interface blocks
	if (node.type === NODE_TYPES.INTERFACE) {
		console.warn('Interface blocks cannot be deleted');
		return;
	}

	// Remove node and its connections
	updateCurrentNodesAndConnections(
		// Map updater for nodes (root)
		nodes => {
			const newMap = new Map(nodes);
			newMap.delete(id);
			return newMap;
		},
		// Array updater for nodes (subsystem)
		nodes => nodes.filter(n => n.id !== id),
		// Connection updater (same for both levels)
		conns => conns.filter(c => c.sourceNodeId !== id && c.targetNodeId !== id)
	);

	selectedNodeIds.update(ids => {
		const newSet = new Set(ids);
		newSet.delete(id);
		return newSet;
	});
}

/**
 * Update a node's position
 */
export function updateNodePosition(id: string, position: Position): void {
	updateNodeById(id, node => ({ ...node, position: { ...position } }));
}

/**
 * Update a node's name
 * For Interface, updates the parent Subsystem's name
 */
export function updateNodeName(id: string, name: string): void {
	const currentGraph = getCurrentGraph();
	const node = currentGraph.nodes.get(id);
	if (!node) return;

	const path = get(currentPath);

	// If editing Interface, update parent Subsystem instead
	if (node.type === NODE_TYPES.INTERFACE && path.length > 0) {
		const parentPath = path.slice(0, -1);
		const parentId = path[path.length - 1];

		if (parentPath.length === 0) {
			// Parent is at root level
			rootNodes.update(n => {
				const parent = n.get(parentId);
				if (parent) {
					const newMap = new Map(n);
					newMap.set(parentId, { ...parent, name });
					return newMap;
				}
				return n;
			});
		} else {
			// Parent is in a subsystem
			updateSubsystemGraph(parentPath, graph => ({
				...graph,
				nodes: graph.nodes.map(n => n.id === parentId ? { ...n, name } : n)
			}));
		}
		return;
	}

	// Normal node name update
	updateNodeById(id, existing => ({ ...existing, name }));
}

/**
 * Update a node's color
 * For Interface, updates the parent Subsystem's color (Interface color is derived from parent)
 */
export function updateNodeColor(id: string, color: string | undefined): void {
	const currentGraph = getCurrentGraph();
	const node = currentGraph.nodes.get(id);
	if (!node) return;

	const path = get(currentPath);

	// If editing Interface, update parent Subsystem instead
	// (Interface color is derived from parent in getCurrentGraph)
	if (node.type === NODE_TYPES.INTERFACE && path.length > 0) {
		const parentPath = path.slice(0, -1);
		const parentId = path[path.length - 1];

		if (parentPath.length === 0) {
			// Parent is at root level
			rootNodes.update(n => {
				const parent = n.get(parentId);
				if (parent) {
					const newMap = new Map(n);
					newMap.set(parentId, { ...parent, color });
					return newMap;
				}
				return n;
			});
		} else {
			// Parent is in a subsystem
			updateSubsystemGraph(parentPath, graph => ({
				...graph,
				nodes: graph.nodes.map(n => n.id === parentId ? { ...n, color } : n)
			}));
		}
		return;
	}

	// Normal node color update (including Subsystem - Interface derives from it automatically)
	updateNodeById(id, n => ({ ...n, color }));
}

/**
 * Update a node's parameters
 */
export function updateNodeParams(id: string, params: Record<string, unknown>): void {
	updateNodeById(id, node => ({ ...node, params: { ...node.params, ...params } }));

	// Sync port names if this block has label-driven ports
	const node = getCurrentGraph().nodes.get(id);
	if (node) {
		const labelConfig = portLabelParams[node.type];
		if (labelConfig && labelConfig.param in params) {
			syncPortNamesFromLabels(id, params[labelConfig.param], labelConfig.direction);
		}
	}
}

/**
 * Update a node's properties (generic update for any field)
 */
export function updateNode(id: string, updates: Partial<NodeInstance>): void {
	updateNodeById(id, node => ({ ...node, ...updates }));
}

/**
 * Get a node by ID (searches current context)
 */
export function getNode(id: string): NodeInstance | undefined {
	return getCurrentGraph().nodes.get(id);
}

/**
 * Get all nodes recursively (for code generation)
 */
export function getAllNodes(): NodeInstance[] {
	const all: NodeInstance[] = [];
	const collectNodes = (nodes: NodeInstance[]) => {
		for (const node of nodes) {
			all.push(node);
			if (node.graph) {
				collectNodes(node.graph.nodes);
			}
		}
	};
	collectNodes(Array.from(get(rootNodes).values()));
	return all;
}

/**
 * Duplicate selected nodes, annotations, and connections between them
 */
export function duplicateSelected(): string[] {
	const selected = get(selectedNodeIds);
	if (selected.size === 0) return [];

	const currentGraph = getCurrentGraph();
	const newNodeIds: string[] = [];
	const newAnnotationIds: string[] = [];
	const offset = { x: 50, y: 50 };

	// Map from old node ID to new node ID (for connection remapping)
	const nodeIdMap = new Map<string, string>();

	// Build list of new nodes to add
	const nodesToAdd: NodeInstance[] = [];

	// Build list of new annotations to add
	const annotationsToAdd: Annotation[] = [];

	selected.forEach(id => {
		// Check if this is an annotation
		const annotation = currentGraph.annotations.get(id);
		if (annotation) {
			const newId = generateId();
			const newAnnotation: Annotation = {
				...annotation,
				id: newId,
				position: {
					x: annotation.position.x + offset.x,
					y: annotation.position.y + offset.y
				}
			};
			annotationsToAdd.push(newAnnotation);
			newAnnotationIds.push(newId);
			return;
		}

		const original = currentGraph.nodes.get(id);
		if (!original) return;
		if (original.type === NODE_TYPES.INTERFACE) return; // Don't duplicate Interface

		const newId = generateId();
		nodeIdMap.set(id, newId);

		const newNode: NodeInstance = {
			id: newId,
			type: original.type,
			name: original.name,
			position: {
				x: original.position.x + offset.x,
				y: original.position.y + offset.y
			},
			inputs: original.inputs.map((port, index) => ({
				...port,
				id: `${newId}-input-${index}`,
				nodeId: newId
			})),
			outputs: original.outputs.map((port, index) => ({
				...port,
				id: `${newId}-output-${index}`,
				nodeId: newId
			})),
			// Deep clone params to avoid shared references
			params: JSON.parse(JSON.stringify(original.params)),
			// Copy pinnedParams array if present
			pinnedParams: original.pinnedParams ? [...original.pinnedParams] : undefined,
			color: original.color
		};

		// Deep copy and regenerate IDs for subsystem graphs (handles nested subsystems)
		if (original.graph) {
			const clonedGraph = JSON.parse(JSON.stringify(original.graph));
			newNode.graph = regenerateGraphIds(clonedGraph);
		}

		nodesToAdd.push(newNode);
		newNodeIds.push(newId);
	});

	// Build list of new connections
	const connections = currentGraph.connections;
	const newConnections: Connection[] = [];

	for (const conn of connections) {
		// Only duplicate if BOTH source and target were in the selection
		const newSourceId = nodeIdMap.get(conn.sourceNodeId);
		const newTargetId = nodeIdMap.get(conn.targetNodeId);

		if (newSourceId && newTargetId) {
			newConnections.push({
				id: generateId(),
				sourceNodeId: newSourceId,
				sourcePortIndex: conn.sourcePortIndex,
				targetNodeId: newTargetId,
				targetPortIndex: conn.targetPortIndex
			});
		}
	}

	// Add all nodes and connections in one update
	if (nodesToAdd.length > 0 || newConnections.length > 0) {
		updateCurrentNodesAndConnections(
			// Map updater for nodes (root)
			nodes => {
				const newMap = new Map(nodes);
				for (const node of nodesToAdd) {
					newMap.set(node.id, node);
				}
				return newMap;
			},
			// Array updater for nodes (subsystem)
			nodes => [...nodes, ...nodesToAdd],
			// Connection updater
			conns => [...conns, ...newConnections]
		);
	}

	// Add annotations
	if (annotationsToAdd.length > 0) {
		updateCurrentAnnotations(
			// Map updater (root)
			a => {
				const newMap = new Map(a);
				for (const annotation of annotationsToAdd) {
					newMap.set(annotation.id, annotation);
				}
				return newMap;
			},
			// Array updater (subsystem)
			a => [...a, ...annotationsToAdd]
		);
	}

	// Select all new items
	const allNewIds = [...newNodeIds, ...newAnnotationIds];
	if (allNewIds.length > 0) {
		triggerSelectNodes(allNewIds, false);
	}

	return allNewIds;
}

/**
 * Nudge selected nodes by a delta
 */
export function nudgeSelectedNodes(delta: Position): void {
	const selected = get(selectedNodeIds);
	if (selected.size === 0) return;

	const nudgePosition = (node: NodeInstance) => ({
		...node,
		position: {
			x: node.position.x + delta.x,
			y: node.position.y + delta.y
		}
	});

	updateCurrentNodes(
		// Map updater (root)
		nodes => {
			const newMap = new Map(nodes);
			selected.forEach(id => {
				const node = newMap.get(id);
				if (node) {
					newMap.set(id, nudgePosition(node));
				}
			});
			return newMap;
		},
		// Array updater (subsystem)
		nodes => nodes.map(n => selected.has(n.id) ? nudgePosition(n) : n)
	);
}

/**
 * Paste pre-built nodes and connections into the current graph context
 * Used by clipboard paste operation
 * @returns IDs of pasted nodes
 */
export function pasteNodes(
	nodes: NodeInstance[],
	connections: Connection[]
): string[] {
	if (nodes.length === 0) return [];

	const newNodeIds = nodes.map(n => n.id);

	// Add all nodes and connections
	updateCurrentNodesAndConnections(
		// Map updater for nodes (root)
		existingNodes => {
			const newMap = new Map(existingNodes);
			for (const node of nodes) {
				newMap.set(node.id, node);
			}
			return newMap;
		},
		// Array updater for nodes (subsystem)
		existingNodes => [...existingNodes, ...nodes],
		// Connection updater
		existingConns => [...existingConns, ...connections]
	);

	// Select the pasted nodes
	triggerSelectNodes(newNodeIds, false);

	return newNodeIds;
}
