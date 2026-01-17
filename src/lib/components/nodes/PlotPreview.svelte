<script lang="ts">
	import { onDestroy } from 'svelte';
	import { plotDataStore } from '$lib/plotting/processing/plotDataStore';
	import { toSVGPaths, type SVGPathData } from '$lib/plotting/renderers/svg';
	import { PREVIEW_WIDTH, PREVIEW_HEIGHT, PREVIEW_PADDING } from '$lib/plotting/core/constants';
	import type { ProcessedPlot } from '$lib/plotting/core/types';

	interface Props {
		nodeId: string;
	}

	let { nodeId }: Props = $props();

	// SVG dimensions from constants
	const width = PREVIEW_WIDTH;
	const height = PREVIEW_HEIGHT;
	const padding = PREVIEW_PADDING;

	// Local state from store
	let paths = $state<SVGPathData[]>([]);

	const unsubscribe = plotDataStore.subscribe((state) => {
		const plot = state.plots.get(nodeId);
		if (plot) {
			// Use toSVGPaths which respects axis scale settings (linear/log)
			paths = toSVGPaths(plot, width, height, padding);
		} else {
			paths = [];
		}
	});

	onDestroy(() => {
		unsubscribe();
	});

	const hasData = $derived(() => paths.length > 0);
</script>

<div class="preview-container">
	<svg {width} {height} viewBox="0 0 {width} {height}">
		<rect
			x="0" y="0"
			width={width} height={height}
			rx="4"
			class="plot-bg"
		/>

		{#if hasData()}
			{#each paths as path}
				<path
					d={path.d}
					fill="none"
					stroke={path.color}
					stroke-width={path.strokeWidth}
					stroke-dasharray={path.dasharray}
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity={path.opacity}
				/>
			{/each}
		{:else}
			<text
				x={width / 2}
				y={height / 2 + 4}
				text-anchor="middle"
				class="no-data-text"
				font-size="11"
				font-family="Inter, sans-serif"
			>No data</text>
		{/if}
	</svg>
</div>

<style>
	.preview-container {
		padding: 3px;
		background: var(--surface-raised);
		border: 0.5px solid var(--border);
		border-radius: var(--radius-sm);
	}

	svg {
		display: block;
	}

	.plot-bg {
		fill: var(--surface);
	}

	.no-data-text {
		fill: var(--text-disabled);
	}
</style>
