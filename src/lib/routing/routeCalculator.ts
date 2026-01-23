/**
 * Simple orthogonal route calculator
 */

import type { Position } from '$lib/types/common';
import type { Connection, Waypoint } from '$lib/types/nodes';
import type { RoutingContext, RouteResult, RouteSegment, Direction } from './types';
import { DIRECTION_VECTORS } from './types';
import { buildGrid, getGridOffset } from './gridBuilder';
import { findPathWithTurnPenalty } from './pathfinder';
import { simplifyPath, snapToGrid } from './pathOptimizer';
import { SOURCE_CLEARANCE, TARGET_CLEARANCE } from './constants';

/**
 * Calculate stub endpoint (grid-aligned point where stub ends)
 */
function getStubEnd(portPos: Position, direction: Direction, clearance: number): Position {
	const vec = DIRECTION_VECTORS[direction];
	const point = {
		x: portPos.x + vec.x * clearance,
		y: portPos.y + vec.y * clearance
	};
	return snapToGrid(point);
}

/**
 * Calculate route between two ports
 */
export function calculateRoute(
	connection: Connection,
	sourcePos: Position,
	targetPos: Position,
	sourceDir: Direction,
	targetDir: Direction,
	context: RoutingContext
): RouteResult {
	// Calculate stub endpoints (grid-aligned virtual ports for A*)
	const sourceStubEnd = getStubEnd(sourcePos, sourceDir, SOURCE_CLEARANCE);
	const targetStubEnd = getStubEnd(targetPos, targetDir, TARGET_CLEARANCE);

	// Build pathfinding grid
	const grid = buildGrid(context);
	const offset = getGridOffset(context);

	// Find path from source stub end to target stub end
	const rawPath = findPathWithTurnPenalty(sourceStubEnd, targetStubEnd, grid, offset, sourceDir);
	const simplified = simplifyPath(rawPath);

	// Path is: [sourceStubEnd, ...intermediates..., targetStubEnd]
	// simplifyPath already includes start and end
	const path = simplified;

	return {
		path,
		waypoints: [],
		segments: buildSegments(path)
	};
}

/**
 * Simple L-shaped route (no pathfinding)
 */
export function calculateSimpleRoute(
	sourcePos: Position,
	targetPos: Position,
	sourceDir: Direction = 'right',
	targetDir: Direction = 'left'
): RouteResult {
	const sourceStubEnd = getStubEnd(sourcePos, sourceDir, SOURCE_CLEARANCE);
	const targetStubEnd = getStubEnd(targetPos, targetDir, TARGET_CLEARANCE);

	// Simple L-shape: go in source direction, then turn toward target
	const path: Position[] = [sourceStubEnd];

	// Add corner if not aligned
	if (sourceStubEnd.x !== targetStubEnd.x && sourceStubEnd.y !== targetStubEnd.y) {
		if (sourceDir === 'right' || sourceDir === 'left') {
			// Horizontal first, then vertical
			path.push(snapToGrid({ x: targetStubEnd.x, y: sourceStubEnd.y }));
		} else {
			// Vertical first, then horizontal
			path.push(snapToGrid({ x: sourceStubEnd.x, y: targetStubEnd.y }));
		}
	}

	path.push(targetStubEnd);

	return {
		path,
		waypoints: [],
		segments: buildSegments(path)
	};
}

/**
 * Build segment info from path
 */
function buildSegments(path: Position[]): RouteSegment[] {
	const segments: RouteSegment[] = [];

	for (let i = 0; i < path.length - 1; i++) {
		const start = path[i];
		const end = path[i + 1];

		segments.push({
			index: i,
			startPoint: start,
			endPoint: end,
			isHorizontal: Math.abs(start.y - end.y) < 1,
			isUserSegment: false
		});
	}

	return segments;
}
