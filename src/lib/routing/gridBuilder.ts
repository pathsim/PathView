/**
 * Sparse grid for pathfinding - stores only obstacles, computes walkability on demand
 */

import type { RoutingContext, Bounds } from './types';
import { DIRECTION_VECTORS } from './types';
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
 * Obstacle in grid coordinates (inclusive bounds)
 */
interface GridObstacle {
	minGx: number;
	minGy: number;
	maxGx: number;
	maxGy: number;
}

/**
 * Sparse grid that computes walkability on-demand from obstacle list
 * No matrix storage - O(obstacles) memory instead of O(width × height)
 */
export class SparseGrid {
	readonly width: number;
	readonly height: number;
	readonly offsetX: number;
	readonly offsetY: number;
	private obstacles: GridObstacle[] = [];

	constructor(context: RoutingContext) {
		const { canvasBounds } = context;

		// Calculate grid dimensions from canvas bounds
		this.width = Math.ceil(canvasBounds.width / GRID_SIZE) + 2;
		this.height = Math.ceil(canvasBounds.height / GRID_SIZE) + 2;

		// Snap offset to grid
		this.offsetX = Math.floor(canvasBounds.x / GRID_SIZE) * GRID_SIZE;
		this.offsetY = Math.floor(canvasBounds.y / GRID_SIZE) * GRID_SIZE;

		// Build obstacle list from node bounds
		for (const [, bounds] of context.nodeBounds) {
			this.addNodeObstacle(bounds);
		}

		// Add port stub obstacles
		if (context.portStubs) {
			for (const stub of context.portStubs) {
				const vec = DIRECTION_VECTORS[stub.direction];
				const stubX = stub.position.x + vec.x * GRID_SIZE;
				const stubY = stub.position.y + vec.y * GRID_SIZE;
				const gx = worldToGrid(stubX - this.offsetX);
				const gy = worldToGrid(stubY - this.offsetY);
				// Single cell obstacle
				this.obstacles.push({ minGx: gx, minGy: gy, maxGx: gx, maxGy: gy });
			}
		}
	}

	private addNodeObstacle(bounds: Bounds): void {
		// Add margin around node
		const marginBounds = {
			x: bounds.x - ROUTING_MARGIN,
			y: bounds.y - ROUTING_MARGIN,
			width: bounds.width + 2 * ROUTING_MARGIN,
			height: bounds.height + 2 * ROUTING_MARGIN
		};

		// Convert to grid coordinates
		const minGx = worldToGrid(marginBounds.x - this.offsetX);
		const minGy = worldToGrid(marginBounds.y - this.offsetY);
		const maxGx = worldToGrid(marginBounds.x + marginBounds.width - this.offsetX);
		const maxGy = worldToGrid(marginBounds.y + marginBounds.height - this.offsetY);

		this.obstacles.push({ minGx, minGy, maxGx, maxGy });
	}

	/**
	 * Check if a grid cell is walkable (not blocked by any obstacle)
	 * O(obstacles) per query - fast for small obstacle counts
	 */
	isWalkableAt(gx: number, gy: number): boolean {
		// Bounds check
		if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) {
			return false;
		}

		// Check against all obstacles
		for (const obs of this.obstacles) {
			if (gx >= obs.minGx && gx <= obs.maxGx && gy >= obs.minGy && gy <= obs.maxGy) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Get offset for converting world to local grid coordinates
	 */
	getOffset(): { x: number; y: number } {
		return { x: this.offsetX, y: this.offsetY };
	}
}

/**
 * Build sparse grid from routing context
 */
export function buildGrid(context: RoutingContext): SparseGrid {
	return new SparseGrid(context);
}

/**
 * Get grid offset (canvas origin snapped to grid)
 */
export function getGridOffset(context: RoutingContext): { x: number; y: number } {
	return {
		x: Math.floor(context.canvasBounds.x / GRID_SIZE) * GRID_SIZE,
		y: Math.floor(context.canvasBounds.y / GRID_SIZE) * GRID_SIZE
	};
}
