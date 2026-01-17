<script lang="ts">
	import { onDestroy } from 'svelte';
	import { plotDataStore } from '$lib/plotting/processing/plotDataStore';
	import SignalPlot from './SignalPlot.svelte';
	import type { ProcessedPlot } from '$lib/plotting/core/types';

	interface Props {
		collapsed?: boolean;
		onToggle?: () => void;
		activeTab?: number;
		viewMode?: 'tabs' | 'tiles';
	}

	let { collapsed = false, onToggle, activeTab = $bindable(0), viewMode = 'tabs' }: Props = $props();

	// Smart grid layout calculation
	let plotContent: HTMLDivElement | undefined = $state();
	let containerWidth = $state(0);
	let containerHeight = $state(0);
	let resizeObserver: ResizeObserver | null = null;

	// Tile size constraints
	const MIN_TILE_WIDTH = 320;
	const MIN_TILE_HEIGHT = 220;

	// Calculate grid layout based on minimum tile size
	function calculateGridLayout(plotCount: number, width: number): { cols: number; rows: number; needsScroll: boolean } {
		if (plotCount <= 1) return { cols: 1, rows: 1, needsScroll: false };
		if (width === 0) return { cols: 1, rows: plotCount, needsScroll: false };

		// Calculate columns that fit with minimum tile width
		const cols = Math.min(Math.max(1, Math.floor(width / MIN_TILE_WIDTH)), plotCount);
		const rows = Math.ceil(plotCount / cols);

		// Check if we need scrolling (tiles would be smaller than minimum height)
		const needsScroll = rows * MIN_TILE_HEIGHT > containerHeight;

		return { cols, rows, needsScroll };
	}

	// Set up ResizeObserver when plotContent element is available
	$effect(() => {
		if (plotContent) {
			resizeObserver?.disconnect();
			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					containerWidth = entry.contentRect.width;
					containerHeight = entry.contentRect.height;
				}
			});
			resizeObserver.observe(plotContent);
		}

		return () => {
			resizeObserver?.disconnect();
		};
	});

	// Get processed plots from the centralized store
	let plots = $state<ProcessedPlot[]>([]);

	const unsubscribe = plotDataStore.subscribe((state) => {
		plots = Array.from(state.plots.values());
	});

	onDestroy(() => {
		unsubscribe();
	});

	// All plots for UI (tabs/tiles)
	const allPlots = $derived(() => plots);

	// Reset tab when plots change
	$effect(() => {
		const plotList = allPlots();
		if (activeTab >= plotList.length && plotList.length > 0) {
			activeTab = 0;
		}
	});

	const hasPlots = $derived(allPlots().length > 0);

	// Calculate optimal grid layout based on container dimensions
	const gridLayout = $derived(calculateGridLayout(allPlots().length, containerWidth));

	// Export for use in header
	export function getPlots() {
		return allPlots();
	}
</script>

<div class="plot-panel" class:collapsed>
	{#if !collapsed}
		<div class="plot-content" bind:this={plotContent}>
			{#if hasPlots}
				{#if viewMode === 'tiles'}
					<!-- Tiled view: show all plots in a grid with optional scroll -->
					<div
						class="plot-grid"
						class:scrollable={gridLayout.needsScroll}
						style="grid-template-columns: repeat({gridLayout.cols}, 1fr); --min-tile-height: {MIN_TILE_HEIGHT}px;"
					>
						{#each allPlots() as plot (plot.nodeId)}
							<div class="plot-tile">
								<SignalPlot nodeId={plot.nodeId} />
							</div>
						{/each}
					</div>
				{:else}
					<!-- Tabbed view: show one plot at a time -->
					<div class="plot-area">
						{#each allPlots() as plot, i (plot.nodeId)}
							{#if activeTab === i}
								<SignalPlot nodeId={plot.nodeId} />
							{/if}
						{/each}
					</div>
				{/if}
			{:else}
				<div class="placeholder">
					<p>Run simulation to see plots</p>
					<p class="hint">Add Scope or Spectrum nodes to record signals</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.plot-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}

	.plot-panel.collapsed {
		height: 36px;
	}

	.plot-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--surface);
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}

	.plot-area {
		flex: 1;
		overflow: hidden;
	}

	/* Tiled grid layout - columns set dynamically via inline style */
	.plot-grid {
		flex: 1;
		display: grid;
		gap: 0;
		overflow: hidden;
		grid-auto-rows: 1fr;
	}

	/* Scrollable grid when tiles exceed container height */
	.plot-grid.scrollable {
		overflow-y: auto;
		grid-auto-rows: var(--min-tile-height);
	}

	.plot-tile {
		background: var(--surface);
		overflow: hidden;
		min-height: 0;
	}

	.plot-grid.scrollable .plot-tile {
		min-height: var(--min-tile-height);
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-disabled);
		font-size: 12px;
		text-align: center;
		gap: var(--space-xs);
	}

	.placeholder .hint {
		font-size: 11px;
		opacity: 0.7;
	}
</style>
