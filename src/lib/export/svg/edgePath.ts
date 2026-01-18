/**
 * Edge path utilities for SVG export
 *
 * Uses @xyflow/svelte's getSmoothStepPath for path generation
 * and provides pure functions for arrow positioning
 */

import { getSmoothStepPath, type Position } from '@xyflow/svelte';

/** Edge endpoint offsets to align with handle tips */
export const EDGE_OFFSETS = {
	source: 0.5,
	target: 4.5
} as const;

/** Arrow head path (same as ArrowEdge.svelte) */
export const ARROW_PATH =
	'M -5 -2.5 L -1 -0.5 Q 0 0 -1 0.5 L -5 2.5 Q -6 3 -6 2 L -6 -2 Q -6 -3 -5 -2.5 Z';

/** Arrow offset to reach target handle tip */
export const ARROW_FORWARD_OFFSET = 5;

export interface EdgePathOptions {
	sourceX: number;
	sourceY: number;
	sourcePosition: Position;
	targetX: number;
	targetY: number;
	targetPosition: Position;
	borderRadius?: number;
}

export interface EdgePathResult {
	path: string;
	arrow: {
		x: number;
		y: number;
		angle: number;
	};
}

/**
 * Adjust source position to start at handle tip
 */
function adjustSource(x: number, y: number, position: Position): { x: number; y: number } {
	const offset = EDGE_OFFSETS.source;
	switch (position) {
		case 'right':
			return { x: x - offset, y };
		case 'left':
			return { x: x + offset, y };
		case 'bottom':
			return { x, y: y - offset };
		case 'top':
			return { x, y: y + offset };
		default:
			return { x, y };
	}
}

/**
 * Adjust target position to end at handle tip
 */
function adjustTarget(x: number, y: number, position: Position): { x: number; y: number } {
	const offset = EDGE_OFFSETS.target;
	switch (position) {
		case 'right':
			return { x: x + offset, y };
		case 'left':
			return { x: x - offset, y };
		case 'bottom':
			return { x, y: y + offset };
		case 'top':
			return { x, y: y - offset };
		default:
			return { x, y };
	}
}

/**
 * Calculate arrow position and angle from target position
 * Pure implementation without DOM
 *
 * The arrow points INTO the target handle (direction of flow entering the node)
 * targetPosition indicates which side of the node the handle is on
 */
function calculateArrowTransform(
	targetX: number,
	targetY: number,
	targetPosition: Position
): { x: number; y: number; angle: number } {
	// Arrow points INTO the handle (opposite direction of targetPosition)
	// Arrow path shape points right by default, so angle=0 means pointing right
	let angle: number;
	let offsetX = 0;
	let offsetY = 0;

	switch (targetPosition) {
		case 'left':
			// Handle on left side, edge enters from left → arrow points RIGHT (into node)
			angle = 0;
			offsetX = -ARROW_FORWARD_OFFSET;
			break;
		case 'right':
			// Handle on right side, edge enters from right → arrow points LEFT (into node)
			angle = 180;
			offsetX = ARROW_FORWARD_OFFSET;
			break;
		case 'top':
			// Handle on top, edge enters from above → arrow points DOWN (into node)
			angle = 90;
			offsetY = -ARROW_FORWARD_OFFSET;
			break;
		case 'bottom':
			// Handle on bottom, edge enters from below → arrow points UP (into node)
			angle = -90;
			offsetY = ARROW_FORWARD_OFFSET;
			break;
		default:
			angle = 0;
	}

	return {
		x: targetX + offsetX,
		y: targetY + offsetY,
		angle
	};
}

/**
 * Generate edge path and arrow transform
 * Pure function - no DOM required
 */
export function getEdgePath(options: EdgePathOptions): EdgePathResult {
	const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius = 8 } =
		options;

	// Adjust endpoints to handle tips
	const source = adjustSource(sourceX, sourceY, sourcePosition);
	const target = adjustTarget(targetX, targetY, targetPosition);

	// Get smooth step path from @xyflow
	const [path] = getSmoothStepPath({
		sourceX: source.x,
		sourceY: source.y,
		sourcePosition,
		targetX: target.x,
		targetY: target.y,
		targetPosition,
		borderRadius
	});

	// Calculate arrow position and angle
	const arrow = calculateArrowTransform(target.x, target.y, targetPosition);

	return { path, arrow };
}
