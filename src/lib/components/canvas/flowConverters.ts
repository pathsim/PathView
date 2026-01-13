/**
 * Converters between PathView types and SvelteFlow types
 */

import type { Node, Edge } from '@xyflow/svelte';
import type { NodeInstance, Connection, Annotation } from '$lib/nodes/types';
import type { EventInstance } from '$lib/events/types';
import { HANDLE_ID } from '$lib/constants/handles';

/**
 * Convert a NodeInstance to a SvelteFlow Node
 */
export function toFlowNode(node: NodeInstance, options: { deletable?: boolean } = {}): Node<NodeInstance> {
	return {
		id: node.id,
		type: 'pathview',
		position: { ...node.position },
		data: node,
		selectable: true,
		draggable: true,
		deletable: options.deletable ?? true
	};
}

/**
 * Convert an EventInstance to a SvelteFlow Node
 */
export function toEventNode(event: EventInstance): Node<EventInstance> {
	return {
		id: event.id,
		type: 'eventNode',
		position: { ...event.position },
		data: event,
		selectable: true,
		draggable: true,
		connectable: false,
		deletable: true
	};
}

/**
 * Convert an Annotation to a SvelteFlow Node
 */
export function toAnnotationNode(annotation: Annotation): Node<Annotation> {
	return {
		id: annotation.id,
		type: 'annotation',
		position: { ...annotation.position },
		data: annotation,
		width: annotation.width,
		height: annotation.height,
		selectable: true,
		draggable: true,
		connectable: false,
		deletable: true
	};
}

/**
 * Convert a Connection to a SvelteFlow Edge
 */
export function toFlowEdge(conn: Connection): Edge {
	return {
		id: conn.id,
		source: conn.sourceNodeId,
		sourceHandle: HANDLE_ID.output(conn.sourceNodeId, conn.sourcePortIndex),
		target: conn.targetNodeId,
		targetHandle: HANDLE_ID.input(conn.targetNodeId, conn.targetPortIndex),
		type: 'arrow',
		selectable: true,
		deletable: true,
		animated: false
	};
}

/**
 * Parse port index from a SvelteFlow handle ID
 * Handle format: "{nodeId}-{direction}-{index}" e.g., "node1-output-0"
 * @deprecated Use HANDLE_ID.parseIndex instead
 */
export function parseHandlePort(handle: string, direction: 'input' | 'output'): number | null {
	return HANDLE_ID.parseIndex(handle, direction);
}
