/**
 * Routing store - manages route calculations and caching
 */

import { writable, derived, get } from 'svelte/store';
import type { Position } from '$lib/types/common';
import type { Connection, Waypoint } from '$lib/types/nodes';
import type { RoutingContext, RouteResult, Bounds, Direction, PortStub } from '$lib/routing';
import { calculateRoute, calculateRouteWithWaypoints, calculateSimpleRoute, getPathCells, ROUTING_MARGIN } from '$lib/routing';
import { SparseGrid } from '$lib/routing/gridBuilder';
import { generateId } from '$lib/stores/utils';
import { graphStore } from '$lib/stores/graph';
import { historyStore } from '$lib/stores/history';

/** Port info returned from getPortInfo callback */
export interface PortInfo {
	position: Position;
	direction: Direction;
}

/** Helper to extract user waypoints from a connection's waypoints array */
function getUserWaypoints(waypoints?: Waypoint[]): Waypoint[] {
	return (waypoints || []).filter((w) => w.isUserWaypoint);
}

interface RoutingState {
	/** Cached routes by connection ID */
	routes: Map<string, RouteResult>;
	/** Current routing context (node bounds) */
	context: RoutingContext | null;
	/** Sparse grid built from context - O(obstacles) memory */
	grid: SparseGrid | null;
}

const state = writable<RoutingState>({
	routes: new Map(),
	context: null,
	grid: null
});

/**
 * Routing store - manages route calculations and caching
 */
export const routingStore = {
	subscribe: state.subscribe,

	/**
	 * Update routing context from current nodes
	 * Uses incremental updates when possible for better performance
	 */
	setContext(nodeBounds: Map<string, Bounds>, canvasBounds: Bounds, portStubs?: PortStub[]): void {
		const context: RoutingContext = { nodeBounds, canvasBounds, portStubs };

		state.update((s) => {
			let grid = s.grid;

			if (!grid) {
				// First time - build full grid
				grid = new SparseGrid(context);
			} else {
				// Incremental update
				grid.updateBounds(canvasBounds);

				// Update changed nodes, add new ones, remove deleted ones
				const currentNodeIds = new Set(nodeBounds.keys());
				const existingNodeIds = new Set<string>();

				// Track which nodes exist in the grid (we need to check via context)
				if (s.context) {
					for (const nodeId of s.context.nodeBounds.keys()) {
						existingNodeIds.add(nodeId);
					}
				}

				// Update or add nodes
				for (const [nodeId, bounds] of nodeBounds) {
					grid.updateNode(nodeId, bounds);
				}

				// Remove deleted nodes
				for (const nodeId of existingNodeIds) {
					if (!currentNodeIds.has(nodeId)) {
						grid.removeNode(nodeId);
					}
				}

				// Update port stubs
				grid.updatePortStubs(portStubs);
			}

			return { ...s, context, grid };
		});
	},

	/**
	 * Update a single node's bounds - O(1) incremental update
	 * Use this during node dragging for best performance
	 */
	updateNodeBounds(nodeId: string, bounds: Bounds): void {
		state.update((s) => {
			if (s.grid) {
				s.grid.updateNode(nodeId, bounds);
			}
			if (s.context) {
				s.context.nodeBounds.set(nodeId, bounds);
			}
			return s;
		});
	},

	/**
	 * Recalculate only routes connected to specific nodes
	 * Much faster than recalculateAllRoutes during node dragging
	 */
	recalculateRoutesForNodes(
		nodeIds: Set<string>,
		connections: Connection[],
		getPortInfo: (nodeId: string, portIndex: number, isOutput: boolean) => PortInfo | null
	): void {
		const $state = get(state);
		if (!$state.grid) return;

		// Filter connections to only those connected to the specified nodes
		const affectedConnections = connections.filter(
			(c) => nodeIds.has(c.sourceNodeId) || nodeIds.has(c.targetNodeId)
		);

		if (affectedConnections.length === 0) return;

		const routes = new Map<string, RouteResult>($state.routes);

		for (const conn of affectedConnections) {
			const sourceInfo = getPortInfo(conn.sourceNodeId, conn.sourcePortIndex, true);
			const targetInfo = getPortInfo(conn.targetNodeId, conn.targetPortIndex, false);

			if (!sourceInfo || !targetInfo) continue;

			const userWaypoints = getUserWaypoints(conn.waypoints);

			const result = userWaypoints.length > 0
				? calculateRouteWithWaypoints(
					sourceInfo.position,
					targetInfo.position,
					sourceInfo.direction,
					targetInfo.direction,
					$state.grid,
					userWaypoints
				)
				: calculateRoute(
					sourceInfo.position,
					targetInfo.position,
					sourceInfo.direction,
					targetInfo.direction,
					$state.grid
				);

			routes.set(conn.id, result);
		}

		state.update((s) => ({ ...s, routes }));
	},

	/**
	 * Get route for a specific connection (as a derived store)
	 */
	getRoute(connectionId: string) {
		return derived(state, ($state) => $state.routes.get(connectionId) || null);
	},

	/**
	 * Get route synchronously (non-reactive)
	 */
	getRouteSync(connectionId: string): RouteResult | null {
		return get(state).routes.get(connectionId) || null;
	},

	/**
	 * Calculate and cache route for a single connection
	 */
	calcRoute(
		connection: Connection,
		sourcePos: Position,
		targetPos: Position,
		sourceDir: Direction = 'right',
		targetDir: Direction = 'left'
	): RouteResult | null {
		const $state = get(state);

		// Extract user waypoints from connection
		const userWaypoints = getUserWaypoints(connection.waypoints);

		let result: RouteResult;
		if ($state.grid) {
			if (userWaypoints.length > 0) {
				result = calculateRouteWithWaypoints(
					sourcePos,
					targetPos,
					sourceDir,
					targetDir,
					$state.grid,
					userWaypoints
				);
			} else {
				result = calculateRoute(sourcePos, targetPos, sourceDir, targetDir, $state.grid);
			}
		} else {
			// No grid - use simple routing
			result = calculateSimpleRoute(sourcePos, targetPos, sourceDir, targetDir);
		}

		state.update((s) => {
			const routes = new Map(s.routes);
			routes.set(connection.id, result);
			return { ...s, routes };
		});

		return result;
	},

	/**
	 * Recalculate all routes with path overlap avoidance
	 * @param connections - All connections to route
	 * @param getPortInfo - Function to get port world position and direction
	 */
	recalculateAllRoutes(
		connections: Connection[],
		getPortInfo: (nodeId: string, portIndex: number, isOutput: boolean) => PortInfo | null
	): void {
		const $state = get(state);

		// Start with existing routes to preserve them if recalculation fails
		const routes = new Map<string, RouteResult>($state.routes);
		const usedCells = new Map<string, Set<Direction>>();

		// Sort connections by Manhattan distance (longest first)
		// Longer routes are less likely to block shorter ones
		const sortedConnections = [...connections].sort((a, b) => {
			const aSource = getPortInfo(a.sourceNodeId, a.sourcePortIndex, true);
			const aTarget = getPortInfo(a.targetNodeId, a.targetPortIndex, false);
			const bSource = getPortInfo(b.sourceNodeId, b.sourcePortIndex, true);
			const bTarget = getPortInfo(b.targetNodeId, b.targetPortIndex, false);

			const aDist = aSource && aTarget
				? Math.abs(aTarget.position.x - aSource.position.x) + Math.abs(aTarget.position.y - aSource.position.y)
				: 0;
			const bDist = bSource && bTarget
				? Math.abs(bTarget.position.x - bSource.position.x) + Math.abs(bTarget.position.y - bSource.position.y)
				: 0;

			return bDist - aDist; // Longest first
		});

		// Group connections by source port so paths from same port can share cells
		const bySourcePort = new Map<string, Connection[]>();
		for (const conn of sortedConnections) {
			const key = `${conn.sourceNodeId}:${conn.sourcePortIndex}`;
			const group = bySourcePort.get(key) || [];
			group.push(conn);
			bySourcePort.set(key, group);
		}

		// Process each source port group
		for (const [, groupConns] of bySourcePort) {
			const groupCells: Map<string, Set<Direction>>[] = [];

			// Calculate routes for all connections from this source port
			for (const conn of groupConns) {
				const sourceInfo = getPortInfo(conn.sourceNodeId, conn.sourcePortIndex, true);
				const targetInfo = getPortInfo(conn.targetNodeId, conn.targetPortIndex, false);

				if (!sourceInfo || !targetInfo) continue;

				// Extract user waypoints from connection
				const userWaypoints = getUserWaypoints(conn.waypoints);

				let result: RouteResult;
				if ($state.grid) {
					if (userWaypoints.length > 0) {
						result = calculateRouteWithWaypoints(
							sourceInfo.position,
							targetInfo.position,
							sourceInfo.direction,
							targetInfo.direction,
							$state.grid,
							userWaypoints,
							usedCells
						);
					} else {
						result = calculateRoute(
							sourceInfo.position,
							targetInfo.position,
							sourceInfo.direction,
							targetInfo.direction,
							$state.grid,
							usedCells
						);
					}
				} else {
					result = calculateSimpleRoute(
						sourceInfo.position,
						targetInfo.position,
						sourceInfo.direction,
						targetInfo.direction
					);
				}
				routes.set(conn.id, result);

				// Collect cells for this path (add to usedCells after processing whole group)
				if (result.path.length > 0) {
					groupCells.push(getPathCells(result.path, 2));
				}
			}

			// Add all cells from this group to usedCells for subsequent groups
			for (const cells of groupCells) {
				for (const [cellKey, dirs] of cells) {
					if (!usedCells.has(cellKey)) usedCells.set(cellKey, new Set());
					for (const dir of dirs) {
						usedCells.get(cellKey)!.add(dir);
					}
				}
			}
		}

		state.update((s) => ({ ...s, routes }));
	},

	/**
	 * Invalidate route for a specific connection (will be recalculated on next render)
	 */
	invalidateRoute(connectionId: string): void {
		state.update((s) => {
			const routes = new Map(s.routes);
			routes.delete(connectionId);
			return { ...s, routes };
		});
	},

	/**
	 * Invalidate routes for connections involving specific nodes
	 */
	invalidateRoutesForNodes(nodeIds: Set<string>): void {
		const connections = get(graphStore.connections);
		const toInvalidate = connections.filter(
			(c) => nodeIds.has(c.sourceNodeId) || nodeIds.has(c.targetNodeId)
		);

		state.update((s) => {
			const routes = new Map(s.routes);
			for (const conn of toInvalidate) {
				routes.delete(conn.id);
			}
			return { ...s, routes };
		});
	},

	/**
	 * Add a user waypoint to a connection
	 * @param getPortInfo - Optional callback to get port info for immediate route recalculation
	 */
	addUserWaypoint(
		connectionId: string,
		position: Position,
		getPortInfo?: (nodeId: string, portIndex: number, isOutput: boolean) => PortInfo | null
	): string | null {
		let waypointId: string | null = null;
		historyStore.mutate(() => {
			const connections = get(graphStore.connections);
			const connection = connections.find((c) => c.id === connectionId);
			if (!connection) return;

			waypointId = generateId();
			const newWaypoint: Waypoint = {
				id: waypointId,
				position,
				isUserWaypoint: true
			};

			// Get existing user waypoints (filter out auto waypoints)
			const existingUserWaypoints = getUserWaypoints(connection.waypoints);
			const updatedWaypoints = [...existingUserWaypoints, newWaypoint];

			graphStore.updateConnectionWaypoints(connectionId, updatedWaypoints);

			// Immediately recalculate route if we have port info (prevents full recalc)
			if (getPortInfo) {
				const $state = get(state);
				const sourceInfo = getPortInfo(connection.sourceNodeId, connection.sourcePortIndex, true);
				const targetInfo = getPortInfo(connection.targetNodeId, connection.targetPortIndex, false);

				if (sourceInfo && targetInfo && $state.grid) {
					const result = calculateRouteWithWaypoints(
						sourceInfo.position,
						targetInfo.position,
						sourceInfo.direction,
						targetInfo.direction,
						$state.grid,
						updatedWaypoints
					);

					state.update((s) => {
						const routes = new Map(s.routes);
						routes.set(connectionId, result);
						return { ...s, routes };
					});
					return;
				}
			}

			// Fallback: just invalidate
			routingStore.invalidateRoute(connectionId);
		});
		return waypointId;
	},

	/**
	 * Add a user waypoint at a specific index (for segment dragging)
	 * @param getPortInfo - Optional callback to get port info for immediate route recalculation
	 * @returns The ID of the new waypoint
	 */
	addUserWaypointAtIndex(
		connectionId: string,
		position: Position,
		insertIndex: number,
		getPortInfo?: (nodeId: string, portIndex: number, isOutput: boolean) => PortInfo | null
	): string | null {
		let waypointId: string | null = null;
		historyStore.mutate(() => {
			const connections = get(graphStore.connections);
			const connection = connections.find((c) => c.id === connectionId);
			if (!connection) return;

			waypointId = generateId();
			const newWaypoint: Waypoint = {
				id: waypointId,
				position,
				isUserWaypoint: true
			};

			// Get existing user waypoints
			const existingUserWaypoints = getUserWaypoints(connection.waypoints);

			// Insert at the specified index
			const updatedWaypoints = [
				...existingUserWaypoints.slice(0, insertIndex),
				newWaypoint,
				...existingUserWaypoints.slice(insertIndex)
			];

			graphStore.updateConnectionWaypoints(connectionId, updatedWaypoints);

			// Immediately recalculate route if we have port info (prevents full recalc)
			if (getPortInfo) {
				const $state = get(state);
				const sourceInfo = getPortInfo(connection.sourceNodeId, connection.sourcePortIndex, true);
				const targetInfo = getPortInfo(connection.targetNodeId, connection.targetPortIndex, false);

				if (sourceInfo && targetInfo && $state.grid) {
					const result = calculateRouteWithWaypoints(
						sourceInfo.position,
						targetInfo.position,
						sourceInfo.direction,
						targetInfo.direction,
						$state.grid,
						updatedWaypoints
					);

					state.update((s) => {
						const routes = new Map(s.routes);
						routes.set(connectionId, result);
						return { ...s, routes };
					});
					return;
				}
			}

			// Fallback: just invalidate
			routingStore.invalidateRoute(connectionId);
		});
		return waypointId;
	},

	/**
	 * Remove a user waypoint from a connection
	 * @param getPortInfo - Optional callback to get port info for immediate route recalculation
	 */
	removeUserWaypoint(
		connectionId: string,
		waypointId: string,
		getPortInfo?: (nodeId: string, portIndex: number, isOutput: boolean) => PortInfo | null
	): void {
		historyStore.mutate(() => {
			const connections = get(graphStore.connections);
			const connection = connections.find((c) => c.id === connectionId);
			if (!connection?.waypoints) return;

			const updatedWaypoints = connection.waypoints.filter(
				(w) => w.id !== waypointId || !w.isUserWaypoint
			);

			graphStore.updateConnectionWaypoints(connectionId, updatedWaypoints);

			// Immediately recalculate route if we have port info (prevents flicker)
			if (getPortInfo) {
				const $state = get(state);
				const sourceInfo = getPortInfo(connection.sourceNodeId, connection.sourcePortIndex, true);
				const targetInfo = getPortInfo(connection.targetNodeId, connection.targetPortIndex, false);

				if (sourceInfo && targetInfo && $state.grid) {
					const userWaypoints = getUserWaypoints(updatedWaypoints);
					const result = userWaypoints.length > 0
						? calculateRouteWithWaypoints(
							sourceInfo.position,
							targetInfo.position,
							sourceInfo.direction,
							targetInfo.direction,
							$state.grid,
							userWaypoints
						)
						: calculateRoute(
							sourceInfo.position,
							targetInfo.position,
							sourceInfo.direction,
							targetInfo.direction,
							$state.grid
						);

					state.update((s) => {
						const routes = new Map(s.routes);
						routes.set(connectionId, result);
						return { ...s, routes };
					});
					return;
				}
			}

			// Fallback: just invalidate
			routingStore.invalidateRoute(connectionId);
		});
	},

	/**
	 * Move a waypoint to a new position and recalculate route
	 * @param getPortInfo - Optional callback to get port info for route recalculation
	 */
	moveWaypoint(
		connectionId: string,
		waypointId: string,
		newPosition: Position,
		getPortInfo?: (nodeId: string, portIndex: number, isOutput: boolean) => PortInfo | null
	): void {
		const connections = get(graphStore.connections);
		const connection = connections.find((c) => c.id === connectionId);
		if (!connection?.waypoints) return;

		const updatedWaypoints = connection.waypoints.map((w) =>
			w.id === waypointId ? { ...w, position: newPosition } : w
		);

		graphStore.updateConnectionWaypoints(connectionId, updatedWaypoints);

		// If getPortInfo is provided, recalculate route immediately
		if (getPortInfo) {
			const $state = get(state);
			const sourceInfo = getPortInfo(connection.sourceNodeId, connection.sourcePortIndex, true);
			const targetInfo = getPortInfo(connection.targetNodeId, connection.targetPortIndex, false);

			if (sourceInfo && targetInfo && $state.grid) {
				const userWaypoints = getUserWaypoints(updatedWaypoints);
				const result = userWaypoints.length > 0
					? calculateRouteWithWaypoints(
						sourceInfo.position,
						targetInfo.position,
						sourceInfo.direction,
						targetInfo.direction,
						$state.grid,
						userWaypoints
					)
					: calculateRoute(
						sourceInfo.position,
						targetInfo.position,
						sourceInfo.direction,
						targetInfo.direction,
						$state.grid
					);

				state.update((s) => {
					const routes = new Map(s.routes);
					routes.set(connectionId, result);
					return { ...s, routes };
				});
				return;
			}
		}

		// Fallback: just invalidate
		routingStore.invalidateRoute(connectionId);
	},

	/**
	 * Clean up waypoints after drag ends - removes redundant/collinear waypoints
	 * and merges waypoints that are too close together
	 */
	cleanupWaypoints(
		connectionId: string,
		getPortInfo?: (nodeId: string, portIndex: number, isOutput: boolean) => PortInfo | null
	): void {
		const connections = get(graphStore.connections);
		const connection = connections.find((c) => c.id === connectionId);
		if (!connection?.waypoints) return;

		const userWaypoints = getUserWaypoints(connection.waypoints);
		if (userWaypoints.length === 0) return;

		// Get source and target positions for collinearity check
		let sourceInfo: PortInfo | null = null;
		let targetInfo: PortInfo | null = null;
		if (getPortInfo) {
			sourceInfo = getPortInfo(connection.sourceNodeId, connection.sourcePortIndex, true);
			targetInfo = getPortInfo(connection.targetNodeId, connection.targetPortIndex, false);
		}
		const sourcePos = sourceInfo?.position || null;
		const targetPos = targetInfo?.position || null;

		const MERGE_THRESHOLD = 15; // Pixels - merge waypoints closer than this
		const COLLINEAR_THRESHOLD = 5; // Pixels - consider collinear if deviation less than this

		// Helper to check if point is collinear with prev and next
		const isCollinear = (prev: Position, curr: Position, next: Position): boolean => {
			// Calculate perpendicular distance from curr to line prev->next
			const dx = next.x - prev.x;
			const dy = next.y - prev.y;
			const len = Math.sqrt(dx * dx + dy * dy);
			if (len < 1) return true; // prev and next are same point

			// Perpendicular distance = |cross product| / |line length|
			const cross = Math.abs((curr.x - prev.x) * dy - (curr.y - prev.y) * dx);
			const dist = cross / len;
			return dist < COLLINEAR_THRESHOLD;
		};

		// Helper to check distance between two points
		const distance = (a: Position, b: Position): number => {
			return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
		};

		let cleaned = [...userWaypoints];
		let changed = false;

		// Pass 1: Merge waypoints that are too close together
		for (let i = cleaned.length - 1; i > 0; i--) {
			if (distance(cleaned[i].position, cleaned[i - 1].position) < MERGE_THRESHOLD) {
				// Keep the earlier waypoint, remove the later one
				cleaned.splice(i, 1);
				changed = true;
			}
		}

		// Pass 2: Remove collinear waypoints
		// Build points array: [source, ...waypoints, target]
		const points: Position[] = [];
		if (sourcePos) points.push(sourcePos);
		points.push(...cleaned.map(w => w.position));
		if (targetPos) points.push(targetPos);

		// Check each waypoint for collinearity (skip first and last which are source/target)
		const startIdx = sourcePos ? 1 : 0;
		const endIdx = targetPos ? points.length - 1 : points.length;

		const toRemove = new Set<number>();
		for (let i = startIdx; i < endIdx; i++) {
			const waypointIdx = sourcePos ? i - 1 : i;
			if (waypointIdx < 0 || waypointIdx >= cleaned.length) continue;

			const prev = points[i - 1];
			const curr = points[i];
			const next = points[i + 1];

			if (prev && next && isCollinear(prev, curr, next)) {
				toRemove.add(waypointIdx);
				changed = true;
			}
		}

		// Remove collinear waypoints (in reverse order to preserve indices)
		const removeIndices = Array.from(toRemove).sort((a, b) => b - a);
		for (const idx of removeIndices) {
			cleaned.splice(idx, 1);
		}

		// Only update if something changed
		if (changed) {
			graphStore.updateConnectionWaypoints(connectionId, cleaned);

			// Immediately recalculate route if we have port info (prevents flicker)
			const $state = get(state);
			if (sourceInfo && targetInfo && $state.grid) {
				const result = cleaned.length > 0
					? calculateRouteWithWaypoints(
						sourceInfo.position,
						targetInfo.position,
						sourceInfo.direction,
						targetInfo.direction,
						$state.grid,
						cleaned
					)
					: calculateRoute(
						sourceInfo.position,
						targetInfo.position,
						sourceInfo.direction,
						targetInfo.direction,
						$state.grid
					);

				state.update((s) => {
					const routes = new Map(s.routes);
					routes.set(connectionId, result);
					return { ...s, routes };
				});
			}
		}
	},

	/**
	 * Clear all user waypoints from a connection (reset route)
	 */
	resetRoute(connectionId: string): void {
		historyStore.mutate(() => {
			graphStore.updateConnectionWaypoints(connectionId, []);
			routingStore.invalidateRoute(connectionId);
		});
	},

	/**
	 * Clear all cached routes
	 */
	clearRoutes(): void {
		state.update((s) => ({ ...s, routes: new Map() }));
	},

	/**
	 * Clear routes and grid context (call when navigating between levels)
	 * Forces a full grid rebuild on next setContext call
	 */
	clearContext(): void {
		state.update((s) => ({ ...s, routes: new Map(), context: null, grid: null }));
	}
};

/**
 * Build routing context from SvelteFlow nodes
 */
export function buildRoutingContext(
	nodes: Array<{ id: string; position: Position; width?: number; height?: number; measured?: { width?: number; height?: number } }>,
	padding = 100
): { nodeBounds: Map<string, Bounds>; canvasBounds: Bounds } {
	const nodeBounds = new Map<string, Bounds>();

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const node of nodes) {
		const width = node.measured?.width ?? node.width ?? 80;
		const height = node.measured?.height ?? node.height ?? 40;

		// Node position is center (nodeOrigin = [0.5, 0.5])
		const left = node.position.x - width / 2;
		const top = node.position.y - height / 2;

		nodeBounds.set(node.id, {
			x: left,
			y: top,
			width,
			height
		});

		// Track canvas bounds
		minX = Math.min(minX, left - ROUTING_MARGIN);
		minY = Math.min(minY, top - ROUTING_MARGIN);
		maxX = Math.max(maxX, left + width + ROUTING_MARGIN);
		maxY = Math.max(maxY, top + height + ROUTING_MARGIN);
	}

	// Add padding
	const canvasBounds: Bounds = {
		x: minX - padding,
		y: minY - padding,
		width: maxX - minX + 2 * padding,
		height: maxY - minY + 2 * padding
	};

	return { nodeBounds, canvasBounds };
}
