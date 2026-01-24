/**
 * Routing module public API
 */

// Route calculation
export { calculateRoute, calculateRouteWithWaypoints, calculateSimpleRoute, getPathCells } from './routeCalculator';

// Grid
export { SparseGrid } from './gridBuilder';

// Constants used by FlowCanvas
export { ROUTING_MARGIN, HANDLE_OFFSET, ARROW_INSET } from './constants';

// Types
export type { Bounds, RoutingContext, RouteResult, Direction, PortStub } from './types';
