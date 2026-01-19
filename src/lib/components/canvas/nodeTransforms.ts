/**
 * Node transformation utilities for rotation and flipping
 */

import { graphStore } from '$lib/stores/graph';
import { historyStore } from '$lib/stores/history';
import type { Node } from '@xyflow/svelte';

/** Rotation values: 0=normal, 1=90°, 2=180°, 3=270° */
type RotationValue = 0 | 1 | 2 | 3;

/** Get current rotation value from node params */
function getRotation(nodeId: string): RotationValue {
	const node = graphStore.getNode(nodeId);
	return ((node?.params?.['_rotation'] as number) || 0) as RotationValue;
}

/** Calculate next rotation (90° clockwise) */
function rotateClockwise(current: RotationValue): RotationValue {
	return ((current + 1) % 4) as RotationValue;
}

/** Horizontal flip: swaps 0 <-> 2, leaves 1 and 3 unchanged */
function flipHorizontal(current: RotationValue): RotationValue {
	if (current === 0) return 2;
	if (current === 2) return 0;
	return current;
}

/** Vertical flip: swaps 1 <-> 3, leaves 0 and 2 unchanged */
function flipVertical(current: RotationValue): RotationValue {
	if (current === 1) return 3;
	if (current === 3) return 1;
	return current;
}

/**
 * Apply rotation transform to selected nodes
 * Returns array of node IDs that were updated
 */
export function rotateSelectedNodes(nodes: Node[]): string[] {
	const selectedNodes = nodes.filter((n) => n.selected);
	if (selectedNodes.length === 0) return [];

	return historyStore.mutate(() => {
		const updated: string[] = [];
		for (const flowNode of selectedNodes) {
			const current = getRotation(flowNode.id);
			const newRotation = rotateClockwise(current);
			graphStore.updateNodeParams(flowNode.id, { _rotation: newRotation });
			updated.push(flowNode.id);
		}
		return updated;
	});
}

/**
 * Apply horizontal flip to selected nodes
 * Returns array of node IDs that were updated
 */
export function flipSelectedNodesHorizontal(nodes: Node[]): string[] {
	const selectedNodes = nodes.filter((n) => n.selected);
	if (selectedNodes.length === 0) return [];

	return historyStore.mutate(() => {
		const updated: string[] = [];
		for (const flowNode of selectedNodes) {
			const current = getRotation(flowNode.id);
			const newRotation = flipHorizontal(current);
			if (newRotation !== current) {
				graphStore.updateNodeParams(flowNode.id, { _rotation: newRotation });
				updated.push(flowNode.id);
			}
		}
		return updated;
	});
}

/**
 * Apply vertical flip to selected nodes
 * Returns array of node IDs that were updated
 */
export function flipSelectedNodesVertical(nodes: Node[]): string[] {
	const selectedNodes = nodes.filter((n) => n.selected);
	if (selectedNodes.length === 0) return [];

	return historyStore.mutate(() => {
		const updated: string[] = [];
		for (const flowNode of selectedNodes) {
			const current = getRotation(flowNode.id);
			const newRotation = flipVertical(current);
			if (newRotation !== current) {
				graphStore.updateNodeParams(flowNode.id, { _rotation: newRotation });
				updated.push(flowNode.id);
			}
		}
		return updated;
	});
}
