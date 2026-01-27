/**
 * Sparse grid for pathfinding - stores only obstacles, computes walkability on demand
 * Supports incremental updates for efficient node dragging
 */

import type { RoutingContext, Bounds, PortStub } from './types';
import { DIRECTION_VECTORS } from './types';
import { GRID_SIZE, ROUTING_MARGIN } from './constants';

/** Size of spatial hash buckets (in grid cells) */
const SPATIAL_BUCKET_SIZE = 10;

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

	/** Spatial hash: bucket key -> set of node IDs with obstacles in that bucket */
	private spatialHash: Map<string, Set<string>> = new Map();

	constructor(context?: RoutingContext) {
		if (context) {
			this.initFromContext(context);
		}
	}

	/** Get bucket key for a grid coordinate */
	private getBucketKey(gx: number, gy: number): string {
		const bx = Math.floor(gx / SPATIAL_BUCKET_SIZE);
		const by = Math.floor(gy / SPATIAL_BUCKET_SIZE);
		return `${bx},${by}`;
	}

	/** Get all bucket keys that an obstacle overlaps */
	private getObstacleBuckets(obs: GridObstacle): string[] {
		const keys: string[] = [];
		const minBx = Math.floor(obs.minGx / SPATIAL_BUCKET_SIZE);
		const maxBx = Math.floor(obs.maxGx / SPATIAL_BUCKET_SIZE);
		const minBy = Math.floor(obs.minGy / SPATIAL_BUCKET_SIZE);
		const maxBy = Math.floor(obs.maxGy / SPATIAL_BUCKET_SIZE);

		for (let bx = minBx; bx <= maxBx; bx++) {
			for (let by = minBy; by <= maxBy; by++) {
				keys.push(`${bx},${by}`);
			}
		}
		return keys;
	}

	/** Add a node to the spatial hash */
	private addToSpatialHash(nodeId: string, obs: GridObstacle): void {
		for (const key of this.getObstacleBuckets(obs)) {
			if (!this.spatialHash.has(key)) {
				this.spatialHash.set(key, new Set());
			}
			this.spatialHash.get(key)!.add(nodeId);
		}
	}

	/** Remove a node from the spatial hash */
	private removeFromSpatialHash(nodeId: string, obs: GridObstacle): void {
		for (const key of this.getObstacleBuckets(obs)) {
			this.spatialHash.get(key)?.delete(nodeId);
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

		// Build obstacle map from node bounds and spatial hash
		this.nodeObstacles.clear();
		this.spatialHash.clear();
		for (const [nodeId, bounds] of context.nodeBounds) {
			const obs = boundsToObstacle(bounds, this.offsetX, this.offsetY);
			this.nodeObstacles.set(nodeId, obs);
			this.addToSpatialHash(nodeId, obs);
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
		// Remove from old buckets if exists
		const oldObs = this.nodeObstacles.get(nodeId);
		if (oldObs) {
			this.removeFromSpatialHash(nodeId, oldObs);
		}

		// Add new obstacle
		const newObs = boundsToObstacle(bounds, this.offsetX, this.offsetY);
		this.nodeObstacles.set(nodeId, newObs);

		// Add to new buckets
		this.addToSpatialHash(nodeId, newObs);
	}

	/**
	 * Remove a node's obstacle - O(1)
	 */
	removeNode(nodeId: string): void {
		const obs = this.nodeObstacles.get(nodeId);
		if (obs) {
			this.removeFromSpatialHash(nodeId, obs);
		}
		this.nodeObstacles.delete(nodeId);
	}

	/**
	 * Update port stub obstacles (called when connections change)
	 * Blocks 2 cells in the port direction to prevent bends near arrowheads
	 */
	updatePortStubs(portStubs?: PortStub[]): void {
		this.portStubObstacles = [];
		if (portStubs) {
			for (const stub of portStubs) {
				const vec = DIRECTION_VECTORS[stub.direction];
				for (let i = 1; i <= 2; i++) {
					const stubX = stub.position.x + vec.x * GRID_SIZE * i;
					const stubY = stub.position.y + vec.y * GRID_SIZE * i;
					const gx = worldToGrid(stubX - this.offsetX);
					const gy = worldToGrid(stubY - this.offsetY);
					this.portStubObstacles.push({ minGx: gx, minGy: gy, maxGx: gx, maxGy: gy });
				}
			}
		}
	}

	/**
	 * Check if a grid cell is walkable (not blocked by any obstacle)
	 * O(bucket size) per query using spatial hash - fast for large graphs
	 * No bounds check - grid is effectively infinite
	 */
	isWalkableAt(gx: number, gy: number): boolean {
		const bucketKey = this.getBucketKey(gx, gy);

		// Check node obstacles in this bucket only
		const nodeIds = this.spatialHash.get(bucketKey);
		if (nodeIds) {
			for (const nodeId of nodeIds) {
				const obs = this.nodeObstacles.get(nodeId);
				if (obs && gx >= obs.minGx && gx <= obs.maxGx && gy >= obs.minGy && gy <= obs.maxGy) {
					return false;
				}
			}
		}

		// Port stubs are few, linear scan is fine
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
