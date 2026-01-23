/**
 * Routing store - manages route calculations and caching
 */

import { writable, derived, get } from 'svelte/store';
import type { Position } from '$lib/types/common';
import type { Connection, Waypoint } from '$lib/types/nodes';
import type { RoutingContext, RouteResult, Bounds, Direction, PortStub } from '$lib/routing';
import { calculateRoute, calculateSimpleRoute, getPathCells, prepareRoutingGrid, clearRoutingGrid, ROUTING_MARGIN } from '$lib/routing';
import { generateId } from '$lib/stores/utils';
import { graphStore } from '$lib/stores/graph';
import { historyStore } from '$lib/stores/history';

/** Port info returned from getPortInfo callback */
export interface PortInfo {
	position: Position;
	direction: Direction;
}

interface RoutingState {
	/** Cached routes by connection ID */
	routes: Map<string, RouteResult>;
	/** Current routing context (node bounds) */
	context: RoutingContext | null;
}

const state = writable<RoutingState>({
	routes: new Map(),
	context: null
});

/**
 * Routing store - manages route calculations and caching
 */
export const routingStore = {
	subscribe: state.subscribe,

	/**
	 * Update routing context from current nodes
	 * Call this when nodes are added, removed, or moved
	 */
	setContext(nodeBounds: Map<string, Bounds>, canvasBounds: Bounds, portStubs?: PortStub[]): void {
		const context: RoutingContext = { nodeBounds, canvasBounds, portStubs };
		state.update((s) => ({ ...s, context }));
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
	calculateRoute(
		connection: Connection,
		sourcePos: Position,
		targetPos: Position,
		sourceDir: Direction = 'right',
		targetDir: Direction = 'left'
	): RouteResult | null {
		const $state = get(state);

		let result: RouteResult;
		if ($state.context && $state.context.nodeBounds.size > 0) {
			result = calculateRoute(sourcePos, targetPos, sourceDir, targetDir, $state.context);
		} else {
			// No context or empty - use simple routing
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

		const routes = new Map<string, RouteResult>();
		const usedCells = new Map<string, Set<Direction>>();

		// Pre-build grid once for all routes (performance optimization)
		if ($state.context && $state.context.nodeBounds.size > 0) {
			prepareRoutingGrid($state.context);
		}

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

				let result: RouteResult;
				if ($state.context && $state.context.nodeBounds.size > 0) {
					result = calculateRoute(
						sourceInfo.position,
						targetInfo.position,
						sourceInfo.direction,
						targetInfo.direction,
						$state.context,
						usedCells
					);
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

		// Clear cached grid
		clearRoutingGrid();

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
	 */
	addUserWaypoint(connectionId: string, position: Position): void {
		historyStore.mutate(() => {
			const connections = get(graphStore.connections);
			const connection = connections.find((c) => c.id === connectionId);
			if (!connection) return;

			const newWaypoint: Waypoint = {
				id: generateId(),
				position,
				isUserWaypoint: true
			};

			// Get existing user waypoints (filter out auto waypoints)
			const existingUserWaypoints = (connection.waypoints || []).filter((w) => w.isUserWaypoint);
			const updatedWaypoints = [...existingUserWaypoints, newWaypoint];

			graphStore.updateConnectionWaypoints(connectionId, updatedWaypoints);

			// Invalidate cached route
			routingStore.invalidateRoute(connectionId);
		});
	},

	/**
	 * Remove a user waypoint from a connection
	 */
	removeUserWaypoint(connectionId: string, waypointId: string): void {
		historyStore.mutate(() => {
			const connections = get(graphStore.connections);
			const connection = connections.find((c) => c.id === connectionId);
			if (!connection?.waypoints) return;

			const updatedWaypoints = connection.waypoints.filter(
				(w) => w.id !== waypointId || !w.isUserWaypoint
			);

			graphStore.updateConnectionWaypoints(connectionId, updatedWaypoints);
			routingStore.invalidateRoute(connectionId);
		});
	},

	/**
	 * Move a waypoint to a new position
	 */
	moveWaypoint(connectionId: string, waypointId: string, newPosition: Position): void {
		const connections = get(graphStore.connections);
		const connection = connections.find((c) => c.id === connectionId);
		if (!connection?.waypoints) return;

		const updatedWaypoints = connection.waypoints.map((w) =>
			w.id === waypointId ? { ...w, position: newPosition } : w
		);

		graphStore.updateConnectionWaypoints(connectionId, updatedWaypoints);
		routingStore.invalidateRoute(connectionId);
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
