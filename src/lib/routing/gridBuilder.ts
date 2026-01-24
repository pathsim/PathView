/**
 * Sparse grid for pathfinding - stores only obstacles, computes walkability on demand
 * Supports incremental updates for efficient node dragging
 */

import type { RoutingContext, Bounds, PortStub } from './types';
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
 * Convert world bounds to grid obstacle
 */
function boundsToObstacle(bounds: Bounds, offsetX: number, offsetY: number): GridObstacle {
	// Add margin around node
	const marginBounds = {
		x: bounds.x - ROUTING_MARGIN,
		y: bounds.y - ROUTING_MARGIN,
		width: bounds.width + 2 * ROUTING_MARGIN,
		height: bounds.height + 2 * ROUTING_MARGIN
	};

	return {
		minGx: worldToGrid(marginBounds.x - offsetX),
		minGy: worldToGrid(marginBounds.y - offsetY),
		maxGx: worldToGrid(marginBounds.x + marginBounds.width - offsetX),
		maxGy: worldToGrid(marginBounds.y + marginBounds.height - offsetY)
	};
}

/**
 * Sparse grid that computes walkability on-demand from obstacle list
 * No matrix storage - O(obstacles) memory instead of O(width × height)
 * Supports incremental updates - O(1) to update a single node
 * Effectively unbounded - only obstacles block movement
 */
export class SparseGrid {
	offsetX: number = 0;
	offsetY: number = 0;

	/** Node obstacles keyed by node ID for O(1) updates */
	private nodeObstacles: Map<string, GridObstacle> = new Map();

	/** Port stub obstacles (rebuilt when stubs change) */
	private portStubObstacles: GridObstacle[] = [];

	constructor(context?: RoutingContext) {
		if (context) {
			this.initFromContext(context);
		}
	}

	/**
	 * Initialize grid from full context (used on first load)
	 */
	private initFromContext(context: RoutingContext): void {
		const { canvasBounds } = context;

		// Snap offset to grid (used for coordinate conversion)
		this.offsetX = Math.floor(canvasBounds.x / GRID_SIZE) * GRID_SIZE;
		this.offsetY = Math.floor(canvasBounds.y / GRID_SIZE) * GRID_SIZE;

		// Build obstacle map from node bounds
		this.nodeObstacles.clear();
		for (const [nodeId, bounds] of context.nodeBounds) {
			this.nodeObstacles.set(nodeId, boundsToObstacle(bounds, this.offsetX, this.offsetY));
		}

		// Build port stub obstacles
		this.updatePortStubs(context.portStubs);
	}

	/**
	 * Update canvas bounds (call when nodes are added/removed or canvas resizes)
	 */
	updateBounds(canvasBounds: Bounds): void {
		this.offsetX = Math.floor(canvasBounds.x / GRID_SIZE) * GRID_SIZE;
		this.offsetY = Math.floor(canvasBounds.y / GRID_SIZE) * GRID_SIZE;
	}

	/**
	 * Update a single node's obstacle - O(1)
	 */
	updateNode(nodeId: string, bounds: Bounds): void {
		this.nodeObstacles.set(nodeId, boundsToObstacle(bounds, this.offsetX, this.offsetY));
	}

	/**
	 * Remove a node's obstacle - O(1)
	 */
	removeNode(nodeId: string): void {
		this.nodeObstacles.delete(nodeId);
	}

	/**
	 * Update port stub obstacles (called when connections change)
	 */
	updatePortStubs(portStubs?: PortStub[]): void {
		this.portStubObstacles = [];
		if (portStubs) {
			for (const stub of portStubs) {
				const vec = DIRECTION_VECTORS[stub.direction];
				const stubX = stub.position.x + vec.x * GRID_SIZE;
				const stubY = stub.position.y + vec.y * GRID_SIZE;
				const gx = worldToGrid(stubX - this.offsetX);
				const gy = worldToGrid(stubY - this.offsetY);
				this.portStubObstacles.push({ minGx: gx, minGy: gy, maxGx: gx, maxGy: gy });
			}
		}
	}

	/**
	 * Check if a grid cell is walkable (not blocked by any obstacle)
	 * O(obstacles) per query - fast for small obstacle counts
	 * No bounds check - grid is effectively infinite
	 */
	isWalkableAt(gx: number, gy: number): boolean {
		// Check against node obstacles
		for (const obs of this.nodeObstacles.values()) {
			if (gx >= obs.minGx && gx <= obs.maxGx && gy >= obs.minGy && gy <= obs.maxGy) {
				return false;
			}
		}

		// Check against port stub obstacles
		for (const obs of this.portStubObstacles) {
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
