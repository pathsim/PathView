/**
 * Build pathfinding grid with obstacles marked
 */

import PF from 'pathfinding';
import type { Bounds, RoutingContext } from './types';
import { GRID_SIZE, ROUTING_MARGIN } from './constants';

/**
 * Convert world coordinates to grid coordinates
 * Since everything is grid-aligned, this is a simple division
 */
export function worldToGrid(x: number): number {
	return Math.round(x / GRID_SIZE);
}

/**
 * Convert grid coordinates back to world coordinates
 */
export function gridToWorld(gx: number): number {
	return gx * GRID_SIZE;
}

/**
 * Build pathfinding grid with obstacles marked
 * @param context - Routing context with node bounds and canvas bounds
 * @param excludeNodeIds - Node IDs to exclude from obstacles (source/target nodes)
 */
export function buildGrid(
	context: RoutingContext,
	excludeNodeIds: Set<string> = new Set()
): PF.Grid {
	const { nodeBounds, canvasBounds } = context;

	// Calculate grid dimensions from canvas bounds
	const gridWidth = Math.ceil(canvasBounds.width / GRID_SIZE) + 1;
	const gridHeight = Math.ceil(canvasBounds.height / GRID_SIZE) + 1;
	const offsetX = canvasBounds.x;
	const offsetY = canvasBounds.y;

	const grid = new PF.Grid(gridWidth, gridHeight);

	// Mark obstacles (nodes with margin)
	for (const [nodeId, bounds] of nodeBounds) {
		// Skip excluded nodes (source/target)
		if (excludeNodeIds.has(nodeId)) continue;

		// Add margin around node
		const marginBounds = {
			x: bounds.x - ROUTING_MARGIN,
			y: bounds.y - ROUTING_MARGIN,
			width: bounds.width + 2 * ROUTING_MARGIN,
			height: bounds.height + 2 * ROUTING_MARGIN
		};

		// Convert to grid coordinates
		const startGx = worldToGrid(marginBounds.x - offsetX);
		const startGy = worldToGrid(marginBounds.y - offsetY);
		const endGx = worldToGrid(marginBounds.x + marginBounds.width - offsetX);
		const endGy = worldToGrid(marginBounds.y + marginBounds.height - offsetY);

		// Mark cells as unwalkable
		for (let gx = startGx; gx <= endGx; gx++) {
			for (let gy = startGy; gy <= endGy; gy++) {
				if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
					grid.setWalkableAt(gx, gy, false);
				}
			}
		}
	}

	return grid;
}

/**
 * Get grid offset (canvas origin in world coordinates)
 */
export function getGridOffset(context: RoutingContext): { x: number; y: number } {
	return { x: context.canvasBounds.x, y: context.canvasBounds.y };
}
