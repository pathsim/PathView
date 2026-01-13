<script lang="ts">
	import { onDestroy } from 'svelte';
	import { simulationState, type SimulationResult } from '$lib/pyodide/bridge';
	import { graphStore } from '$lib/stores/graph';
	import { settingsStore } from '$lib/stores/settings';
	import SignalPlot from './SignalPlot.svelte';

	interface Props {
		collapsed?: boolean;
		onToggle?: () => void;
		activeTab?: number;
		viewMode?: 'tabs' | 'tiles';
		showLegend?: boolean;
	}

	let { collapsed = false, onToggle, activeTab = $bindable(0), viewMode = 'tabs', showLegend = false }: Props = $props();

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

	// Get simulation result, history, and streaming state from store
	let result = $state<SimulationResult | null>(null);
	let resultHistory = $state<SimulationResult[]>([]);
	let isStreaming = $state(false);

	const unsubscribeSim = simulationState.subscribe((s) => {
		result = s.result;
		resultHistory = s.resultHistory;
		isStreaming = s.phase === 'running';
	});

	// Get ghost traces setting
	let ghostTraces = $state(0);
	const unsubscribeSettings = settingsStore.subscribe((s) => {
		ghostTraces = s.ghostTraces ?? 0;
	});

	onDestroy(() => {
		unsubscribeSim();
		unsubscribeSettings();
	});

	// Helper to get node name by ID (uses names from simulation result)
	function getNodeName(id: string, fallback: string): string {
		return result?.nodeNames?.[id] || fallback;
	}

	// Compute ghost data reactively - maps nodeId to ghost data array
	// Single pass O(n*m) instead of double pass
	const ghostScopeDataMap = $derived(() => {
		if (ghostTraces === 0 || resultHistory.length === 0) return new Map<string, { time: number[]; signals: number[][] }[]>();

		const map = new Map<string, { time: number[]; signals: number[][] }[]>();
		const history = resultHistory.slice(0, ghostTraces);

		for (const r of history) {
			if (!r.scopeData) continue;
			for (const [nodeId, data] of Object.entries(r.scopeData)) {
				if (!map.has(nodeId)) {
					map.set(nodeId, []);
				}
				map.get(nodeId)!.push(data);
			}
		}

		return map;
	});

	const ghostSpectrumDataMap = $derived(() => {
		if (ghostTraces === 0 || resultHistory.length === 0) return new Map<string, { frequency: number[]; magnitude: number[][] }[]>();

		const map = new Map<string, { frequency: number[]; magnitude: number[][] }[]>();
		const history = resultHistory.slice(0, ghostTraces);

		for (const r of history) {
			if (!r.spectrumData) continue;
			for (const [nodeId, data] of Object.entries(r.spectrumData)) {
				if (!map.has(nodeId)) {
					map.set(nodeId, []);
				}
				map.get(nodeId)!.push(data);
			}
		}

		return map;
	});

	// Parse scope and spectrum data into arrays
	const scopePlots = $derived(() => {
		if (!result?.scopeData) return [];
		return Object.entries(result.scopeData).map(([id, data], index) => ({
			id,
			title: getNodeName(id, `Scope ${index + 1}`),
			data: data as { time: number[]; signals: number[][] }
		}));
	});

	const spectrumPlots = $derived(() => {
		if (!result?.spectrumData) return [];
		return Object.entries(result.spectrumData).map(([id, data], index) => ({
			id,
			title: getNodeName(id, `Spectrum ${index + 1}`),
			data: data as { frequency: number[]; magnitude: number[][] }
		}));
	});

	// Types for plot data
	type ScopeData = { time: number[]; signals: number[][]; labels?: string[] };
	type SpectrumData = { frequency: number[]; magnitude: number[][]; labels?: string[] };
	type PlotEntry = { id: string; type: 'scope' | 'spectrum'; title: string; data: ScopeData | SpectrumData };

	// All plots combined
	const allPlots = $derived(() => {
		const plots: PlotEntry[] = [];
		for (const plot of scopePlots()) {
			plots.push({ id: plot.id, type: 'scope', title: plot.title, data: plot.data });
		}
		for (const plot of spectrumPlots()) {
			plots.push({ id: plot.id, type: 'spectrum', title: plot.title, data: plot.data });
		}
		return plots;
	});

	// Reset tab when plots change
	$effect(() => {
		const plots = allPlots();
		if (activeTab >= plots.length && plots.length > 0) {
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
						{#each allPlots() as plot (plot.id)}
							<div class="plot-tile">
								<SignalPlot
									type={plot.type}
									data={plot.data}
									ghostData={plot.type === 'scope' ? ghostScopeDataMap().get(plot.id) ?? [] : ghostSpectrumDataMap().get(plot.id) ?? []}
									title={plot.title}
									{showLegend}
									{isStreaming}
								/>
							</div>
						{/each}
					</div>
				{:else}
					<!-- Tabbed view: show one plot at a time -->
					<div class="plot-area">
						{#each allPlots() as plot, i (plot.id)}
							{#if activeTab === i}
								<SignalPlot
									type={plot.type}
									data={plot.data}
									ghostData={plot.type === 'scope' ? ghostScopeDataMap().get(plot.id) ?? [] : ghostSpectrumDataMap().get(plot.id) ?? []}
									title={plot.title}
									{showLegend}
									{isStreaming}
								/>
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
