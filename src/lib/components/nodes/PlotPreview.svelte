<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SIGNAL_COLORS } from '$lib/plotting/plotUtils';
	import { enqueueRender, cancelRender } from './previewQueue';

	type PlotData = { time?: number[]; signals?: number[][]; frequency?: number[]; magnitude?: number[][] };

	interface Props {
		type: 'scope' | 'spectrum';
		data: PlotData | null;
		ghostData?: PlotData[];
	}

	let { type, data, ghostData = [] }: Props = $props();

	// Unique ID for this component instance in the render queue
	const componentId = Symbol();

	onDestroy(() => {
		cancelRender(componentId);
	});

	// SVG dimensions
	const width = 224;
	const height = 96;
	const padding = 8;

	// Cached paths - only recompute when data changes
	let cachedPaths = $state<{ d: string; color: string; opacity: number; strokeWidth: number }[]>([]);

	// Non-reactive refs to prevent effect re-triggering
	let cachedDataRef: unknown = null;
	let cachedGhostRef: unknown = null;

	// Preview settings
	const TARGET_BUCKETS = 400; // Number of buckets for min-max decimation (~800 output points)

	/**
	 * Min-max decimation: preserves all peaks and valleys
	 * Splits data into buckets, keeps both min and max from each bucket
	 * O(n) single pass, captures full signal dynamics
	 */
	function downsampleMinMax(xData: number[], yData: number[], buckets: number = TARGET_BUCKETS): { x: number[]; y: number[]; xMin: number; xMax: number; yMin: number; yMax: number } {
		const len = xData.length;
		if (len === 0) {
			return { x: [], y: [], xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
		}

		// If data is small enough, use it directly
		if (len <= buckets * 2) {
			let yMin = yData[0], yMax = yData[0];
			for (let i = 1; i < len; i++) {
				if (yData[i] < yMin) yMin = yData[i];
				if (yData[i] > yMax) yMax = yData[i];
			}
			return {
				x: xData,
				y: yData,
				xMin: xData[0],
				xMax: xData[len - 1],
				yMin,
				yMax
			};
		}

		const bucketSize = len / buckets;
		const x: number[] = [];
		const y: number[] = [];
		let globalYMin = Infinity, globalYMax = -Infinity;

		for (let bucket = 0; bucket < buckets; bucket++) {
			const startIdx = Math.floor(bucket * bucketSize);
			const endIdx = Math.floor((bucket + 1) * bucketSize);

			let minIdx = startIdx, maxIdx = startIdx;
			let minVal = yData[startIdx], maxVal = yData[startIdx];

			// Find min and max in this bucket
			for (let i = startIdx + 1; i < endIdx && i < len; i++) {
				if (yData[i] < minVal) {
					minVal = yData[i];
					minIdx = i;
				}
				if (yData[i] > maxVal) {
					maxVal = yData[i];
					maxIdx = i;
				}
			}

			// Add points in chronological order (min first if it comes before max)
			if (minIdx <= maxIdx) {
				x.push(xData[minIdx]);
				y.push(yData[minIdx]);
				if (maxIdx !== minIdx) {
					x.push(xData[maxIdx]);
					y.push(yData[maxIdx]);
				}
			} else {
				x.push(xData[maxIdx]);
				y.push(yData[maxIdx]);
				x.push(xData[minIdx]);
				y.push(yData[minIdx]);
			}

			if (minVal < globalYMin) globalYMin = minVal;
			if (maxVal > globalYMax) globalYMax = maxVal;
		}

		// Always include last point
		const lastX = xData[len - 1];
		const lastY = yData[len - 1];
		if (x[x.length - 1] !== lastX) {
			x.push(lastX);
			y.push(lastY);
		}

		return {
			x,
			y,
			xMin: xData[0],
			xMax: xData[len - 1],
			yMin: globalYMin,
			yMax: globalYMax
		};
	}

	// Extract x/y data from plot data based on type
	function extractData(inputData: PlotData): { xData: number[]; yDataArrays: number[][] } {
		let xData: number[] = [];
		let yDataArrays: number[][] = [];

		if (type === 'scope' && inputData.time && inputData.signals) {
			xData = inputData.time;
			yDataArrays = inputData.signals;
		} else if (type === 'spectrum' && inputData.frequency && inputData.magnitude) {
			// Use indices for equal spacing (same as main plot)
			xData = Array.from({ length: inputData.frequency.length }, (_, i) => i);
			// Convert to log scale for spectrum
			yDataArrays = inputData.magnitude.map(mag =>
				mag.map(v => v > 0 ? Math.log10(v) : -10)
			);
		}

		return { xData, yDataArrays };
	}

	// Compute all paths (ghost + main) with proper scaling
	function computeAllPaths(mainData: PlotData | null, ghosts: PlotData[]): { d: string; color: string; opacity: number; strokeWidth: number }[] {
		// Check if we have any data to display (main or ghosts)
		const mainExtracted = mainData ? extractData(mainData) : { xData: [], yDataArrays: [] };
		const hasMainData = mainExtracted.xData.length > 0 && mainExtracted.yDataArrays.some(arr => arr.length > 0);
		const hasGhostData = ghosts.some(g => {
			const { xData } = extractData(g);
			return xData.length > 0;
		});

		if (!hasMainData && !hasGhostData) return [];

		// Collect all data for global bounds calculation
		const allDownsampled: Array<{ x: number[]; y: number[]; signalIdx: number; opacity: number; strokeWidth: number }> = [];
		let globalXMin = Infinity, globalXMax = -Infinity;
		let globalYMin = Infinity, globalYMax = -Infinity;

		// Process ghost data first (rendered behind)
		const totalGhosts = ghosts.length;
		for (let ghostIdx = totalGhosts - 1; ghostIdx >= 0; ghostIdx--) {
			const ghost = ghosts[ghostIdx];
			const { xData, yDataArrays } = extractData(ghost);
			if (xData.length === 0) continue;

			// Linear opacity: 40% for most recent ghost, 15% for oldest
			const opacity = totalGhosts === 1
				? 0.4
				: 0.4 - (ghostIdx / (totalGhosts - 1)) * 0.25;

			for (let sigIdx = 0; sigIdx < yDataArrays.length; sigIdx++) {
				const ds = downsampleMinMax(xData, yDataArrays[sigIdx]);
				allDownsampled.push({ x: ds.x, y: ds.y, signalIdx: sigIdx, opacity, strokeWidth: 0.7 });
				if (ds.xMin < globalXMin) globalXMin = ds.xMin;
				if (ds.xMax > globalXMax) globalXMax = ds.xMax;
				if (ds.yMin < globalYMin) globalYMin = ds.yMin;
				if (ds.yMax > globalYMax) globalYMax = ds.yMax;
			}
		}

		// Process main data (rendered on top) if available
		if (hasMainData) {
			for (let sigIdx = 0; sigIdx < mainExtracted.yDataArrays.length; sigIdx++) {
				const ds = downsampleMinMax(mainExtracted.xData, mainExtracted.yDataArrays[sigIdx]);
				allDownsampled.push({ x: ds.x, y: ds.y, signalIdx: sigIdx, opacity: 1, strokeWidth: 1 });
				if (ds.xMin < globalXMin) globalXMin = ds.xMin;
				if (ds.xMax > globalXMax) globalXMax = ds.xMax;
				if (ds.yMin < globalYMin) globalYMin = ds.yMin;
				if (ds.yMax > globalYMax) globalYMax = ds.yMax;
			}
		}

		const xRange = globalXMax - globalXMin || 1;
		const yRange = globalYMax - globalYMin || 1;
		const plotWidth = width - padding * 2;
		const plotHeight = height - padding * 2;

		return allDownsampled.map((ds) => {
			const pathPoints: string[] = [];
			for (let i = 0; i < ds.x.length; i++) {
				const x = padding + ((ds.x[i] - globalXMin) / xRange) * plotWidth;
				const y = height - padding - ((ds.y[i] - globalYMin) / yRange) * plotHeight;
				pathPoints.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
			}

			return {
				d: pathPoints.join(' '),
				color: SIGNAL_COLORS[ds.signalIdx % SIGNAL_COLORS.length],
				opacity: ds.opacity,
				strokeWidth: ds.strokeWidth
			};
		});
	}

	// Schedule deferred path computation via shared queue
	function scheduleUpdate() {
		// Capture current values
		const currentData = data;
		const currentGhosts = ghostData;

		// Store references for comparison (copy array to preserve item refs)
		cachedDataRef = currentData;
		cachedGhostRef = [...currentGhosts];

		// Add to shared queue (replaces any existing task for this component)
		enqueueRender(componentId, () => {
			cachedPaths = computeAllPaths(currentData, currentGhosts);
		});
	}

	// Check if data actually changed (not just reference)
	function dataChanged(): boolean {
		// Different main data reference
		if (data !== cachedDataRef) return true;

		// Different ghost array length
		if (ghostData.length !== (cachedGhostRef as PlotData[] | null)?.length) return true;

		// Different ghost data references (check each item)
		for (let i = 0; i < ghostData.length; i++) {
			if (ghostData[i] !== (cachedGhostRef as PlotData[])[i]) return true;
		}

		return false;
	}

	// Update cache when data or ghostData changes
	$effect(() => {
		// Access props to track them
		const _ = [data, ghostData];

		if (dataChanged()) {
			scheduleUpdate();
		}
	});


	const hasData = $derived(() => cachedPaths.length > 0);
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
			{#each cachedPaths as path}
				<path
					d={path.d}
					fill="none"
					stroke={path.color}
					stroke-width={path.strokeWidth}
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
