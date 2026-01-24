/**
 * A* pathfinding with turn penalty and no 180-degree turns
 */

import type { Position } from '$lib/types/common';
import type { Direction } from './types';
import { OPPOSITE_DIRECTION } from './types';
import type { SparseGrid } from './gridBuilder';
import { worldToGrid, gridToWorld } from './gridBuilder';
import { GRID_SIZE } from './constants';

/** Cost for making a 90-degree turn (in grid units) */
const TURN_PENALTY = 2;

/** Cost for running parallel to another path (same direction) */
const PATH_OVERLAP_PENALTY = 20;

/** Cost for crossing another path (perpendicular) - low since crossings are acceptable */
const PATH_CROSSING_PENALTY = 2;

/** Number of cells to force walkable in initial direction (exit from port) */
const EXIT_PATH_LENGTH = 3;

/** Maximum iterations before giving up (prevents infinite search) */
const MAX_ITERATIONS = 10000;

/** Neighbor offsets with their directions */
const NEIGHBORS: Array<{ dx: number; dy: number; dir: Direction }> = [
	{ dx: 1, dy: 0, dir: 'right' },
	{ dx: -1, dy: 0, dir: 'left' },
	{ dx: 0, dy: 1, dir: 'down' },
	{ dx: 0, dy: -1, dir: 'up' }
];

/** Priority queue node for A* with direction tracking */
interface AStarNode {
	x: number;
	y: number;
	g: number; // Cost from start
	h: number; // Heuristic to end
	f: number; // Total cost (g + h)
	parent: AStarNode | null;
	direction: Direction; // Actual direction we arrived from
}

/** Simple binary min-heap for A* open set */
class MinHeap {
	private heap: AStarNode[] = [];

	push(node: AStarNode): void {
		this.heap.push(node);
		this.bubbleUp(this.heap.length - 1);
	}

	pop(): AStarNode | undefined {
		if (this.heap.length === 0) return undefined;
		const min = this.heap[0];
		const last = this.heap.pop()!;
		if (this.heap.length > 0) {
			this.heap[0] = last;
			this.bubbleDown(0);
		}
		return min;
	}

	get length(): number {
		return this.heap.length;
	}

	// Find and update node if better path found
	updateIfBetter(x: number, y: number, dir: Direction, newG: number, parent: AStarNode): boolean {
		for (let i = 0; i < this.heap.length; i++) {
			const n = this.heap[i];
			if (n.x === x && n.y === y && n.direction === dir) {
				if (newG < n.g) {
					n.g = newG;
					n.f = newG + n.h;
					n.parent = parent;
					this.bubbleUp(i);
					return true;
				}
				return false;
			}
		}
		return false; // Not found
	}

	has(x: number, y: number, dir: Direction): boolean {
		return this.heap.some(n => n.x === x && n.y === y && n.direction === dir);
	}

	private bubbleUp(i: number): void {
		while (i > 0) {
			const parent = Math.floor((i - 1) / 2);
			if (this.heap[i].f >= this.heap[parent].f) break;
			[this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
			i = parent;
		}
	}

	private bubbleDown(i: number): void {
		const n = this.heap.length;
		while (true) {
			const left = 2 * i + 1;
			const right = 2 * i + 2;
			let smallest = i;
			if (left < n && this.heap[left].f < this.heap[smallest].f) smallest = left;
			if (right < n && this.heap[right].f < this.heap[smallest].f) smallest = right;
			if (smallest === i) break;
			[this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
			i = smallest;
		}
	}
}

/** Result from pathfinding */
export interface PathResult {
	path: Position[];
	isFallback: boolean;
}

/**
 * Find orthogonal path between two points using A* with turn penalty
 * Only allows 90-degree turns (no reversing/180-degree turns)
 * @param start - Start position in world coordinates
 * @param end - End position in world coordinates
 * @param grid - Sparse grid with obstacles
 * @param offset - Grid offset (canvas origin)
 * @param initialDir - Initial direction of travel
 * @param usedCells - Optional map of cells to directions used by other paths
 * @returns PathResult with path and fallback flag
 */
export function findPathWithTurnPenalty(
	start: Position,
	end: Position,
	grid: SparseGrid,
	offset: Position,
	initialDir: Direction,
	usedCells?: Map<string, Set<Direction>>
): PathResult {
	// Convert to grid coordinates
	const startGx = worldToGrid(start.x - offset.x);
	const startGy = worldToGrid(start.y - offset.y);
	const endGx = worldToGrid(end.x - offset.x);
	const endGy = worldToGrid(end.y - offset.y);

	// Cells that are forced walkable (start, end, exit path)
	const forcedWalkable = new Set<string>();
	forcedWalkable.add(`${startGx},${startGy}`);
	forcedWalkable.add(`${endGx},${endGy}`);

	// Force first few cells in initial direction walkable (exit path from port)
	const initVec = NEIGHBORS.find((n) => n.dir === initialDir);
	if (initVec) {
		for (let i = 1; i <= EXIT_PATH_LENGTH; i++) {
			forcedWalkable.add(`${startGx + initVec.dx * i},${startGy + initVec.dy * i}`);
		}
	}

	// Helper to check walkability (sparse grid + forced walkable)
	const isWalkable = (gx: number, gy: number): boolean => {
		const key = `${gx},${gy}`;
		if (forcedWalkable.has(key)) return true;
		return grid.isWalkableAt(gx, gy);
	};

	// Initialize open (min-heap) and closed sets
	const openSet = new MinHeap();
	const closedSet = new Set<string>();

	// Create start node
	const startNode: AStarNode = {
		x: startGx,
		y: startGy,
		g: 0,
		h: manhattanDistance(startGx, startGy, endGx, endGy),
		f: 0,
		parent: null,
		direction: initialDir
	};
	startNode.f = startNode.g + startNode.h;
	openSet.push(startNode);

	let iterations = 0;
	while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
		iterations++;
		const current = openSet.pop()!;

		// Check if we reached the end
		if (current.x === endGx && current.y === endGy) {
			return { path: reconstructPath(current, offset), isFallback: false };
		}

		// Skip if already processed with this direction
		const closedKey = `${current.x},${current.y},${current.direction}`;
		if (closedSet.has(closedKey)) continue;
		closedSet.add(closedKey);

		// Get the direction we must NOT go (opposite = 180-degree turn)
		const blockedDir = OPPOSITE_DIRECTION[current.direction];
		const isStartNode = current.parent === null;

		// Explore neighbors
		for (const { dx, dy, dir } of NEIGHBORS) {
			if (dir === blockedDir) continue;
			if (isStartNode && dir !== initialDir) continue;

			const nx = current.x + dx;
			const ny = current.y + dy;

			// Skip if not walkable (no bounds check - grid is unbounded)
			if (!isWalkable(nx, ny)) continue;

			// Skip if already closed with this direction
			const neighborClosedKey = `${nx},${ny},${dir}`;
			if (closedSet.has(neighborClosedKey)) continue;

			// Calculate movement cost
			let moveCost = 1;
			if (current.direction !== dir) moveCost += TURN_PENALTY;

			// Add penalty for cells used by other paths
			if (usedCells) {
				const worldGx = nx + worldToGrid(offset.x);
				const worldGy = ny + worldToGrid(offset.y);
				const existingDirs = usedCells.get(`${worldGx},${worldGy}`);
				if (existingDirs) {
					const isHorizontal = dir === 'left' || dir === 'right';
					const hasPerpendicular = isHorizontal
						? existingDirs.has('up') || existingDirs.has('down')
						: existingDirs.has('left') || existingDirs.has('right');
					moveCost += hasPerpendicular ? PATH_CROSSING_PENALTY : PATH_OVERLAP_PENALTY;
				}
			}

			const tentativeG = current.g + moveCost;

			// Try to update existing node or add new one
			if (!openSet.updateIfBetter(nx, ny, dir, tentativeG, current)) {
				if (!openSet.has(nx, ny, dir)) {
					const h = manhattanDistance(nx, ny, endGx, endGy);
					openSet.push({
						x: nx,
						y: ny,
						g: tentativeG,
						h,
						f: tentativeG + h,
						parent: current,
						direction: dir
					});
				}
			}
		}
	}

	// No path found, return L-shaped fallback (never diagonal)
	// Go in initial direction first, then turn
	if (initialDir === 'right' || initialDir === 'left') {
		// Horizontal first, then vertical
		return { path: [start, { x: end.x, y: start.y }, end], isFallback: true };
	} else {
		// Vertical first, then horizontal
		return { path: [start, { x: start.x, y: end.y }, end], isFallback: true };
	}
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

