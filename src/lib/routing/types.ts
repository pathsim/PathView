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

/** Port stub for obstacle marking */
export interface PortStub {
	position: Position;
	direction: Direction;
}

/** Routing context passed to calculator */
export interface RoutingContext {
	/** Node ID -> bounding box (world coordinates, already includes margin) */
	nodeBounds: Map<string, Bounds>;
	/** Canvas bounds for grid calculation */
	canvasBounds: Bounds;
	/** Port stubs to mark as obstacles */
	portStubs?: PortStub[];
}

/** Result from route calculation */
export interface RouteResult {
	/** Grid-aligned points including source/target */
	path: Position[];
	/** User waypoints (for future use) */
	waypoints: Waypoint[];
}
