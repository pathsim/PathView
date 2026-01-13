<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		getScopeLayout,
		getSpectrumLayout,
		createScopeTrace,
		createSpectrumTrace,
		createGhostScopeTrace,
		createGhostSpectrumTrace,
		plotConfig
	} from '$lib/plotting/plotUtils';
	import { themeStore, type Theme } from '$lib/stores/theme';
	import { enqueuePlotUpdate, cancelPlotUpdate, isVisible } from './plotQueue';

	interface ScopeData {
		time: number[];
		signals: number[][];
		labels?: string[];
	}

	interface SpectrumData {
		frequency: number[];
		magnitude: number[][];
		labels?: string[];
	}

	interface Props {
		type: 'scope' | 'spectrum';
		data: ScopeData | SpectrumData | null;
		ghostData?: (ScopeData | SpectrumData)[];
		title?: string;
		showLegend?: boolean;
		isStreaming?: boolean;
	}

	let { type, data, ghostData = [], title, showLegend = false, isStreaming = false }: Props = $props();

	// Check if data has actual content (not just empty arrays)
	const hasData = $derived(() => {
		if (!data) return false;
		if (type === 'scope') {
			const d = data as ScopeData;
			return d.time.length > 0 && d.signals.some(s => s.length > 0);
		} else {
			const d = data as SpectrumData;
			return d.frequency.length > 0 && d.magnitude.some(m => m.length > 0);
		}
	});

	// Default title based on type
	const defaultTitle = $derived(type === 'scope' ? 'Scope' : 'Spectrum');
	const plotTitle = $derived(title ?? defaultTitle);

	// Get label for signal index
	function getSignalLabel(index: number): string {
		if (data?.labels && index < data.labels.length) {
			return data.labels[index];
		}
		return `port ${index}`;
	}

	let plotDiv: HTMLDivElement;
	let Plotly: typeof import('plotly.js-dist-min') | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let currentTheme = $state<Theme>('dark');

	// Unique ID for this component in the shared render queue
	const componentId = Symbol();

	// Streaming mode state for extendTraces optimization
	let streamingInitialized = false;
	let renderedTimeLength = 0;
	let ghostTraceCount = 0;
	let wasStreaming = false; // Track streaming transitions

	const unsubscribeTheme = themeStore.subscribe((theme) => {
		currentTheme = theme;
	});

	onMount(async () => {
		Plotly = await import('plotly.js-dist-min');
		scheduleUpdate();

		resizeObserver = new ResizeObserver(() => {
			if (Plotly && plotDiv) {
				Plotly.Plots.resize(plotDiv);
			}
		});
		resizeObserver.observe(plotDiv);
	});

	function scheduleUpdate() {
		// Use shared queue for batched, throttled updates
		enqueuePlotUpdate(componentId, updatePlotWithState);
	}

	// Reset streaming state on transitions
	$effect(() => {
		if (isStreaming && !wasStreaming) {
			// Streaming just started (rerun) - reset for fresh extendTraces
			streamingInitialized = false;
			renderedTimeLength = 0;
			ghostTraceCount = 0;
		} else if (!isStreaming && wasStreaming) {
			// Streaming just stopped
			streamingInitialized = false;
			renderedTimeLength = 0;
			ghostTraceCount = 0;
		}
		wasStreaming = isStreaming;
	});

	$effect(() => {
		const _theme = currentTheme;
		const _data = data;
		const _ghostData = ghostData;
		const _type = type;
		const _showLegend = showLegend;
		const _isStreaming = isStreaming;
		if (Plotly && plotDiv) {
			// Always update - handles empty data with ghosts, etc.
			scheduleUpdate();
		}
	});

	function updatePlotWithState() {
		if (!Plotly || !plotDiv) return;

		// Spectrum plots always use full react (data is replaced, not appended)
		if (type === 'spectrum') {
			updateSpectrumPlot();
			return;
		}

		// Scope plots can use extendTraces during streaming
		updateScopePlot();
	}

	function updateSpectrumPlot() {
		if (!Plotly || !plotDiv) return;

		const traces: Partial<Plotly.ScatterData>[] = [];
		const spectrumGhosts = ghostData as SpectrumData[];
		const totalGhosts = spectrumGhosts.length;

		// Add ghost traces
		for (let ghostIdx = totalGhosts - 1; ghostIdx >= 0; ghostIdx--) {
			const ghost = spectrumGhosts[ghostIdx];
			if (!ghost?.magnitude || !ghost.frequency?.length) continue;
			for (let sigIdx = 0; sigIdx < ghost.magnitude.length; sigIdx++) {
				traces.push(createGhostSpectrumTrace(ghost.frequency, ghost.magnitude[sigIdx], sigIdx, ghostIdx, totalGhosts));
			}
		}

		// Add current data traces
		let layout = getSpectrumLayout(plotTitle, undefined, showLegend);
		if (hasData()) {
			const spectrumData = data as SpectrumData;
			for (let i = 0; i < spectrumData.magnitude.length; i++) {
				traces.push(createSpectrumTrace(spectrumData.frequency, spectrumData.magnitude[i], i, getSignalLabel(i)));
			}
			layout = getSpectrumLayout(plotTitle, spectrumData.frequency, showLegend);
		}

		if (traces.length === 0) {
			showEmptyPlot(layout);
		} else {
			Plotly.react(plotDiv, traces, layout, plotConfig);
		}
	}

	function updateScopePlot() {
		if (!Plotly || !plotDiv) return;

		const scopeData = data as ScopeData | null;
		const scopeGhosts = ghostData as ScopeData[];
		const currentTimeLength = scopeData?.time?.length ?? 0;

		// Use extendTraces if: streaming, already initialized, and have new data to append
		if (isStreaming && streamingInitialized && currentTimeLength > renderedTimeLength) {
			extendScopeTraces(scopeData!, currentTimeLength);
			return;
		}

		// Full render: initial render, not streaming, or continuing from existing data
		fullScopeRender(scopeData, scopeGhosts);
	}

	function fullScopeRender(scopeData: ScopeData | null, scopeGhosts: ScopeData[]) {
		if (!Plotly || !plotDiv) return;

		const traces: Partial<Plotly.ScatterData>[] = [];
		const layout = getScopeLayout(plotTitle, showLegend);
		const totalGhosts = scopeGhosts.length;

		// Add ghost traces (rendered once, won't change during streaming)
		for (let ghostIdx = totalGhosts - 1; ghostIdx >= 0; ghostIdx--) {
			const ghost = scopeGhosts[ghostIdx];
			if (!ghost?.signals || !ghost.time?.length) continue;
			for (let sigIdx = 0; sigIdx < ghost.signals.length; sigIdx++) {
				traces.push(createGhostScopeTrace(ghost.time, ghost.signals[sigIdx], sigIdx, ghostIdx, totalGhosts));
			}
		}

		// Track ghost trace count for extendTraces indexing
		ghostTraceCount = traces.length;

		// Add current data traces
		if (scopeData && scopeData.time?.length > 0) {
			for (let i = 0; i < scopeData.signals.length; i++) {
				traces.push(createScopeTrace(scopeData.time, scopeData.signals[i], i, getSignalLabel(i)));
			}
		}

		if (traces.length === 0) {
			showEmptyPlot(layout);
			streamingInitialized = false;
			renderedTimeLength = 0;
		} else {
			Plotly.react(plotDiv, traces, layout, plotConfig);
			// Mark as initialized for streaming only if we have current data traces to extend
			// (not just ghost traces - extendTraces needs actual current traces to exist)
			if (isStreaming && scopeData && scopeData.time?.length > 0) {
				streamingInitialized = true;
				renderedTimeLength = scopeData.time.length;
			}
		}
	}

	function extendScopeTraces(scopeData: ScopeData, currentTimeLength: number) {
		if (!Plotly || !plotDiv) return;

		const newStartIndex = renderedTimeLength;
		const newTime = scopeData.time.slice(newStartIndex);
		const signalCount = scopeData.signals.length;

		// Build arrays for extendTraces: x and y data for each current trace
		const xData: number[][] = [];
		const yData: number[][] = [];
		const traceIndices: number[] = [];

		for (let i = 0; i < signalCount; i++) {
			xData.push(newTime);
			yData.push(scopeData.signals[i].slice(newStartIndex));
			traceIndices.push(ghostTraceCount + i);
		}

		Plotly.extendTraces(plotDiv, { x: xData, y: yData }, traceIndices);
		renderedTimeLength = currentTimeLength;
	}

	function showEmptyPlot(layout: Partial<Plotly.Layout>) {
		if (!Plotly || !plotDiv) return;

		const annotationColor = getComputedStyle(document.documentElement).getPropertyValue('--text-disabled').trim();
		layout.annotations = [
			{
				text: 'Run simulation to see data',
				xref: 'paper',
				yref: 'paper',
				x: 0.5,
				y: 0.5,
				showarrow: false,
				font: { size: 14, color: annotationColor }
			}
		];
		Plotly.newPlot(plotDiv, [], layout, plotConfig);
	}

	onDestroy(() => {
		unsubscribeTheme();
		cancelPlotUpdate(componentId);
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
		if (Plotly && plotDiv) {
			Plotly.purge(plotDiv);
		}
	});
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
