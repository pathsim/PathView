/**
 * Graph store helper utilities
 * Pure functions that don't depend on store state
 */

import type { PortInstance, NodeInstance, SubsystemGraph, Connection } from '$lib/nodes/types';
import { PORT_COLORS } from '$lib/utils/colors';
import { NODE_TYPES } from '$lib/constants/nodeTypes';

// Import and re-export generateId from utils (canonical location)
import { generateId } from '$lib/stores/utils';
export { generateId };

/**
 * Create port instances from port definitions
 */
export function createPorts(
	nodeId: string,
	direction: 'input' | 'output',
	portDefs: { name: string; color?: string }[]
): PortInstance[] {
	return portDefs.map((def, index) => ({
		id: `${nodeId}-${direction}-${index}`,
		nodeId,
		name: def.name,
		direction,
		index,
		color: def.color || PORT_COLORS.default
	}));
}

/**
 * Get a subsystem node by following a path through the graph
 */
export function getSubsystemByPath(
	rootNodes: Map<string, NodeInstance>,
	path: string[]
): NodeInstance | null {
	if (path.length === 0) return null;

	let currentNodes = rootNodes;
	let subsystem: NodeInstance | null = null;

	for (let i = 0; i < path.length; i++) {
		const node = currentNodes.get(path[i]);
		if (!node || node.type !== NODE_TYPES.SUBSYSTEM) return null;
		subsystem = node;
		if (i < path.length - 1 && node.graph) {
			currentNodes = new Map(node.graph.nodes.map((n) => [n.id, n]));
		}
	}

	return subsystem;
}

/**
 * Derive Interface node ports from parent Subsystem
 * Interface outputs = Subsystem inputs (signals coming in)
 * Interface inputs = Subsystem outputs (signals going out)
 */
export function deriveInterfaceNode(
	interfaceNode: NodeInstance,
	parentSubsystem: NodeInstance
): NodeInstance {
	return {
		...interfaceNode,
		name: parentSubsystem.name,
		color: parentSubsystem.color,
		outputs: parentSubsystem.inputs.map((port, i) => ({
			id: `${interfaceNode.id}-output-${i}`,
			nodeId: interfaceNode.id,
			name: `in ${i}`,
			direction: 'output' as const,
			index: i,
			color: port.color
		})),
		inputs: parentSubsystem.outputs.map((port, i) => ({
			id: `${interfaceNode.id}-input-${i}`,
			nodeId: interfaceNode.id,
			name: `out ${i}`,
			direction: 'input' as const,
			index: i,
			color: port.color
		}))
	};
}

/**
 * Collect all nodes recursively from a subsystem hierarchy
 */
export function collectAllNodes(nodes: NodeInstance[]): NodeInstance[] {
	const result: NodeInstance[] = [];

	function collect(nodeList: NodeInstance[]) {
		for (const node of nodeList) {
			result.push(node);
			if (node.type === NODE_TYPES.SUBSYSTEM && node.graph) {
				collect(node.graph.nodes);
			}
		}
	}

	collect(nodes);
	return result;
}

/**
 * Collect all connections recursively, including those in subsystems
 */
export function collectAllConnections(
	rootConnections: Connection[],
	rootNodes: NodeInstance[]
): { connection: Connection; subsystemId?: string }[] {
	const result: { connection: Connection; subsystemId?: string }[] = [];

	// Add root connections
	for (const conn of rootConnections) {
		result.push({ connection: conn });
	}

	// Recursively collect from subsystems
	function collectFromNodes(nodes: NodeInstance[], parentPath: string[]) {
		for (const node of nodes) {
			if (node.type === NODE_TYPES.SUBSYSTEM && node.graph) {
				for (const conn of node.graph.connections) {
					result.push({ connection: conn, subsystemId: node.id });
				}
				collectFromNodes(node.graph.nodes, [...parentPath, node.id]);
			}
		}
	}

	collectFromNodes(rootNodes, []);
	return result;
}

/**
 * Check if a node is of type Subsystem
 */
export function isSubsystemNode(node: NodeInstance): boolean {
	return node.type === NODE_TYPES.SUBSYSTEM;
}

/**
 * Check if a node is of type Interface
 */
export function isInterfaceNode(node: NodeInstance): boolean {
	return node.type === NODE_TYPES.INTERFACE;
}

/**
 * Find the parent Subsystem that contains a given Interface node
 */
export function findParentSubsystem(nodes: NodeInstance[], interfaceId: string): NodeInstance | null {
	for (const node of nodes) {
		if (node.type === NODE_TYPES.SUBSYSTEM && node.graph) {
			// Check if this subsystem contains the interface
			const hasInterface = node.graph.nodes.some(n => n.id === interfaceId);
			if (hasInterface) {
				return node;
			}
			// Recursively check nested subsystems
			const found = findParentSubsystem(node.graph.nodes, interfaceId);
			if (found) return found;
		}
	}
	return null;
}

/**
 * Clone a node for duplication
 * Creates a deep copy to avoid shared references
 */
export function cloneNode(
	node: NodeInstance,
	newId: string,
	positionOffset: { x: number; y: number }
): NodeInstance {
	return {
		id: newId,
		type: node.type,
		name: node.name,
		position: {
			x: node.position.x + positionOffset.x,
			y: node.position.y + positionOffset.y
		},
		inputs: createPorts(
			newId,
			'input',
			node.inputs.map((p) => ({ name: p.name, color: p.color }))
		),
		outputs: createPorts(
			newId,
			'output',
			node.outputs.map((p) => ({ name: p.name, color: p.color }))
		),
		// Deep clone params to avoid shared references
		params: JSON.parse(JSON.stringify(node.params)),
		// Copy pinnedParams array if present
		pinnedParams: node.pinnedParams ? [...node.pinnedParams] : undefined,
		color: node.color,
		// Deep clone graph for subsystems
		graph: node.graph ? JSON.parse(JSON.stringify(node.graph)) : undefined
	};
}

/**
 * Update ports array with new port count
 */
export function resizePorts(
	nodeId: string,
	currentPorts: PortInstance[],
	newCount: number,
	direction: 'input' | 'output'
): PortInstance[] {
	if (newCount < currentPorts.length) {
		// Remove ports from the end
		return currentPorts.slice(0, newCount);
	} else if (newCount > currentPorts.length) {
		// Add new ports
		const newPorts = [...currentPorts];
		for (let i = currentPorts.length; i < newCount; i++) {
			newPorts.push({
				id: `${nodeId}-${direction}-${i}`,
				nodeId,
				name: direction === 'input' ? `in ${i}` : `out ${i}`,
				direction,
				index: i,
				color: PORT_COLORS.default
			});
		}
		return newPorts;
	}
	return currentPorts;
}

/**
 * Recursively regenerate all IDs in a subsystem graph
 * Handles nested subsystems at any depth
 */
export function regenerateGraphIds(graph: SubsystemGraph): SubsystemGraph {
	const idMap = new Map<string, string>();

	// First pass: generate new IDs for all nodes
	const newNodes = graph.nodes.map(node => {
		const newId = generateId();
		idMap.set(node.id, newId);

		const newNode: NodeInstance = {
			...node,
			id: newId,
			inputs: node.inputs.map((p, i) => ({ ...p, id: `${newId}-input-${i}`, nodeId: newId })),
			outputs: node.outputs.map((p, i) => ({ ...p, id: `${newId}-output-${i}`, nodeId: newId }))
		};

		// Recursively handle nested subsystems
		if (newNode.graph) {
			newNode.graph = regenerateGraphIds(newNode.graph);
		}

		return newNode;
	});

	// Remap connections
	const newConnections = graph.connections.map(c => ({
		...c,
		id: generateId(),
		sourceNodeId: idMap.get(c.sourceNodeId) || c.sourceNodeId,
		targetNodeId: idMap.get(c.targetNodeId) || c.targetNodeId
	}));

	// Regenerate event IDs
	const newEvents = graph.events?.map(e => ({
		...e,
		id: generateId()
	}));

	// Regenerate annotation IDs
	const newAnnotations = graph.annotations?.map(a => ({
		...a,
		id: generateId()
	}));

	return {
		nodes: newNodes,
		connections: newConnections,
		events: newEvents,
		annotations: newAnnotations
	};
}
