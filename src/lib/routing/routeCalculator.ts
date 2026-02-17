/**
 * Simple orthogonal route calculator
 */

import type { Position } from '$lib/types/common';
import type { Waypoint } from '$lib/types/nodes';
import type { RoutingContext, RouteResult, Direction } from './types';
import { DIRECTION_VECTORS } from './types';
import { worldToGrid, type SparseGrid } from './gridBuilder';
import { findPathWithTurnPenalty } from './pathfinder';
import { simplifyPath, snapToGrid } from './pathOptimizer';
import { SOURCE_CLEARANCE, TARGET_CLEARANCE, GRID_SIZE } from './constants';

/** Number of cells to skip at path start for shared source port overlap */
const SHARED_SOURCE_CELLS = 2;

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
 * @param grid - Sparse grid with obstacles (from routing store)
 * @param usedCells - Optional map of cells to directions used by other paths
 */
export function calculateRoute(
	sourcePos: Position,
	targetPos: Position,
	sourceDir: Direction,
	targetDir: Direction,
	grid: SparseGrid,
	usedCells?: Map<string, Set<Direction>>
): RouteResult {
	// Calculate stub endpoints (grid-aligned virtual ports for A*)
	const sourceStubEnd = getStubEnd(sourcePos, sourceDir, SOURCE_CLEARANCE);
	const targetStubEnd = getStubEnd(targetPos, targetDir, TARGET_CLEARANCE);

	const offset = grid.getOffset();

	// Find path from source stub end to target stub end
	const result = findPathWithTurnPenalty(sourceStubEnd, targetStubEnd, grid, offset, sourceDir, usedCells);
	const simplified = simplifyPath(result.path);

	// Path is: [sourceStubEnd, ...intermediates..., targetStubEnd]
	// simplifyPath already includes start and end
	return { path: simplified, waypoints: [], isFallback: result.isFallback };
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

	return { path, waypoints: [] };
}

/**
 * Extract grid cells used by a path with direction info (for overlap/crossing avoidance)
 *
 * Optimized for simplified paths (corner-only): each segment is axis-aligned,
 * so we compute the grid cell range directly instead of stepping every cell.
 *
 * @param path - Path positions in world coordinates (simplified = corners only)
 * @param skipStart - Number of cells to skip at start (for shared source ports)
 * @returns Map of cell key to set of directions traveled through that cell
 */
export function getPathCells(path: Position[], skipStart = 2): Map<string, Set<Direction>> {
	const cells = new Map<string, Set<Direction>>();
	let cellCount = 0;

	for (let i = 0; i < path.length - 1; i++) {
		const segStart = path[i];
		const segEnd = path[i + 1];

		// Determine direction of this segment
		const dx = segEnd.x - segStart.x;
		const dy = segEnd.y - segStart.y;
		let dir: Direction;
		if (Math.abs(dx) > Math.abs(dy)) {
			dir = dx > 0 ? 'right' : 'left';
		} else {
			dir = dy > 0 ? 'down' : 'up';
		}

		// Compute grid range for this axis-aligned segment
		const gx1 = worldToGrid(segStart.x);
		const gy1 = worldToGrid(segStart.y);
		const gx2 = worldToGrid(segEnd.x);
		const gy2 = worldToGrid(segEnd.y);

		const minGx = Math.min(gx1, gx2);
		const maxGx = Math.max(gx1, gx2);
		const minGy = Math.min(gy1, gy2);
		const maxGy = Math.max(gy1, gy2);

		// Iterate over the grid range (one axis is constant for orthogonal segments)
		for (let gx = minGx; gx <= maxGx; gx++) {
			for (let gy = minGy; gy <= maxGy; gy++) {
				cellCount++;
				if (cellCount > skipStart) {
					const key = `${gx},${gy}`;
					if (!cells.has(key)) cells.set(key, new Set());
					cells.get(key)!.add(dir);
				}
			}
		}
	}

	return cells;
}

/**
 * Infer direction from one point to another (for approach/exit directions)
 */
function inferDirection(from: Position, to: Position): Direction {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	if (Math.abs(dx) > Math.abs(dy)) {
		return dx > 0 ? 'right' : 'left';
	}
	return dy > 0 ? 'down' : 'up';
}

/**
 * Infer exit direction from the end of a path segment
 */
function inferExitDirection(path: Position[]): Direction {
	if (path.length < 2) return 'right';
	const last = path[path.length - 1];
	const prev = path[path.length - 2];
	return inferDirection(prev, last);
}


/**
 * Calculate route through user waypoints using sequential A* segments
 * Route: Source -> A* -> W1 -> A* -> W2 -> ... -> A* -> Target
 * @param grid - Sparse grid with obstacles (from routing store)
 */
export function calculateRouteWithWaypoints(
	sourcePos: Position,
	targetPos: Position,
	sourceDir: Direction,
	targetDir: Direction,
	grid: SparseGrid,
	userWaypoints: Waypoint[],
	usedCells?: Map<string, Set<Direction>>
): RouteResult {
	// If no waypoints, use regular routing
	if (userWaypoints.length === 0) {
		return calculateRoute(sourcePos, targetPos, sourceDir, targetDir, grid, usedCells);
	}

	// Use waypoints in their stored order (insertion order from segment splitting)
	const offset = grid.getOffset();

	// Build path segments through all waypoints
	const fullPath: Position[] = [];
	let currentPos = getStubEnd(sourcePos, sourceDir, SOURCE_CLEARANCE);
	let currentDir = sourceDir;
	let hasFallback = false;

	for (let i = 0; i < userWaypoints.length; i++) {
		const waypoint = userWaypoints[i];
		const waypointPos = snapToGrid(waypoint.position);

		// Route from current position to waypoint
		const segmentResult = findPathWithTurnPenalty(
			currentPos,
			waypointPos,
			grid,
			offset,
			currentDir,
			usedCells
		);

		if (segmentResult.isFallback) hasFallback = true;

		// Append path (skip first point if not first segment to avoid duplicates)
		if (fullPath.length === 0) {
			fullPath.push(...segmentResult.path);
		} else if (segmentResult.path.length > 0) {
			fullPath.push(...segmentResult.path.slice(1));
		}

		// Update current position and direction for next segment
		currentPos = waypointPos;
		if (segmentResult.path.length >= 2) {
			// Exit direction is opposite of how we approached (continue in same direction)
			currentDir = inferExitDirection(segmentResult.path);
		} else {
			// Fallback: infer from next waypoint or target
			const nextTarget = i < userWaypoints.length - 1
				? userWaypoints[i + 1].position
				: targetPos;
			currentDir = inferDirection(waypointPos, nextTarget);
		}
	}

	// Final segment: last waypoint -> target
	const targetStubEnd = getStubEnd(targetPos, targetDir, TARGET_CLEARANCE);
	const finalResult = findPathWithTurnPenalty(
		currentPos,
		targetStubEnd,
		grid,
		offset,
		currentDir,
		usedCells
	);

	if (finalResult.isFallback) hasFallback = true;

	if (fullPath.length === 0) {
		fullPath.push(...finalResult.path);
	} else if (finalResult.path.length > 0) {
		fullPath.push(...finalResult.path.slice(1));
	}

	// Simplify the combined path
	const simplified = simplifyPath(fullPath);

	return { path: simplified, waypoints: userWaypoints, isFallback: hasFallback };
}
