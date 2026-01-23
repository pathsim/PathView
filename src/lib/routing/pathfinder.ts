/**
 * A* pathfinding with turn penalty
 */

import PF from 'pathfinding';
import type { Position } from '$lib/types/common';
import type { Direction } from './types';
import { worldToGrid, gridToWorld } from './gridBuilder';
import { GRID_SIZE } from './constants';

/** Cost for making a 90-degree turn (in grid units) */
const TURN_PENALTY = 2;

/** Priority queue node for A* with direction tracking */
interface AStarNode {
	x: number;
	y: number;
	g: number; // Cost from start
	h: number; // Heuristic to end
	f: number; // Total cost (g + h)
	parent: AStarNode | null;
	direction: 'horizontal' | 'vertical' | null;
}

/**
 * Find orthogonal path between two points using A* with turn penalty
 * @param start - Start position in world coordinates
 * @param end - End position in world coordinates
 * @param grid - Pathfinding grid (will be cloned)
 * @param offset - Grid offset (canvas origin)
 * @param initialDir - Initial direction of travel (affects first turn penalty)
 * @returns Array of positions in world coordinates
 */
export function findPathWithTurnPenalty(
	start: Position,
	end: Position,
	grid: PF.Grid,
	offset: Position,
	initialDir: Direction
): Position[] {
	// Convert to grid coordinates
	const startGx = worldToGrid(start.x - offset.x);
	const startGy = worldToGrid(start.y - offset.y);
	const endGx = worldToGrid(end.x - offset.x);
	const endGy = worldToGrid(end.y - offset.y);

	const gridWidth = grid.width;
	const gridHeight = grid.height;

	// Bounds check
	if (startGx < 0 || startGx >= gridWidth || startGy < 0 || startGy >= gridHeight ||
		endGx < 0 || endGx >= gridWidth || endGy < 0 || endGy >= gridHeight) {
		return [start, end];
	}

	// Clone grid for manipulation
	const walkable = new Set<string>();
	for (let y = 0; y < gridHeight; y++) {
		for (let x = 0; x < gridWidth; x++) {
			if (grid.isWalkableAt(x, y)) {
				walkable.add(`${x},${y}`);
			}
		}
	}
	// Ensure start and end are walkable
	walkable.add(`${startGx},${startGy}`);
	walkable.add(`${endGx},${endGy}`);

	// Initialize open and closed sets
	const openSet: AStarNode[] = [];
	const closedSet = new Map<string, AStarNode>();

	// Determine initial direction type
	const initialDirType: 'horizontal' | 'vertical' =
		(initialDir === 'left' || initialDir === 'right') ? 'horizontal' : 'vertical';

	// Create start node
	const startNode: AStarNode = {
		x: startGx,
		y: startGy,
		g: 0,
		h: manhattanDistance(startGx, startGy, endGx, endGy),
		f: 0,
		parent: null,
		direction: initialDirType
	};
	startNode.f = startNode.g + startNode.h;
	openSet.push(startNode);

	// Neighbor offsets (4-directional)
	const neighbors = [
		{ dx: 1, dy: 0, dir: 'horizontal' as const },
		{ dx: -1, dy: 0, dir: 'horizontal' as const },
		{ dx: 0, dy: 1, dir: 'vertical' as const },
		{ dx: 0, dy: -1, dir: 'vertical' as const }
	];

	while (openSet.length > 0) {
		// Find node with lowest f score
		let lowestIdx = 0;
		for (let i = 1; i < openSet.length; i++) {
			if (openSet[i].f < openSet[lowestIdx].f) {
				lowestIdx = i;
			}
		}
		const current = openSet[lowestIdx];

		// Check if we reached the end
		if (current.x === endGx && current.y === endGy) {
			// Reconstruct path
			return reconstructPath(current, offset);
		}

		// Move current from open to closed
		openSet.splice(lowestIdx, 1);
		closedSet.set(`${current.x},${current.y}`, current);

		// Explore neighbors
		for (const { dx, dy, dir } of neighbors) {
			const nx = current.x + dx;
			const ny = current.y + dy;
			const key = `${nx},${ny}`;

			// Skip if out of bounds or not walkable
			if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;
			if (!walkable.has(key)) continue;

			// Skip if already in closed set
			if (closedSet.has(key)) continue;

			// Calculate movement cost
			let moveCost = 1;

			// Add turn penalty if direction changes
			if (current.direction !== null && current.direction !== dir) {
				moveCost += TURN_PENALTY;
			}

			const tentativeG = current.g + moveCost;

			// Check if this path to neighbor is better
			const existingIdx = openSet.findIndex(n => n.x === nx && n.y === ny);
			if (existingIdx !== -1) {
				if (tentativeG < openSet[existingIdx].g) {
					// Better path found
					openSet[existingIdx].g = tentativeG;
					openSet[existingIdx].f = tentativeG + openSet[existingIdx].h;
					openSet[existingIdx].parent = current;
					openSet[existingIdx].direction = dir;
				}
			} else {
				// New node
				const h = manhattanDistance(nx, ny, endGx, endGy);
				const neighbor: AStarNode = {
					x: nx,
					y: ny,
					g: tentativeG,
					h,
					f: tentativeG + h,
					parent: current,
					direction: dir
				};
				openSet.push(neighbor);
			}
		}
	}

	// No path found, return direct line
	return [start, end];
}

/**
 * Manhattan distance heuristic
 */
function manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
	return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * Reconstruct path from A* result
 */
function reconstructPath(endNode: AStarNode, offset: Position): Position[] {
	const path: Position[] = [];
	let current: AStarNode | null = endNode;

	while (current !== null) {
		path.unshift({
			x: gridToWorld(current.x) + offset.x,
			y: gridToWorld(current.y) + offset.y
		});
		current = current.parent;
	}

	return path;
}

/**
 * Original findPath without turn penalty (kept for compatibility)
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
