/**
 * Routing constants
 */

import { G } from '$lib/constants/grid';

/** Margin around nodes for routing (0.25G = 2.5px) */
export const ROUTING_MARGIN = G.unit / 4;

/** Minimum distance from source port before first turn (0 - handle offset is enough) */
export const SOURCE_CLEARANCE = 0;

/** Minimum distance from target port before first turn (1 grid unit = 10px) */
export const TARGET_CLEARANCE = G.unit;

/** Grid resolution for pathfinding (matches base grid = 10px) */
export const GRID_SIZE = G.unit;

/** Handle tip offset from block edge (0.5 grid units = 5px) */
export const HANDLE_OFFSET = G.unit / 2;

/** Arrow head length - stub should start within arrowhead (0.25 grid units = 2.5px) */
export const ARROW_INSET = G.unit / 4;
