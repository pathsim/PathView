<script lang="ts">
	import { BaseEdge, type EdgeProps } from '@xyflow/svelte';
	import { hoveredHandle, selectedNodeHighlight } from '$lib/stores/hoveredHandle';
	import { routingStore } from '$lib/stores/routing';
	import type { RouteResult } from '$lib/routing';
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

	// Build SVG path from route points or fallback to straight line
	const pathData = $derived(() => {
		const src = adjustedSource();
		const tgt = adjustedTarget();

		if (routeResult?.path && routeResult.path.length >= 1) {
			// Route contains clearance points - connect from actual handles
			const points = routeResult.path;

			// Start at source handle
			let d = `M ${src.x} ${src.y}`;

			// Draw through all route points (clearance + intermediates)
			for (const pt of points) {
				d += ` L ${pt.x} ${pt.y}`;
			}

			// End at target handle
			d += ` L ${tgt.x} ${tgt.y}`;

			return d;
		}

		// Fallback: simple L-shape with stubs
		const stubLength = 10; // 1G stub
		let d = `M ${src.x} ${src.y}`;

		// Determine stub directions based on handle positions
		if (sourcePosition === 'right') {
			d += ` L ${src.x + stubLength} ${src.y}`;
		} else if (sourcePosition === 'left') {
			d += ` L ${src.x - stubLength} ${src.y}`;
		} else if (sourcePosition === 'bottom') {
			d += ` L ${src.x} ${src.y + stubLength}`;
		} else if (sourcePosition === 'top') {
			d += ` L ${src.x} ${src.y - stubLength}`;
		}

		// Route to target stub
		const srcStub = sourcePosition === 'right' ? { x: src.x + stubLength, y: src.y } :
						sourcePosition === 'left' ? { x: src.x - stubLength, y: src.y } :
						sourcePosition === 'bottom' ? { x: src.x, y: src.y + stubLength } :
						{ x: src.x, y: src.y - stubLength };

		const tgtStub = targetPosition === 'right' ? { x: tgt.x + stubLength, y: tgt.y } :
						targetPosition === 'left' ? { x: tgt.x - stubLength, y: tgt.y } :
						targetPosition === 'bottom' ? { x: tgt.x, y: tgt.y + stubLength } :
						{ x: tgt.x, y: tgt.y - stubLength };

		// L-shape between stubs
		if (Math.abs(srcStub.y - tgtStub.y) < 1) {
			// Horizontally aligned
			d += ` L ${tgtStub.x} ${tgtStub.y}`;
		} else if (Math.abs(srcStub.x - tgtStub.x) < 1) {
			// Vertically aligned
			d += ` L ${tgtStub.x} ${tgtStub.y}`;
		} else {
			// Need a bend
			d += ` L ${tgtStub.x} ${srcStub.y} L ${tgtStub.x} ${tgtStub.y}`;
		}

		// Final segment to target
		d += ` L ${tgt.x} ${tgt.y}`;

		return d;
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

	// Arrow at end of path
	const endArrow = $derived(() => {
		const tgt = adjustedTarget();

		if (routeResult?.path && routeResult.path.length >= 2) {
			const path = routeResult.path;
			const endPoint = tgt;
			const prevPoint = path.length > 1 ? path[path.length - 2] : path[0];

			const dx = endPoint.x - prevPoint.x;
			const dy = endPoint.y - prevPoint.y;
			const angle = Math.atan2(dy, dx) * (180 / Math.PI);

			return { x: endPoint.x, y: endPoint.y, angle };
		}

		// Fallback based on target position
		let angle = 0;
		if (targetPosition === 'left') angle = 180;
		else if (targetPosition === 'top') angle = -90;
		else if (targetPosition === 'bottom') angle = 90;

		return { x: tgt.x, y: tgt.y, angle };
	});
</script>

<g class:highlighted={isHighlighted()} style="--highlight-color: {highlightColor()}">
	<BaseEdge {id} path={pathData()} {style} />

	<!-- User waypoint markers -->
	{#each userWaypoints() as waypoint (waypoint.id)}
		<circle
			cx={waypoint.position.x}
			cy={waypoint.position.y}
			r="4"
			class="waypoint-marker"
			class:selected
		/>
	{/each}

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
		stroke-width: 1.5;
		cursor: pointer;
		transition:
			stroke 0.15s ease,
			fill 0.15s ease;
	}

	.waypoint-marker:hover {
		stroke: var(--accent);
		stroke-width: 2;
	}

	.waypoint-marker.selected {
		stroke: var(--accent);
		fill: color-mix(in srgb, var(--accent) 30%, var(--surface-raised));
	}
</style>
