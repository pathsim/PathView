<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { plotDataStore } from '$lib/plotting/processing/plotDataStore';
	import {
		toPlotlyTrace,
		toPlotlySpectrumTrace,
		toPlotlyLayout,
		createEmptyLayout,
		PLOTLY_CONFIG
	} from '$lib/plotting/renderers/plotly';
	import type { ProcessedPlot, ProcessedTrace } from '$lib/plotting/core/types';

	interface Props {
		nodeId: string;
	}

	let { nodeId }: Props = $props();

	let plotDiv: HTMLDivElement;
	let Plotly: typeof import('plotly.js-dist-min') | null = null;
	let resizeObserver: ResizeObserver | null = null;

	// Local state from store
	let processedPlot = $state<ProcessedPlot | null>(null);
	let isStreaming = $state(false);

	// Streaming mode state for extendTraces optimization
	let streamingInitialized = false;
	let renderedTimeLength = 0;
	let ghostTraceCount = 0;
	let wasStreaming = false;

	const unsubscribe = plotDataStore.subscribe((state) => {
		processedPlot = state.plots.get(nodeId) ?? null;
		const newIsStreaming = state.isStreaming;

		// Handle streaming state transitions
		if (newIsStreaming && !wasStreaming) {
			// Streaming just started (rerun) - reset for fresh extendTraces
			streamingInitialized = false;
			renderedTimeLength = 0;
			ghostTraceCount = 0;
		} else if (!newIsStreaming && wasStreaming) {
			// Streaming just stopped
			streamingInitialized = false;
			renderedTimeLength = 0;
			ghostTraceCount = 0;
		}
		wasStreaming = newIsStreaming;
		isStreaming = newIsStreaming;

		// Render if Plotly is ready
		if (Plotly && plotDiv) {
			renderPlot();
		}
	});

	onMount(async () => {
		Plotly = await import('plotly.js-dist-min');
		if (processedPlot) renderPlot();

		resizeObserver = new ResizeObserver(() => {
			if (Plotly && plotDiv) {
				Plotly.Plots.resize(plotDiv);
			}
		});
		resizeObserver.observe(plotDiv);
	});

	onDestroy(() => {
		unsubscribe();
		resizeObserver?.disconnect();
		if (Plotly && plotDiv) {
			Plotly.purge(plotDiv);
		}
	});

	function renderPlot() {
		if (!Plotly || !plotDiv) return;

		// Spectrum plots always use full react (data is replaced, not appended)
		if (processedPlot?.type === 'spectrum') {
			renderSpectrumPlot();
			return;
		}

		// Scope plots can use extendTraces during streaming
		renderScopePlot();
	}

	function renderSpectrumPlot() {
		if (!Plotly || !plotDiv || !processedPlot) {
			showEmptyPlot();
			return;
		}

		const traces: Partial<Plotly.ScatterData>[] = processedPlot.traces.map((trace) =>
			toPlotlySpectrumTrace(trace, processedPlot!.frequencies)
		);

		if (traces.length === 0) {
			showEmptyPlot();
		} else {
			const layout = toPlotlyLayout(processedPlot);
			Plotly.react(plotDiv, traces, layout, PLOTLY_CONFIG);
		}
	}

	function renderScopePlot() {
		if (!Plotly || !plotDiv) return;

		if (!processedPlot || processedPlot.traces.length === 0) {
			showEmptyPlot();
			streamingInitialized = false;
			renderedTimeLength = 0;
			return;
		}

		// Get current time length from first main (non-ghost) trace
		const mainTrace = processedPlot.traces.find((t) => !t.ghost);
		const currentTimeLength = mainTrace?.x.length ?? 0;

		// Use extendTraces if: streaming, already initialized, and have new data to append
		if (isStreaming && streamingInitialized && currentTimeLength > renderedTimeLength) {
			extendScopeTraces(currentTimeLength);
			return;
		}

		// Full render
		fullScopeRender();
	}

	function fullScopeRender() {
		if (!Plotly || !plotDiv || !processedPlot) return;

		// Count ghost traces (they come first in the array)
		ghostTraceCount = processedPlot.traces.filter((t) => t.ghost).length;

		const traces: Partial<Plotly.ScatterData>[] = processedPlot.traces.map((trace) =>
			toPlotlyTrace(trace)
		);
		const layout = toPlotlyLayout(processedPlot);

		Plotly.react(plotDiv, traces, layout, PLOTLY_CONFIG);

		// Mark as initialized for streaming if we have main traces
		const mainTrace = processedPlot.traces.find((t) => !t.ghost);
		if (isStreaming && mainTrace && mainTrace.x.length > 0) {
			streamingInitialized = true;
			renderedTimeLength = mainTrace.x.length;
		}
	}

	function extendScopeTraces(currentTimeLength: number) {
		if (!Plotly || !plotDiv || !processedPlot) return;

		const newStartIndex = renderedTimeLength;

		// Get main (non-ghost) traces
		const mainTraces = processedPlot.traces.filter((t) => !t.ghost);

		// Build arrays for extendTraces
		const xData: number[][] = [];
		const yData: number[][] = [];
		const traceIndices: number[] = [];

		mainTraces.forEach((trace, i) => {
			xData.push(trace.x.slice(newStartIndex));
			yData.push(trace.y.slice(newStartIndex));
			traceIndices.push(ghostTraceCount + i);
		});

		if (xData.length > 0 && xData[0].length > 0) {
			Plotly.extendTraces(plotDiv, { x: xData, y: yData }, traceIndices);
		}

		renderedTimeLength = currentTimeLength;
	}

	function showEmptyPlot() {
		if (!Plotly || !plotDiv) return;

		// Build a minimal layout for empty state
		const baseLayout = processedPlot
			? toPlotlyLayout(processedPlot)
			: {
					paper_bgcolor: 'transparent',
					plot_bgcolor: 'transparent',
					margin: { l: 60, r: 15, t: 10, b: 45 }
				};

		const emptyLayout = createEmptyLayout(baseLayout);
		Plotly.newPlot(plotDiv, [], emptyLayout, PLOTLY_CONFIG);
	}
</script>

<div class="plot-container">
	<div class="plot" bind:this={plotDiv}></div>
</div>

<style>
	.plot-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.plot {
		width: 100%;
		height: 100%;
		min-height: 150px;
	}

	/* Rounded corners for Plotly legend box */
	.plot :global(.legend .bg) {
		rx: 4px;
		ry: 4px;
	}
</style>
