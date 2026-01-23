/**
 * Main route calculation orchestrator
 */

import type { Position } from '$lib/types/common';
import type { Connection, Waypoint } from '$lib/types/nodes';
import type { RoutingContext, RouteResult, RouteSegment, Direction } from './types';
import { DIRECTION_VECTORS } from './types';
import { buildGrid, getGridOffset } from './gridBuilder';
import { findPathWithTurnPenalty } from './pathfinder';
import { simplifyPath, snapPathToGrid, deduplicatePath } from './pathOptimizer';
import { SOURCE_CLEARANCE, TARGET_CLEARANCE } from './constants';

let waypointIdCounter = 0;

function generateWaypointId(): string {
	return `wp_${Date.now()}_${waypointIdCounter++}`;
}

/**
 * Calculate clearance point - a point at given distance from port in the port's facing direction
 */
function getClearancePoint(portPos: Position, direction: Direction, clearance: number): Position {
	if (clearance === 0) return portPos;
	const vec = DIRECTION_VECTORS[direction];
	return {
		x: portPos.x + vec.x * clearance,
		y: portPos.y + vec.y * clearance
	};
}

/**
 * Calculate route for a connection, respecting user waypoints and enforcing port directions
 * @param connection - Connection with optional user waypoints
 * @param sourcePos - Source port world position
 * @param targetPos - Target port world position
 * @param sourceDir - Direction the source port faces (wire exits in this direction)
 * @param targetDir - Direction the target port faces (wire enters from opposite direction)
 * @param context - Routing context with node bounds
 * @returns Route result with path, waypoints, and segments
 */
export function calculateRoute(
	connection: Connection,
	sourcePos: Position,
	targetPos: Position,
	sourceDir: Direction,
	targetDir: Direction,
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

	// Calculate clearance points to enforce entry/exit directions
	const sourceClearance = getClearancePoint(sourcePos, sourceDir, SOURCE_CLEARANCE);
	// Target clearance: place point outside the block in the direction the port faces
	// Wire will travel TO this point, then straight INTO the port
	const targetClearance = getClearancePoint(targetPos, targetDir, TARGET_CLEARANCE);

	// Build path: source -> sourceClearance -> [waypoints] -> targetClearance -> target
	const allPoints: Position[] = [];
	const allWaypoints: Waypoint[] = [];

	// Start with source clearance segment (if clearance > 0)
	if (SOURCE_CLEARANCE > 0) {
		allPoints.push(sourceClearance);
	}

	// Start pathfinding from source clearance (or source if no clearance)
	let currentPos = SOURCE_CLEARANCE > 0 ? sourceClearance : sourcePos;
	let currentDir = sourceDir; // Track current direction for turn penalties

	// Route through each user waypoint
	for (const userWp of userWaypoints) {
		const segmentPath = findPathWithTurnPenalty(currentPos, userWp.position, grid, offset, currentDir);
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

		// Update current direction based on last segment
		if (simplified.length >= 2) {
			currentDir = getDirectionFromSegment(simplified[simplified.length - 2], simplified[simplified.length - 1]);
		}
	}

	// Route to target clearance point
	const finalPath = findPathWithTurnPenalty(currentPos, targetClearance, grid, offset, currentDir);
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

	// Add target clearance point
	allPoints.push(targetClearance);

	// Build complete path: source -> clearance -> intermediate -> clearance -> target
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
 * Get direction from a path segment
 */
function getDirectionFromSegment(from: Position, to: Position): Direction {
	const dx = to.x - from.x;
	const dy = to.y - from.y;

	if (Math.abs(dx) > Math.abs(dy)) {
		return dx > 0 ? 'right' : 'left';
	} else {
		return dy > 0 ? 'down' : 'up';
	}
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
 * Enforces exit direction from source
 */
export function calculateSimpleRoute(
	sourcePos: Position,
	targetPos: Position,
	sourceDir: Direction = 'right',
	targetDir: Direction = 'left'
): RouteResult {
	const path: Position[] = [sourcePos];

	// Calculate clearance points
	const sourceClearance = getClearancePoint(sourcePos, sourceDir, SOURCE_CLEARANCE);
	const targetClearance = getClearancePoint(targetPos, targetDir, TARGET_CLEARANCE);

	// Add source clearance (if any)
	if (SOURCE_CLEARANCE > 0) {
		path.push(sourceClearance);
	}

	// Use appropriate start point for routing calculations
	const routeStart = SOURCE_CLEARANCE > 0 ? sourceClearance : sourcePos;

	// Determine if we need additional bends between clearance points
	const dx = targetClearance.x - routeStart.x;
	const dy = targetClearance.y - routeStart.y;

	// Check if points are aligned (straight connection possible)
	const isHorizontalAligned = Math.abs(dy) < 1;
	const isVerticalAligned = Math.abs(dx) < 1;

	if (!isHorizontalAligned && !isVerticalAligned) {
		// Need intermediate point(s) for orthogonal routing
		// Prefer routing that matches the source exit direction
		if (sourceDir === 'right' || sourceDir === 'left') {
			// Exit horizontally, so go horizontal first, then vertical
			path.push({ x: targetClearance.x, y: routeStart.y });
		} else {
			// Exit vertically, so go vertical first, then horizontal
			path.push({ x: routeStart.x, y: targetClearance.y });
		}
	}

	// Add target clearance and final target
	if (TARGET_CLEARANCE > 0) {
		path.push(targetClearance);
	}
	path.push(targetPos);

	// Deduplicate in case clearance points overlap with source/target
	const finalPath = deduplicatePath(path);
	const segments = buildSegments(finalPath, []);

	return {
		path: finalPath,
		waypoints: [],
		segments
	};
}
