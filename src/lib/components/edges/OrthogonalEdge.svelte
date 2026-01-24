<script lang="ts">
	import { BaseEdge, type EdgeProps, Position } from '@xyflow/svelte';
	import { hoveredHandle, selectedNodeHighlight } from '$lib/stores/hoveredHandle';
	import { routingStore, type PortInfo } from '$lib/stores/routing';
	import { historyStore } from '$lib/stores/history';
	import { screenToFlow } from '$lib/utils/viewUtils';
	import { GRID_SIZE } from '$lib/routing/constants';
	import type { RouteResult, Direction } from '$lib/routing';
	import type { Waypoint } from '$lib/types/nodes';

	let {
		id,
		source,
		target,
		sourceHandleId,
		targetHandleId,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		style,
		selected,
		data
	}: EdgeProps = $props();

	import { onDestroy } from 'svelte';

	// Convert SvelteFlow Position to routing Direction
	function positionToDirection(pos: Position): Direction {
		switch (pos) {
			case Position.Left: return 'left';
			case Position.Right: return 'right';
			case Position.Top: return 'up';
			case Position.Bottom: return 'down';
			default: return 'right';
		}
	}

	// Create getPortInfo callback for route recalculation during drag
	function getPortInfo(nodeId: string, portIndex: number, isOutput: boolean): PortInfo | null {
		if (isOutput && nodeId === source) {
			return {
				position: { x: sourceX, y: sourceY },
				direction: positionToDirection(sourcePosition)
			};
		}
		if (!isOutput && nodeId === target) {
			return {
				position: { x: targetX, y: targetY },
				direction: positionToDirection(targetPosition)
			};
		}
		return null;
	}

	// Drag state for waypoint markers
	let isDragging = $state(false);
	let draggingWaypointId = $state<string | null>(null);
	let lastSnappedPos = $state<{ x: number; y: number } | null>(null);

	// Drag handlers for waypoint markers - using pointer events with capture
	function handleWaypointPointerDown(event: PointerEvent, waypoint: Waypoint) {
		event.stopPropagation();
		event.preventDefault();

		const target = event.currentTarget as SVGCircleElement;
		target.setPointerCapture(event.pointerId);

		isDragging = true;
		draggingWaypointId = waypoint.id;
		lastSnappedPos = { ...waypoint.position };
		historyStore.beginDrag();
	}

	function handleWaypointPointerMove(event: PointerEvent) {
		if (!isDragging || !draggingWaypointId) return;

		event.stopPropagation();
		event.preventDefault();

		const flowPos = screenToFlow({ x: event.clientX, y: event.clientY });
		const snappedPos = {
			x: Math.round(flowPos.x / GRID_SIZE) * GRID_SIZE,
			y: Math.round(flowPos.y / GRID_SIZE) * GRID_SIZE
		};

		// Only update if position actually changed on the grid
		if (lastSnappedPos && snappedPos.x === lastSnappedPos.x && snappedPos.y === lastSnappedPos.y) {
			return;
		}
		lastSnappedPos = snappedPos;

		// Pass getPortInfo for immediate route recalculation
		routingStore.moveWaypoint(id, draggingWaypointId, snappedPos, getPortInfo);
	}

	function handleWaypointPointerUp(event: PointerEvent) {
		if (!isDragging) return;
		event.stopPropagation();
		endDrag();
	}

	// Called when pointer capture is lost (ensures cleanup)
	function handleLostPointerCapture() {
		if (isDragging) {
			endDrag();
		}
	}

	function endDrag() {
		isDragging = false;
		draggingWaypointId = null;
		lastSnappedPos = null;
		historyStore.endDrag();
		// Clean up redundant/collinear waypoints
		routingStore.cleanupWaypoints(id, getPortInfo);
	}

	// Double-click to delete waypoint
	function handleWaypointDoubleClick(event: MouseEvent, waypoint: Waypoint) {
		event.stopPropagation();
		event.preventDefault();
		routingStore.removeUserWaypoint(id, waypoint.id, getPortInfo);
	}

	// Get cached route from routing store
	let routeResult = $state<RouteResult | null>(null);
	let unsubscribeRoute: (() => void) | null = null;

	// Subscribe to route changes using $effect to capture id reactively
	$effect(() => {
		// Unsubscribe from previous if any
		if (unsubscribeRoute) unsubscribeRoute();
		// Subscribe to new route
		unsubscribeRoute = routingStore.getRoute(id).subscribe((r) => (routeResult = r));
	});

	// Cleanup subscription and any active drag listeners
	onDestroy(() => {
		if (unsubscribeRoute) unsubscribeRoute();
		// Clean up document listeners if drag was in progress (must match capture option)
		document.removeEventListener('pointermove', onDocumentPointerMove, { capture: true });
		document.removeEventListener('pointerup', onDocumentPointerUp, { capture: true });
	});

	// Check if this edge is connected to the hovered handle
	let hovered = $state<{ nodeId: string; handleId: string; color?: string } | null>(null);
	hoveredHandle.subscribe((h) => (hovered = h));

	// Check if this edge is connected to a selected node
	let selectedNode = $state<{ nodeId: string; color?: string } | null>(null);
	selectedNodeHighlight.subscribe((s) => (selectedNode = s));

	const isHoverHighlighted = $derived(() => {
		if (!hovered) return false;
		return (
			(source === hovered.nodeId && sourceHandleId === hovered.handleId) ||
			(target === hovered.nodeId && targetHandleId === hovered.handleId)
		);
	});

	const isSelectionHighlighted = $derived(() => {
		if (!selectedNode) return false;
		return source === selectedNode.nodeId || target === selectedNode.nodeId;
	});

	const isHighlighted = $derived(() => isHoverHighlighted() || isSelectionHighlighted());

	const highlightColor = $derived(() => {
		if (isHoverHighlighted()) return hovered?.color || 'var(--accent)';
		if (isSelectionHighlighted()) return selectedNode?.color || 'var(--accent)';
		return 'var(--accent)';
	});

	// Offset to start/end path at handle tips (not centers)
	// Source: small inset from handle edge
	// Target: larger offset to leave room for arrowhead
	const sourceOffset = 0.5;
	const targetOffset = 4.5;

	// Adjusted source position based on handle direction
	const adjustedSource = $derived(() => {
		let x = sourceX;
		let y = sourceY;
		if (sourcePosition === 'right') x -= sourceOffset;
		else if (sourcePosition === 'left') x += sourceOffset;
		else if (sourcePosition === 'bottom') y -= sourceOffset;
		else if (sourcePosition === 'top') y += sourceOffset;
		return { x, y };
	});

	// Adjusted target position based on handle direction
	const adjustedTarget = $derived(() => {
		let x = targetX;
		let y = targetY;
		if (targetPosition === 'right') x += targetOffset;
		else if (targetPosition === 'left') x -= targetOffset;
		else if (targetPosition === 'bottom') y += targetOffset;
		else if (targetPosition === 'top') y -= targetOffset;
		return { x, y };
	});

	// Corner radius for bends (0.5G = 5px)
	const CORNER_RADIUS = 5;

	/**
	 * Build SVG path with rounded corners using quadratic bezier curves
	 */
	function buildRoundedPath(points: Array<{ x: number; y: number }>, radius: number): string {
		if (points.length < 2) return '';
		if (points.length === 2) {
			return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
		}

		let d = `M ${points[0].x} ${points[0].y}`;

		for (let i = 1; i < points.length - 1; i++) {
			const prev = points[i - 1];
			const curr = points[i];
			const next = points[i + 1];

			// Calculate distances to prev and next
			const distPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
			const distNext = Math.hypot(next.x - curr.x, next.y - curr.y);

			// Clamp radius to half the shorter segment
			const r = Math.min(radius, distPrev / 2, distNext / 2);

			if (r < 0.5) {
				// Too short for rounding, just go to point
				d += ` L ${curr.x} ${curr.y}`;
				continue;
			}

			// Direction vectors (normalized)
			const dxPrev = (prev.x - curr.x) / distPrev;
			const dyPrev = (prev.y - curr.y) / distPrev;
			const dxNext = (next.x - curr.x) / distNext;
			const dyNext = (next.y - curr.y) / distNext;

			// Points where curve starts and ends
			const startX = curr.x + dxPrev * r;
			const startY = curr.y + dyPrev * r;
			const endX = curr.x + dxNext * r;
			const endY = curr.y + dyNext * r;

			// Line to curve start, then quadratic bezier with corner as control point
			d += ` L ${startX} ${startY} Q ${curr.x} ${curr.y} ${endX} ${endY}`;
		}

		// Line to final point
		const last = points[points.length - 1];
		d += ` L ${last.x} ${last.y}`;

		return d;
	}

	// Cache last valid path (non-fallback) for smooth transitions
	let cachedPath = $state('');

	// Update cached path only when we have a valid (non-fallback) route
	$effect(() => {
		if (routeResult?.path && routeResult.path.length >= 1 && !routeResult.isFallback) {
			const src = adjustedSource();
			const tgt = adjustedTarget();
			const allPoints = [src, ...routeResult.path, tgt];
			cachedPath = buildRoundedPath(allPoints, CORNER_RADIUS);
		}
	});

	// Always use the cached path - never show fallback routes
	const pathInfo = $derived(() => {
		return { path: cachedPath, isFallback: !cachedPath };
	});

	// Get user waypoints from route result or data
	const userWaypoints = $derived(() => {
		if (routeResult?.waypoints) {
			return routeResult.waypoints.filter((w) => w.isUserWaypoint);
		}
		// Fallback to data if route not calculated yet
		const dataWaypoints = (data as { waypoints?: Waypoint[] })?.waypoints;
		return dataWaypoints?.filter((w) => w.isUserWaypoint) || [];
	});

	// Calculate segment midpoints for adding new waypoints
	const segmentMidpoints = $derived(() => {
		if (!routeResult?.path || routeResult.path.length < 1) return [];

		const src = adjustedSource();
		const tgt = adjustedTarget();
		const allPoints = [src, ...routeResult.path, tgt];
		const waypoints = userWaypoints();

		// Helper to check if a point is too close to any waypoint
		const MIN_DISTANCE_FROM_WAYPOINT = 20;
		const isTooCloseToWaypoint = (x: number, y: number): boolean => {
			for (const wp of waypoints) {
				const dist = Math.hypot(wp.position.x - x, wp.position.y - y);
				if (dist < MIN_DISTANCE_FROM_WAYPOINT) return true;
			}
			return false;
		};

		const midpoints: Array<{ x: number; y: number; segmentIndex: number }> = [];
		for (let i = 0; i < allPoints.length - 1; i++) {
			const p1 = allPoints[i];
			const p2 = allPoints[i + 1];
			// Only show midpoints on segments longer than 30px
			const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
			if (dist > 30) {
				const midX = (p1.x + p2.x) / 2;
				const midY = (p1.y + p2.y) / 2;
				// Skip if too close to an existing waypoint
				if (!isTooCloseToWaypoint(midX, midY)) {
					midpoints.push({
						x: midX,
						y: midY,
						segmentIndex: i
					});
				}
			}
		}
		return midpoints;
	});

	// Segment drag state (for creating new waypoints by dragging segment midpoints)
	// Uses document-level listeners because the segment element gets removed when route updates
	let isSegmentDragging = $state(false);

	// Derived visibility state for waypoints - visible when selected OR during any drag
	const waypointsVisible = $derived(() => selected || isDragging || isSegmentDragging);

	// Document-level handlers for segment drag (bound versions for cleanup)
	function onDocumentPointerMove(event: PointerEvent) {
		if (!isSegmentDragging || !draggingWaypointId) return;

		event.stopPropagation();
		event.preventDefault();

		const flowPos = screenToFlow({ x: event.clientX, y: event.clientY });
		const snappedPos = {
			x: Math.round(flowPos.x / GRID_SIZE) * GRID_SIZE,
			y: Math.round(flowPos.y / GRID_SIZE) * GRID_SIZE
		};

		// Only update if position actually changed on the grid
		if (lastSnappedPos && snappedPos.x === lastSnappedPos.x && snappedPos.y === lastSnappedPos.y) {
			return;
		}
		lastSnappedPos = snappedPos;

		routingStore.moveWaypoint(id, draggingWaypointId, snappedPos, getPortInfo);
	}

	function onDocumentPointerUp(event: PointerEvent) {
		if (!isSegmentDragging) return;
		event.stopPropagation();
		event.preventDefault();
		endSegmentDrag();
	}

	function handleSegmentPointerDown(event: PointerEvent, segmentIndex: number) {
		event.stopPropagation();
		event.preventDefault();

		const flowPos = screenToFlow({ x: event.clientX, y: event.clientY });
		const snappedPos = {
			x: Math.round(flowPos.x / GRID_SIZE) * GRID_SIZE,
			y: Math.round(flowPos.y / GRID_SIZE) * GRID_SIZE
		};

		historyStore.beginDrag();

		// Count how many waypoints appear before this segment in the path
		const waypoints = userWaypoints();
		const insertIndex = countWaypointsBeforeSegment(segmentIndex, waypoints);

		// Create waypoint at correct position in the array
		const waypointId = routingStore.addUserWaypointAtIndex(id, snappedPos, insertIndex, getPortInfo);
		if (waypointId) {
			isSegmentDragging = true;
			draggingWaypointId = waypointId;
			lastSnappedPos = snappedPos;

			// Use document-level listeners for drag continuation
			// (element-level won't work because segment element is removed when route updates)
			// Use capture phase to handle events before SvelteFlow
			document.addEventListener('pointermove', onDocumentPointerMove, { capture: true });
			document.addEventListener('pointerup', onDocumentPointerUp, { capture: true });
		}
	}

	/**
	 * Find the insert index for a new waypoint created on the given segment.
	 * Uses cumulative path distance to determine which existing waypoints
	 * are before vs after the segment.
	 */
	function countWaypointsBeforeSegment(segmentIndex: number, waypoints: Waypoint[]): number {
		if (waypoints.length === 0) return 0;
		if (!routeResult?.path) return 0;

		const src = adjustedSource();
		const tgt = adjustedTarget();
		const allPoints = [src, ...routeResult.path, tgt];

		// Compute cumulative distances along the path
		const cumDist: number[] = [0];
		for (let i = 1; i < allPoints.length; i++) {
			const prev = allPoints[i - 1];
			const curr = allPoints[i];
			cumDist.push(cumDist[i - 1] + Math.hypot(curr.x - prev.x, curr.y - prev.y));
		}

		// Distance to segment midpoint
		const segMidDist = (cumDist[segmentIndex] + cumDist[segmentIndex + 1]) / 2;

		// For each waypoint, find its distance along the path (closest point's cumulative distance)
		let count = 0;
		for (const wp of waypoints) {
			let closestPointDist = Infinity;
			let closestCumDist = 0;
			for (let i = 0; i < allPoints.length; i++) {
				const pt = allPoints[i];
				const dist = Math.hypot(pt.x - wp.position.x, pt.y - wp.position.y);
				if (dist < closestPointDist) {
					closestPointDist = dist;
					closestCumDist = cumDist[i];
				}
			}
			// If waypoint is before segment midpoint along the path, count it
			if (closestCumDist < segMidDist) {
				count++;
			}
		}

		return count;
	}

	function endSegmentDrag() {
		// Remove document listeners (must match capture option)
		document.removeEventListener('pointermove', onDocumentPointerMove, { capture: true });
		document.removeEventListener('pointerup', onDocumentPointerUp, { capture: true });

		isSegmentDragging = false;
		draggingWaypointId = null;
		lastSnappedPos = null;
		historyStore.endDrag();
		// Clean up redundant/collinear waypoints
		routingStore.cleanupWaypoints(id, getPortInfo);
	}

	// Arrow at end of path
	const endArrow = $derived(() => {
		const tgt = adjustedTarget();
		const { isFallback } = pathInfo();

		if (!isFallback && routeResult?.path && routeResult.path.length >= 1) {
			const path = routeResult.path;
			const endPoint = tgt;
			// The last segment is from path's last point (targetStubEnd) to tgt
			const prevPoint = path[path.length - 1];

			const dx = endPoint.x - prevPoint.x;
			const dy = endPoint.y - prevPoint.y;
			const angle = Math.atan2(dy, dx) * (180 / Math.PI);

			return { x: endPoint.x, y: endPoint.y, angle };
		}

		// Fallback (smoothstep): arrow based on target position, use unadjusted target
		let angle = 0;
		if (targetPosition === 'left') angle = 180;
		else if (targetPosition === 'top') angle = -90;
		else if (targetPosition === 'bottom') angle = 90;

		return { x: targetX, y: targetY, angle };
	});
</script>

<g class:highlighted={isHighlighted()} style="--highlight-color: {highlightColor()}">
	<BaseEdge {id} path={pathInfo().path} {style} />

	<!-- User waypoint markers (always in DOM, visibility controlled by derived state) -->
	<g
		class="waypoint-group"
		style="opacity: {waypointsVisible() ? 1 : 0}; pointer-events: {waypointsVisible() ? 'all' : 'none'};"
	>
		{#each userWaypoints() as waypoint (waypoint.id)}
			<circle
				cx={waypoint.position.x}
				cy={waypoint.position.y}
				r="4"
				class="waypoint-marker"
				class:dragging={isDragging && draggingWaypointId === waypoint.id}
				onpointerdown={(e) => handleWaypointPointerDown(e, waypoint)}
				onpointermove={handleWaypointPointerMove}
				onpointerup={handleWaypointPointerUp}
				onlostpointercapture={handleLostPointerCapture}
				ondblclick={(e) => handleWaypointDoubleClick(e, waypoint)}
			/>
		{/each}

		<!-- Segment midpoint indicators (ghost waypoints) -->
		{#each segmentMidpoints() as midpoint (midpoint.segmentIndex)}
			<circle
				cx={midpoint.x}
				cy={midpoint.y}
				r="3"
				class="segment-midpoint"
				onpointerdown={(e) => handleSegmentPointerDown(e, midpoint.segmentIndex)}
			/>
		{/each}
	</g>

	<!-- Arrow at the end - offset forward 5px to reach target handle tip -->
	<g
		transform="translate({endArrow().x}, {endArrow().y}) rotate({endArrow().angle}) translate(5, 0)"
	>
		<path
			d="M -5 -2.5 L -1 -0.5 Q 0 0 -1 0.5 L -5 2.5 Q -6 3 -6 2 L -6 -2 Q -6 -3 -5 -2.5 Z"
			class="edge-arrow"
			class:selected
			class:highlighted={isHighlighted()}
		/>
	</g>
</g>

<style>
	.edge-arrow {
		fill: var(--edge);
		stroke: none;
		transition:
			fill 0.15s ease,
			transform 0.15s ease;
	}

	.edge-arrow.selected {
		fill: var(--accent);
		transform: scale(1.3);
	}

	.edge-arrow.highlighted {
		fill: var(--highlight-color, var(--accent));
	}

	:global(.svelte-flow__edge:hover) .edge-arrow {
		fill: var(--accent);
	}

	/* Highlight the edge path when handle is hovered */
	.highlighted :global(.svelte-flow__edge-path) {
		stroke: var(--highlight-color, var(--accent)) !important;
	}

	/* Waypoint group - visibility controlled by inline styles */
	.waypoint-group {
		transition: opacity 0.1s ease;
	}

	/* Waypoint markers (SVG circles) */
	.waypoint-marker {
		fill: var(--surface);
		stroke: var(--accent);
		stroke-width: 1.5;
		cursor: grab;
		touch-action: none;
		transition: fill 0.15s ease;
	}

	.waypoint-marker.dragging {
		cursor: grabbing;
		stroke-width: 2;
		fill: var(--accent);
	}

	/* Segment midpoint indicators (SVG circles) */
	.segment-midpoint {
		fill: var(--surface);
		stroke: var(--edge);
		stroke-width: 1;
		cursor: grab;
		touch-action: none;
		opacity: 0.5;
		transition:
			opacity 0.15s ease,
			stroke 0.15s ease;
	}

	.segment-midpoint:hover {
		opacity: 1;
		stroke: var(--accent);
	}
</style>
