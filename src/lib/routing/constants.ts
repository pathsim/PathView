/**
 * Routing constants
 */

import { G } from '$lib/constants/grid';

/** Margin around nodes for routing (2 grid units = 20px) */
export const ROUTING_MARGIN = G.x2;

/** Minimum distance from port before first turn (1 grid unit = 10px) */
export const PORT_CLEARANCE = G.unit;

/** Grid resolution for pathfinding (matches base grid = 10px) */
export const GRID_SIZE = G.unit;
