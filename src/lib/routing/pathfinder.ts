/**
 * A* pathfinding with turn penalty and no 180-degree turns
 *
 * Performance notes:
 * - MinHeap uses a Map sidecar for O(1) membership/update lookups
 * - Closed set and forced-walkable set use numeric keys to avoid string GC
 * - Direction is encoded as 0-3 integer for fast hashing
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

/** Direction to integer index for numeric hashing */
const DIR_INDEX: Record<Direction, number> = { right: 0, left: 1, down: 2, up: 3 };

/** Neighbor offsets with their directions and precomputed direction index */
const NEIGHBORS: Array<{ dx: number; dy: number; dir: Direction; dirIdx: number }> = [
	{ dx: 1, dy: 0, dir: 'right', dirIdx: 0 },
	{ dx: -1, dy: 0, dir: 'left', dirIdx: 1 },
	{ dx: 0, dy: 1, dir: 'down', dirIdx: 2 },
	{ dx: 0, dy: -1, dir: 'up', dirIdx: 3 }
];

/**
 * Encode (x, y, dirIdx) into a single number for use as Map key.
 * Uses a large multiplier to avoid collisions in the expected coordinate range.
 * Grid coordinates are typically -500..+500, so 20_000 provides ample space.
 */
function encodeState(x: number, y: number, dirIdx: number): number {
	return ((x + 10_000) * 20_001 + (y + 10_000)) * 4 + dirIdx;
}

/** Encode (x, y) into a single number for walkability sets */
function encodeCell(x: number, y: number): number {
	return (x + 10_000) * 20_001 + (y + 10_000);
}

/** Priority queue node for A* with direction tracking */
interface AStarNode {
	x: number;
	y: number;
	g: number; // Cost from start
	h: number; // Heuristic to end
	f: number; // Total cost (g + h)
	parent: AStarNode | null;
	direction: Direction; // Actual direction we arrived from
	dirIdx: number; // Numeric direction index (0-3)
	stateKey: number; // Precomputed encodeState key
	heapIdx: number; // Current index in the heap array (maintained by MinHeap)
}

/**
 * Binary min-heap with O(1) membership test and O(log n) update.
 * Uses a Map<stateKey, AStarNode> sidecar for fast lookups.
 * Each node stores its current heap index so bubbleUp/bubbleDown can
 * update the sidecar without re-scanning.
 */
class MinHeap {
	private heap: AStarNode[] = [];
	private index: Map<number, AStarNode> = new Map();

	push(node: AStarNode): void {
		node.heapIdx = this.heap.length;
		this.heap.push(node);
		this.index.set(node.stateKey, node);
		this.bubbleUp(node.heapIdx);
	}

	pop(): AStarNode | undefined {
		if (this.heap.length === 0) return undefined;
		const min = this.heap[0];
		this.index.delete(min.stateKey);
		const last = this.heap.pop()!;
		if (this.heap.length > 0) {
			last.heapIdx = 0;
			this.heap[0] = last;
			this.bubbleDown(0);
		}
		return min;
	}

	get length(): number {
		return this.heap.length;
	}

	/** O(1) lookup + O(log n) re-heap if better */
	updateIfBetter(stateKey: number, newG: number, newH: number, parent: AStarNode): boolean {
		const existing = this.index.get(stateKey);
		if (!existing) return false; // Not in open set
		if (newG < existing.g) {
			existing.g = newG;
			existing.f = newG + existing.h;
			existing.parent = parent;
			this.bubbleUp(existing.heapIdx);
			return true;
		}
		return false; // Existing path is better or equal
	}

	/** O(1) membership test */
	has(stateKey: number): boolean {
		return this.index.has(stateKey);
	}

	private bubbleUp(i: number): void {
		const heap = this.heap;
		while (i > 0) {
			const parentIdx = (i - 1) >> 1;
			if (heap[i].f >= heap[parentIdx].f) break;
			this.swap(i, parentIdx);
			i = parentIdx;
		}
	}

	private bubbleDown(i: number): void {
		const heap = this.heap;
		const n = heap.length;
		while (true) {
			const left = 2 * i + 1;
			const right = 2 * i + 2;
			let smallest = i;
			if (left < n && heap[left].f < heap[smallest].f) smallest = left;
			if (right < n && heap[right].f < heap[smallest].f) smallest = right;
			if (smallest === i) break;
			this.swap(i, smallest);
			i = smallest;
		}
	}

	private swap(a: number, b: number): void {
		const heap = this.heap;
		const nodeA = heap[a];
		const nodeB = heap[b];
		heap[a] = nodeB;
		heap[b] = nodeA;
		nodeA.heapIdx = b;
		nodeB.heapIdx = a;
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

	// Precompute offset in grid units for usedCells lookup
	const offsetGx = worldToGrid(offset.x);
	const offsetGy = worldToGrid(offset.y);

	// Cells that are forced walkable (start, end, exit path) — numeric keys
	const forcedWalkable = new Set<number>();
	forcedWalkable.add(encodeCell(startGx, startGy));
	forcedWalkable.add(encodeCell(endGx, endGy));

	// Force first few cells in initial direction walkable (exit path from port)
	const initVec = NEIGHBORS.find((n) => n.dir === initialDir);
	if (initVec) {
		for (let i = 1; i <= EXIT_PATH_LENGTH; i++) {
			forcedWalkable.add(encodeCell(startGx + initVec.dx * i, startGy + initVec.dy * i));
		}
	}

	// Helper to check walkability (sparse grid + forced walkable)
	const isWalkable = (gx: number, gy: number): boolean => {
		if (forcedWalkable.has(encodeCell(gx, gy))) return true;
		return grid.isWalkableAt(gx, gy);
	};

	// Initialize open (min-heap) and closed set (numeric keys)
	const openSet = new MinHeap();
	const closedSet = new Set<number>();

	const initialDirIdx = DIR_INDEX[initialDir];
	const startStateKey = encodeState(startGx, startGy, initialDirIdx);
	const startH = manhattanDistance(startGx, startGy, endGx, endGy);

	// Create start node
	const startNode: AStarNode = {
		x: startGx,
		y: startGy,
		g: 0,
		h: startH,
		f: startH,
		parent: null,
		direction: initialDir,
		dirIdx: initialDirIdx,
		stateKey: startStateKey,
		heapIdx: 0
	};
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
		if (closedSet.has(current.stateKey)) continue;
		closedSet.add(current.stateKey);

		// Get the direction we must NOT go (opposite = 180-degree turn)
		const blockedDir = OPPOSITE_DIRECTION[current.direction];
		const isStartNode = current.parent === null;

		// Explore neighbors
		for (const { dx, dy, dir, dirIdx } of NEIGHBORS) {
			if (dir === blockedDir) continue;
			if (isStartNode && dir !== initialDir) continue;

			const nx = current.x + dx;
			const ny = current.y + dy;

			// Skip if not walkable (no bounds check - grid is unbounded)
			if (!isWalkable(nx, ny)) continue;

			// Skip if already closed with this direction
			const neighborStateKey = encodeState(nx, ny, dirIdx);
			if (closedSet.has(neighborStateKey)) continue;

			// Calculate movement cost
			let moveCost = 1;
			if (current.direction !== dir) moveCost += TURN_PENALTY;

			// Add penalty for cells used by other paths
			if (usedCells) {
				const worldGx = nx + offsetGx;
				const worldGy = ny + offsetGy;
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

			// Try to update existing node in open set, or add new one
			if (!openSet.updateIfBetter(neighborStateKey, tentativeG, 0, current)) {
				if (!openSet.has(neighborStateKey)) {
					const h = manhattanDistance(nx, ny, endGx, endGy);
					openSet.push({
						x: nx,
						y: ny,
						g: tentativeG,
						h,
						f: tentativeG + h,
						parent: current,
						direction: dir,
						dirIdx,
						stateKey: neighborStateKey,
						heapIdx: 0
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
 * Uses push + reverse instead of unshift to avoid O(n²) array shifting
 */
function reconstructPath(endNode: AStarNode, offset: Position): Position[] {
	const path: Position[] = [];
	let current: AStarNode | null = endNode;

	while (current !== null) {
		path.push({
			x: gridToWorld(current.x) + offset.x,
			y: gridToWorld(current.y) + offset.y
		});
		current = current.parent;
	}

	path.reverse();
	return path;
}
