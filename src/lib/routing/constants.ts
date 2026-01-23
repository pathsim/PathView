/**
 * Routing constants
 */

import { G } from '$lib/constants/grid';

/** Margin around nodes for routing (2 grid units = 20px) */
export const ROUTING_MARGIN = G.x2;

/** Minimum distance from port before first turn (2 grid units = 20px) */
export const PORT_CLEARANCE = G.x2;

/** Grid resolution for pathfinding (matches base grid = 10px) */
export const GRID_SIZE = G.unit;

/** Handle tip offset from block edge (0.5 grid units = 5px) */
export const HANDLE_OFFSET = G.unit / 2;

/** Arrow head length - stub should start within arrowhead (0.25 grid units = 2.5px) */
export const ARROW_INSET = G.unit / 4;
