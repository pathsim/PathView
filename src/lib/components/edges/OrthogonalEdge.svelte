<script lang="ts">
	import { BaseEdge, getSmoothStepPath, type EdgeProps, Position } from '@xyflow/svelte';
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

	// Drag handlers for waypoint markers - using pointer events with capture
	function handleWaypointPointerDown(event: PointerEvent, waypoint: Waypoint) {
		event.stopPropagation();
		event.preventDefault();

		const target = event.currentTarget as SVGCircleElement;
		target.setPointerCapture(event.pointerId);

		isDragging = true;
		draggingWaypointId = waypoint.id;
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
		historyStore.endDrag();
	}

	// Double-click to delete waypoint
	function handleWaypointDoubleClick(event: MouseEvent, waypoint: Waypoint) {
		event.stopPropagation();
		event.preventDefault();
		routingStore.removeUserWaypoint(id, waypoint.id);
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

	// Cleanup subscription
	onDestroy(() => {
		if (unsubscribeRoute) unsubscribeRoute();
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

	// Build SVG path from route points or fallback to smoothstep
	// Returns { path, isFallback } to avoid state mutation in derived
	const pathInfo = $derived(() => {
		const src = adjustedSource();
		const tgt = adjustedTarget();

		if (routeResult?.path && routeResult.path.length >= 1) {
			// Full path: src -> route points -> tgt
			const allPoints = [src, ...routeResult.path, tgt];
			return { path: buildRoundedPath(allPoints, CORNER_RADIUS), isFallback: false };
		}

		// Fallback: use SvelteFlow's smoothstep path
		const [path] = getSmoothStepPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition,
			borderRadius: CORNER_RADIUS
		});
		return { path, isFallback: true };
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

		const midpoints: Array<{ x: number; y: number; segmentIndex: number }> = [];
		for (let i = 0; i < allPoints.length - 1; i++) {
			const p1 = allPoints[i];
			const p2 = allPoints[i + 1];
			// Only show midpoints on segments longer than 30px
			const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
			if (dist > 30) {
				midpoints.push({
					x: (p1.x + p2.x) / 2,
					y: (p1.y + p2.y) / 2,
					segmentIndex: i
				});
			}
		}
		return midpoints;
	});

	// Segment drag state (for creating new waypoints by dragging segment midpoints)
	let isSegmentDragging = $state(false);

	function handleSegmentPointerDown(event: PointerEvent, segmentIndex: number) {
		event.stopPropagation();
		event.preventDefault();

		const target = event.currentTarget as SVGCircleElement;
		target.setPointerCapture(event.pointerId);

		const flowPos = screenToFlow({ x: event.clientX, y: event.clientY });
		const snappedPos = {
			x: Math.round(flowPos.x / GRID_SIZE) * GRID_SIZE,
			y: Math.round(flowPos.y / GRID_SIZE) * GRID_SIZE
		};

		historyStore.beginDrag();

		// Create waypoint at drag start position
		const waypointId = routingStore.addUserWaypoint(id, snappedPos);
		if (waypointId) {
			isSegmentDragging = true;
			draggingWaypointId = waypointId;
		}
	}

	function handleSegmentPointerMove(event: PointerEvent) {
		if (!isSegmentDragging || !draggingWaypointId) return;

		event.stopPropagation();
		event.preventDefault();

		const flowPos = screenToFlow({ x: event.clientX, y: event.clientY });
		const snappedPos = {
			x: Math.round(flowPos.x / GRID_SIZE) * GRID_SIZE,
			y: Math.round(flowPos.y / GRID_SIZE) * GRID_SIZE
		};

		routingStore.moveWaypoint(id, draggingWaypointId, snappedPos, getPortInfo);
	}

	function handleSegmentPointerUp(event: PointerEvent) {
		if (!isSegmentDragging) return;
		event.stopPropagation();
		endSegmentDrag();
	}

	function handleSegmentLostPointerCapture() {
		if (isSegmentDragging) {
			endSegmentDrag();
		}
	}

	function endSegmentDrag() {
		isSegmentDragging = false;
		draggingWaypointId = null;
		historyStore.endDrag();
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

	<!-- User waypoint markers (shown when edge is selected) -->
	{#if selected}
		{#each userWaypoints() as waypoint (waypoint.id)}
			<circle
				cx={waypoint.position.x}
				cy={waypoint.position.y}
				r="6"
				class="waypoint-marker"
				class:dragging={isDragging && draggingWaypointId === waypoint.id}
				role="button"
				tabindex="-1"
				pointer-events="all"
				onpointerdown={(e) => handleWaypointPointerDown(e, waypoint)}
				onpointermove={handleWaypointPointerMove}
				onpointerup={handleWaypointPointerUp}
				onlostpointercapture={handleLostPointerCapture}
				ondblclick={(e) => handleWaypointDoubleClick(e, waypoint)}
			/>
		{/each}
	{/if}

	<!-- Segment midpoint indicators (shown when edge is selected) -->
	{#if selected}
		{#each segmentMidpoints() as midpoint (midpoint.segmentIndex)}
			<circle
				cx={midpoint.x}
				cy={midpoint.y}
				r="5"
				class="segment-midpoint"
				role="button"
				tabindex="-1"
				pointer-events="all"
				onpointerdown={(e) => handleSegmentPointerDown(e, midpoint.segmentIndex)}
				onpointermove={handleSegmentPointerMove}
				onpointerup={handleSegmentPointerUp}
				onlostpointercapture={handleSegmentLostPointerCapture}
			/>
		{/each}
	{/if}

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

	/* Waypoint markers */
	.waypoint-marker {
		fill: var(--surface-raised);
		stroke: var(--edge);
		stroke-width: 2;
		cursor: grab;
		touch-action: none;
		transition:
			stroke 0.15s ease,
			fill 0.15s ease;
	}

	.waypoint-marker:hover {
		stroke: var(--accent);
		stroke-width: 2.5;
	}

	.waypoint-marker.selected {
		stroke: var(--accent);
		fill: color-mix(in srgb, var(--accent) 30%, var(--surface-raised));
	}

	.waypoint-marker.dragging {
		cursor: grabbing;
		stroke: var(--accent);
		stroke-width: 3;
		fill: var(--accent);
	}

	/* Segment midpoint indicators for adding waypoints */
	.segment-midpoint {
		fill: var(--surface-raised);
		stroke: var(--edge);
		stroke-width: 1.5;
		cursor: grab;
		touch-action: none;
		opacity: 0.7;
		transition:
			opacity 0.15s ease,
			stroke 0.15s ease;
	}

	.segment-midpoint:hover {
		opacity: 1;
		stroke: var(--accent);
		stroke-width: 2;
	}
</style>
