/**
 * Simple orthogonal route calculator
 */

import PF from 'pathfinding';
import type { Position } from '$lib/types/common';
import type { Waypoint } from '$lib/types/nodes';
import type { RoutingContext, RouteResult, Direction } from './types';
import { DIRECTION_VECTORS } from './types';
import { buildGrid, getGridOffset, worldToGrid } from './gridBuilder';
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

/** Cached grid and offset for batch routing */
let cachedGrid: { grid: PF.Grid; offset: Position; walkable: Set<string> } | null = null;

/**
 * Build and cache grid for batch routing (call before calculateRoute batch)
 */
export function prepareRoutingGrid(context: RoutingContext): void {
	const grid = buildGrid(context);
	const offset = getGridOffset(context);

	// Pre-build walkable set once
	const walkable = new Set<string>();
	for (let y = 0; y < grid.height; y++) {
		for (let x = 0; x < grid.width; x++) {
			if (grid.isWalkableAt(x, y)) {
				walkable.add(`${x},${y}`);
			}
		}
	}

	cachedGrid = { grid, offset, walkable };
}

/**
 * Clear cached grid after batch routing
 */
export function clearRoutingGrid(): void {
	cachedGrid = null;
}

/**
 * Calculate route between two ports
 * @param usedCells - Optional map of cells to directions used by other paths
 */
export function calculateRoute(
	sourcePos: Position,
	targetPos: Position,
	sourceDir: Direction,
	targetDir: Direction,
	context: RoutingContext,
	usedCells?: Map<string, Set<Direction>>
): RouteResult {
	// Calculate stub endpoints (grid-aligned virtual ports for A*)
	const sourceStubEnd = getStubEnd(sourcePos, sourceDir, SOURCE_CLEARANCE);
	const targetStubEnd = getStubEnd(targetPos, targetDir, TARGET_CLEARANCE);

	// Use cached grid if available, otherwise build fresh
	let grid: PF.Grid;
	let offset: Position;
	let walkable: Set<string> | undefined;

	if (cachedGrid) {
		grid = cachedGrid.grid;
		offset = cachedGrid.offset;
		walkable = cachedGrid.walkable;
	} else {
		grid = buildGrid(context);
		offset = getGridOffset(context);
	}

	// Find path from source stub end to target stub end
	const result = findPathWithTurnPenalty(sourceStubEnd, targetStubEnd, grid, offset, sourceDir, usedCells, walkable);
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
 * @param path - Path positions in world coordinates
 * @param skipStart - Number of cells to skip at start (for shared source ports)
 * @returns Map of cell key to set of directions traveled through that cell
 */
export function getPathCells(path: Position[], skipStart = 2): Map<string, Set<Direction>> {
	const cells = new Map<string, Set<Direction>>();
	let cellCount = 0;

	for (let i = 0; i < path.length - 1; i++) {
		const start = path[i];
		const end = path[i + 1];

		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const dist = Math.max(Math.abs(dx), Math.abs(dy));

		// Determine direction of this segment
		let dir: Direction;
		if (Math.abs(dx) > Math.abs(dy)) {
			dir = dx > 0 ? 'right' : 'left';
		} else {
			dir = dy > 0 ? 'down' : 'up';
		}

		if (dist < 1) {
			cellCount++;
			if (cellCount > skipStart) {
				const key = `${worldToGrid(start.x)},${worldToGrid(start.y)}`;
				if (!cells.has(key)) cells.set(key, new Set());
				cells.get(key)!.add(dir);
			}
			continue;
		}

		const steps = Math.ceil(dist / GRID_SIZE);
		for (let s = 0; s <= steps; s++) {
			cellCount++;
			if (cellCount > skipStart) {
				const t = s / steps;
				const x = start.x + dx * t;
				const y = start.y + dy * t;
				const key = `${worldToGrid(x)},${worldToGrid(y)}`;
				if (!cells.has(key)) cells.set(key, new Set());
				cells.get(key)!.add(dir);
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
 * Get the opposite direction
 */
function oppositeDirection(dir: Direction): Direction {
	const opposites: Record<Direction, Direction> = {
		up: 'down',
		down: 'up',
		left: 'right',
		right: 'left'
	};
	return opposites[dir];
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
 * Sort waypoints by their position along the source->target vector
 */
function sortWaypointsByPathOrder(
	source: Position,
	target: Position,
	waypoints: Waypoint[]
): Waypoint[] {
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const len = Math.sqrt(dx * dx + dy * dy);

	if (len === 0) return waypoints;

	const ux = dx / len;
	const uy = dy / len;

	return [...waypoints].sort((a, b) => {
		const projA = (a.position.x - source.x) * ux + (a.position.y - source.y) * uy;
		const projB = (b.position.x - source.x) * ux + (b.position.y - source.y) * uy;
		return projA - projB;
	});
}

/**
 * Calculate route through user waypoints using sequential A* segments
 * Route: Source -> A* -> W1 -> A* -> W2 -> ... -> A* -> Target
 */
export function calculateRouteWithWaypoints(
	sourcePos: Position,
	targetPos: Position,
	sourceDir: Direction,
	targetDir: Direction,
	context: RoutingContext,
	userWaypoints: Waypoint[],
	usedCells?: Map<string, Set<Direction>>
): RouteResult {
	// If no waypoints, use regular routing
	if (userWaypoints.length === 0) {
		return calculateRoute(sourcePos, targetPos, sourceDir, targetDir, context, usedCells);
	}

	// Sort waypoints by their order along the path
	const sortedWaypoints = sortWaypointsByPathOrder(sourcePos, targetPos, userWaypoints);

	// Use cached grid if available, otherwise build fresh
	let grid: PF.Grid;
	let offset: Position;
	let walkable: Set<string> | undefined;

	if (cachedGrid) {
		grid = cachedGrid.grid;
		offset = cachedGrid.offset;
		walkable = cachedGrid.walkable;
	} else {
		grid = buildGrid(context);
		offset = getGridOffset(context);
	}

	// Build path segments through all waypoints
	const fullPath: Position[] = [];
	let currentPos = getStubEnd(sourcePos, sourceDir, SOURCE_CLEARANCE);
	let currentDir = sourceDir;
	let hasFallback = false;

	for (let i = 0; i < sortedWaypoints.length; i++) {
		const waypoint = sortedWaypoints[i];
		const waypointPos = snapToGrid(waypoint.position);

		// Route from current position to waypoint
		const segmentResult = findPathWithTurnPenalty(
			currentPos,
			waypointPos,
			grid,
			offset,
			currentDir,
			usedCells,
			walkable
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
			const nextTarget = i < sortedWaypoints.length - 1
				? sortedWaypoints[i + 1].position
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
		usedCells,
		walkable
	);

	if (finalResult.isFallback) hasFallback = true;

	if (fullPath.length === 0) {
		fullPath.push(...finalResult.path);
	} else if (finalResult.path.length > 0) {
		fullPath.push(...finalResult.path.slice(1));
	}

	// Simplify the combined path
	const simplified = simplifyPath(fullPath);

	return { path: simplified, waypoints: sortedWaypoints, isFallback: hasFallback };
}
