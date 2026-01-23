/**
 * Path optimization utilities
 */

import type { Position } from '$lib/types/common';
import { GRID_SIZE } from './constants';

/**
 * Remove collinear intermediate points (keeps only corners)
 * This simplifies the path from A* which returns every grid cell
 */
export function simplifyPath(path: Position[]): Position[] {
	if (path.length < 3) return path;

	const result: Position[] = [path[0]];

	for (let i = 1; i < path.length - 1; i++) {
		const prev = result[result.length - 1];
		const curr = path[i];
		const next = path[i + 1];

		// Calculate direction vectors
		const dx1 = Math.sign(curr.x - prev.x);
		const dy1 = Math.sign(curr.y - prev.y);
		const dx2 = Math.sign(next.x - curr.x);
		const dy2 = Math.sign(next.y - curr.y);

		// Keep point if direction changes (it's a corner)
		const directionChanged = dx1 !== dx2 || dy1 !== dy2;
		if (directionChanged) {
			result.push(curr);
		}
	}

	result.push(path[path.length - 1]);
	return result;
}

/**
 * Snap a single point to grid
 */
export function snapToGrid(point: Position): Position {
	return {
		x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
		y: Math.round(point.y / GRID_SIZE) * GRID_SIZE
	};
}

/**
 * Snap all points in a path to grid
 */
export function snapPathToGrid(path: Position[]): Position[] {
	return path.map(snapToGrid);
}

/**
 * Merge nearby points that are on the same grid cell
 */
export function deduplicatePath(path: Position[]): Position[] {
	if (path.length < 2) return path;

	const result: Position[] = [path[0]];

	for (let i = 1; i < path.length; i++) {
		const prev = result[result.length - 1];
		const curr = path[i];

		// Skip if same position
		if (prev.x !== curr.x || prev.y !== curr.y) {
			result.push(curr);
		}
	}

	return result;
}
