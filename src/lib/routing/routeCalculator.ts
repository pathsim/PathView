/**
 * Main route calculation orchestrator
 */

import type { Position } from '$lib/types/common';
import type { Connection, Waypoint } from '$lib/types/nodes';
import type { RoutingContext, RouteResult, RouteSegment } from './types';
import { buildGrid, getGridOffset } from './gridBuilder';
import { findPath } from './pathfinder';
import { simplifyPath, snapPathToGrid, deduplicatePath } from './pathOptimizer';

let waypointIdCounter = 0;

function generateWaypointId(): string {
	return `wp_${Date.now()}_${waypointIdCounter++}`;
}

/**
 * Calculate route for a connection, respecting user waypoints
 * @param connection - Connection with optional user waypoints
 * @param sourcePos - Source port world position
 * @param targetPos - Target port world position
 * @param context - Routing context with node bounds
 * @returns Route result with path, waypoints, and segments
 */
export function calculateRoute(
	connection: Connection,
	sourcePos: Position,
	targetPos: Position,
	context: RoutingContext
): RouteResult {
	// Get user waypoints, sorted by proximity to source
	const userWaypoints = (connection.waypoints || [])
		.filter((w) => w.isUserWaypoint)
		.sort((a, b) => {
			// Sort by manhattan distance from source
			const distA = Math.abs(a.position.x - sourcePos.x) + Math.abs(a.position.y - sourcePos.y);
			const distB = Math.abs(b.position.x - sourcePos.x) + Math.abs(b.position.y - sourcePos.y);
			return distA - distB;
		});

	// Build pathfinding grid, excluding source and target nodes
	const excludeNodes = new Set([connection.sourceNodeId, connection.targetNodeId]);
	const grid = buildGrid(context, excludeNodes);
	const offset = getGridOffset(context);

	// Build path segments between waypoints
	const allPoints: Position[] = [];
	const allWaypoints: Waypoint[] = [];

	let currentPos = sourcePos;

	// Route through each user waypoint
	for (const userWp of userWaypoints) {
		const segmentPath = findPath(currentPos, userWp.position, grid, offset);
		const simplified = simplifyPath(segmentPath);

		// Add intermediate points (skip first which is currentPos)
		for (let i = 1; i < simplified.length - 1; i++) {
			allPoints.push(simplified[i]);
			// Create auto waypoint for intermediate points
			allWaypoints.push({
				id: generateWaypointId(),
				position: simplified[i],
				isUserWaypoint: false
			});
		}

		// Add user waypoint position
		allPoints.push(userWp.position);
		allWaypoints.push(userWp);
		currentPos = userWp.position;
	}

	// Final segment to target
	const finalPath = findPath(currentPos, targetPos, grid, offset);
	const simplified = simplifyPath(finalPath);

	// Add intermediate points from final segment
	for (let i = 1; i < simplified.length - 1; i++) {
		allPoints.push(simplified[i]);
		allWaypoints.push({
			id: generateWaypointId(),
			position: simplified[i],
			isUserWaypoint: false
		});
	}

	// Build complete path: source -> all intermediate points -> target
	const fullPath = [sourcePos, ...allPoints, targetPos];

	// Snap to grid and deduplicate
	const snappedPath = deduplicatePath(snapPathToGrid(fullPath));

	// Build segment info
	const segments = buildSegments(snappedPath, allWaypoints);

	return {
		path: snappedPath,
		waypoints: allWaypoints,
		segments
	};
}

/**
 * Build segment info from path and waypoints
 */
function buildSegments(path: Position[], waypoints: Waypoint[]): RouteSegment[] {
	const segments: RouteSegment[] = [];

	// Create set of user waypoint positions for fast lookup
	const userWaypointPositions = new Set(
		waypoints.filter((w) => w.isUserWaypoint).map((w) => `${w.position.x},${w.position.y}`)
	);

	for (let i = 0; i < path.length - 1; i++) {
		const start = path[i];
		const end = path[i + 1];
		const isHorizontal = start.y === end.y;

		// Segment is "user" if either endpoint is a user waypoint
		const startKey = `${start.x},${start.y}`;
		const endKey = `${end.x},${end.y}`;
		const isUserSegment = userWaypointPositions.has(startKey) || userWaypointPositions.has(endKey);

		segments.push({
			index: i,
			startPoint: start,
			endPoint: end,
			isHorizontal,
			isUserSegment
		});
	}

	return segments;
}

/**
 * Calculate simple L-shaped or Z-shaped route without pathfinding
 * Used as fallback when no obstacles or for performance
 */
export function calculateSimpleRoute(sourcePos: Position, targetPos: Position): RouteResult {
	const path: Position[] = [sourcePos];

	// Determine if we need an L-shape or Z-shape
	const dx = targetPos.x - sourcePos.x;
	const dy = targetPos.y - sourcePos.y;

	if (dx !== 0 && dy !== 0) {
		// Need a bend - use L-shape (horizontal first, then vertical)
		const midPoint = { x: targetPos.x, y: sourcePos.y };
		path.push(midPoint);
	}

	path.push(targetPos);

	const segments = buildSegments(path, []);

	return {
		path,
		waypoints: [],
		segments
	};
}
