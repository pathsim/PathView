/**
 * Routing module public API
 */

export { calculateRoute, calculateSimpleRoute } from './routeCalculator';
export { buildGrid, worldToGrid, gridToWorld, getGridOffset } from './gridBuilder';
export { findPath, findPathWithTurnPenalty } from './pathfinder';
export { simplifyPath, snapToGrid, snapPathToGrid, deduplicatePath } from './pathOptimizer';
export { ROUTING_MARGIN, PORT_CLEARANCE, GRID_SIZE, HANDLE_OFFSET, ARROW_INSET } from './constants';
export type { Bounds, RoutingContext, RouteSegment, RouteResult, Direction } from './types';
export { DIRECTION_VECTORS } from './types';
