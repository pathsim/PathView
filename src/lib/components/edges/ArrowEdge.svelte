<script lang="ts">
	import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';
	import { hoveredHandle, selectedNodeHighlight } from '$lib/stores/hoveredHandle';

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
		selected
	}: EdgeProps = $props();

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

	const adjustedSourceX = $derived(() => {
		if (sourcePosition === 'right') return sourceX - sourceOffset;
		if (sourcePosition === 'left') return sourceX + sourceOffset;
		return sourceX;
	});

	const adjustedSourceY = $derived(() => {
		if (sourcePosition === 'bottom') return sourceY - sourceOffset;
		if (sourcePosition === 'top') return sourceY + sourceOffset;
		return sourceY;
	});

	const adjustedTargetX = $derived(() => {
		if (targetPosition === 'right') return targetX + targetOffset;
		if (targetPosition === 'left') return targetX - targetOffset;
		return targetX;
	});

	const adjustedTargetY = $derived(() => {
		if (targetPosition === 'bottom') return targetY + targetOffset;
		if (targetPosition === 'top') return targetY - targetOffset;
		return targetY;
	});

	// Get the smooth step path with rounded corners
	// Starts at source handle tip, ends at target handle tip
	const pathData = $derived(() => {
		const [edgePath] = getSmoothStepPath({
			sourceX: adjustedSourceX(),
			sourceY: adjustedSourceY(),
			sourcePosition,
			targetX: adjustedTargetX(),
			targetY: adjustedTargetY(),
			targetPosition,
			borderRadius: 8
		});
		return edgePath;
	});

	// Calculate arrow rotation at the end of the path
	const endArrow = $derived(() => {
		const path = pathData();
		const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		svgPath.setAttribute('d', path);

		const totalLength = svgPath.getTotalLength();
		const endPoint = svgPath.getPointAtLength(totalLength);
		const nearEnd = svgPath.getPointAtLength(totalLength - 5);

		const angle = Math.atan2(endPoint.y - nearEnd.y, endPoint.x - nearEnd.x) * (180 / Math.PI);

		return { x: endPoint.x, y: endPoint.y, angle };
	});
</script>

<g class:highlighted={isHighlighted()} style="--highlight-color: {highlightColor()}">
	<BaseEdge {id} path={pathData()} {style} />

	<!-- Arrow at the end - offset forward 5px to reach target handle tip -->
	<g transform="translate({endArrow().x}, {endArrow().y}) rotate({endArrow().angle}) translate(5, 0)">
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
		transition: fill 0.15s ease, transform 0.15s ease;
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
</style>
