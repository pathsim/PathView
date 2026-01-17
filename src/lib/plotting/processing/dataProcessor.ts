/**
 * Data processor for converting raw simulation data to render-ready format
 */

import type {
	RawScopeData,
	RawSpectrumData,
	ProcessedPlot,
	ProcessedTrace,
	TraceStyle,
	DataBounds
} from '../core/types';
import { calculateGhostOpacity, getTraceColor } from '../core/constants';
import { decimateMinMax, computeBounds } from '../core/utils';
import type { TraceSettings, BlockSettings } from '$lib/stores/plotSettings';

// ============================================================
// PROCESS PLOT OPTIONS
// ============================================================

export interface ProcessPlotOptions {
	/** Node ID from the graph */
	nodeId: string;
	/** Plot type */
	type: 'scope' | 'spectrum';
	/** Display title */
	title: string;
	/** Current simulation data (null if no data yet) */
	data: RawScopeData | RawSpectrumData | null;
	/** Ghost data from previous runs */
	ghostData: (RawScopeData | RawSpectrumData)[];
	/** Function to get trace settings for a signal index */
	getTraceSettings: (signalIndex: number) => TraceSettings;
	/** Block settings for this node */
	blockSettings: BlockSettings;
	/** CSS accent color value */
	accentColor: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Extract x/y arrays from raw plot data
 */
function extractXY(
	raw: RawScopeData | RawSpectrumData,
	type: 'scope' | 'spectrum'
): { x: number[]; ys: number[][]; labels?: string[] } {
	if (type === 'scope') {
		const d = raw as RawScopeData;
		return { x: d.time || [], ys: d.signals || [], labels: d.labels };
	} else {
		const d = raw as RawSpectrumData;
		// Use indices for x-axis (equal spacing)
		const x = d.frequency ? Array.from({ length: d.frequency.length }, (_, i) => i) : [];
		return { x, ys: d.magnitude || [], labels: d.labels };
	}
}

/**
 * Create a processed trace from raw data
 */
function createProcessedTrace(
	signalIndex: number,
	x: number[],
	y: number[],
	label: string,
	traceSettings: TraceSettings,
	accentColor: string,
	ghostInfo: ProcessedTrace['ghost']
): ProcessedTrace | null {
	const color = getTraceColor(signalIndex, accentColor);

	const style: TraceStyle = {
		lineStyle: traceSettings.lineStyle,
		markerStyle: traceSettings.markerStyle,
		color,
		visible: traceSettings.lineStyle !== null || traceSettings.markerStyle !== null
	};

	// Skip invisible traces
	if (!style.visible) return null;

	// Decimate for preview
	const decimated = decimateMinMax(x, y);

	return {
		signalIndex,
		label,
		x,
		y,
		xDecimated: decimated.x,
		yDecimated: decimated.y,
		style,
		ghost: ghostInfo
	};
}

// ============================================================
// MAIN PROCESSOR FUNCTION
// ============================================================

/**
 * Process a single plot's data into render-ready format
 *
 * This function:
 * 1. Extracts x/y data from raw simulation data
 * 2. Resolves trace styles from settings
 * 3. Filters out invisible traces
 * 4. Decimates data for previews
 * 5. Computes bounds for axis scaling
 * 6. Returns a ProcessedPlot ready for rendering
 */
export function processPlot(options: ProcessPlotOptions): ProcessedPlot {
	const { nodeId, type, title, data, ghostData, getTraceSettings, blockSettings, accentColor } =
		options;

	const traces: ProcessedTrace[] = [];
	const allDataForBounds: { x: number[]; y: number[] }[] = [];
	const totalGhosts = ghostData.length;

	// Process ghost data (oldest to newest, so newest renders on top)
	for (let ghostIdx = totalGhosts - 1; ghostIdx >= 0; ghostIdx--) {
		const ghost = ghostData[ghostIdx];
		if (!ghost) continue;

		const { x, ys, labels } = extractXY(ghost, type);
		if (x.length === 0) continue;

		const opacity = calculateGhostOpacity(ghostIdx, totalGhosts);

		for (let sigIdx = 0; sigIdx < ys.length; sigIdx++) {
			const y = ys[sigIdx];
			if (!y || y.length === 0) continue;

			const label = labels?.[sigIdx] ?? `port ${sigIdx}`;
			const settings = getTraceSettings(sigIdx);

			const trace = createProcessedTrace(sigIdx, x, y, label, settings, accentColor, {
				index: ghostIdx,
				total: totalGhosts,
				opacity
			});

			if (trace) {
				traces.push(trace);
				allDataForBounds.push({ x, y });
			}
		}
	}

	// Process main data
	if (data) {
		const { x, ys, labels } = extractXY(data, type);
		if (x.length > 0) {
			for (let sigIdx = 0; sigIdx < ys.length; sigIdx++) {
				const y = ys[sigIdx];
				if (!y || y.length === 0) continue;

				const label = labels?.[sigIdx] ?? `port ${sigIdx}`;
				const settings = getTraceSettings(sigIdx);

				const trace = createProcessedTrace(sigIdx, x, y, label, settings, accentColor, null);

				if (trace) {
					traces.push(trace);
					allDataForBounds.push({ x, y });
				}
			}
		}
	}

	// Compute bounds from all data
	const bounds: DataBounds = computeBounds(allDataForBounds);

	// Extract frequencies for spectrum tick labels
	let frequencies: number[] | undefined;
	if (type === 'spectrum' && data) {
		frequencies = (data as RawSpectrumData).frequency;
	}

	return {
		nodeId,
		type,
		title,
		traces,
		layout: {
			xAxisScale: blockSettings.xAxisScale,
			yAxisScale: blockSettings.yAxisScale,
			showLegend: blockSettings.showLegend
		},
		bounds,
		frequencies
	};
}
