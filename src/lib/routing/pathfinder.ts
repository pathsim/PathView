/**
 * A* pathfinding wrapper
 */

import PF from 'pathfinding';
import type { Position } from '$lib/types/common';
import { worldToGrid, gridToWorld } from './gridBuilder';
import { GRID_SIZE } from './constants';

/**
 * Find orthogonal path between two points using A*
 * @param start - Start position in world coordinates
 * @param end - End position in world coordinates
 * @param grid - Pathfinding grid (will be cloned)
 * @param offset - Grid offset (canvas origin)
 * @returns Array of positions in world coordinates
 */
export function findPath(
	start: Position,
	end: Position,
	grid: PF.Grid,
	offset: Position
): Position[] {
	const finder = new PF.AStarFinder({
		allowDiagonal: false,
		heuristic: PF.Heuristic.manhattan
	} as PF.FinderOptions);

	// Convert to grid coordinates
	const startGx = worldToGrid(start.x - offset.x);
	const startGy = worldToGrid(start.y - offset.y);
	const endGx = worldToGrid(end.x - offset.x);
	const endGy = worldToGrid(end.y - offset.y);

	// Clone grid (pathfinding modifies it)
	const gridClone = grid.clone();

	// Ensure start and end are walkable (they're on port positions)
	const gridWidth = gridClone.width;
	const gridHeight = gridClone.height;

	if (startGx >= 0 && startGx < gridWidth && startGy >= 0 && startGy < gridHeight) {
		gridClone.setWalkableAt(startGx, startGy, true);
	}
	if (endGx >= 0 && endGx < gridWidth && endGy >= 0 && endGy < gridHeight) {
		gridClone.setWalkableAt(endGx, endGy, true);
	}

	// Find path
	const rawPath = finder.findPath(startGx, startGy, endGx, endGy, gridClone);

	// If no path found, return direct line (fallback)
	if (rawPath.length === 0) {
		return [start, end];
	}

	// Convert back to world coordinates
	return rawPath.map(([gx, gy]) => ({
		x: gridToWorld(gx) + offset.x,
		y: gridToWorld(gy) + offset.y
	}));
}
