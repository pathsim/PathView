/**
 * Routing-specific type definitions
 */

import type { Position } from '$lib/types/common';
import type { Waypoint } from '$lib/types/nodes';

/** Direction a port faces (for enforcing entry/exit angles) */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** Direction vectors for each direction */
export const DIRECTION_VECTORS: Record<Direction, Position> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 }
};

/** Rectangle bounds for obstacle detection */
export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Routing context passed to calculator */
export interface RoutingContext {
	/** Node ID -> bounding box (world coordinates, already includes margin) */
	nodeBounds: Map<string, Bounds>;
	/** Canvas bounds for grid calculation */
	canvasBounds: Bounds;
}

/** Segment of a route (for segment dragging) */
export interface RouteSegment {
	index: number;
	startPoint: Position;
	endPoint: Position;
	isHorizontal: boolean;
	/** true if bounded by user waypoints */
	isUserSegment: boolean;
}

/** Result from route calculation */
export interface RouteResult {
	/** Grid-aligned points including source/target */
	path: Position[];
	/** Generated waypoints (mix of user and auto) */
	waypoints: Waypoint[];
	/** Segment info for interaction */
	segments: RouteSegment[];
}
