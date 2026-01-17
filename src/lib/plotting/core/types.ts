/**
 * Core types for the plotting system
 */

// ============================================================
// STYLE TYPES
// ============================================================

export type LineStyle = 'solid' | 'dash' | 'dot';
export type MarkerStyle = 'circle' | 'square' | 'triangle-up';
export type AxisScale = 'linear' | 'log';

export interface TraceStyle {
	lineStyle: LineStyle | null;
	markerStyle: MarkerStyle | null;
	color: string;
	visible: boolean;
}

export interface LayoutStyle {
	xAxisScale: AxisScale;
	yAxisScale: AxisScale;
	showLegend: boolean;
}

// ============================================================
// RAW DATA TYPES (input from simulation)
// ============================================================

export interface RawScopeData {
	time: number[];
	signals: number[][];
	labels?: string[];
}

export interface RawSpectrumData {
	frequency: number[];
	magnitude: number[][];
	labels?: string[];
}

export type RawPlotData = RawScopeData | RawSpectrumData;

// ============================================================
// PROCESSED DATA TYPES (output from processor)
// ============================================================

export interface ProcessedTrace {
	/** Signal index within the plot */
	signalIndex: number;
	/** Display label for the trace */
	label: string;

	/** Full resolution data (for Plotly) */
	x: number[];
	y: number[];

	/** Decimated data (for previews) */
	xDecimated: number[];
	yDecimated: number[];

	/** Resolved style information */
	style: TraceStyle;

	/** Ghost trace properties (null for main traces) */
	ghost: {
		index: number; // 0 = most recent ghost
		total: number; // total ghost count
		opacity: number; // pre-calculated opacity
	} | null;
}

export interface ProcessedPlot {
	/** Node ID from the graph */
	nodeId: string;
	/** Plot type */
	type: 'scope' | 'spectrum';
	/** Display title */
	title: string;

	/** All traces (ghosts first, then main) */
	traces: ProcessedTrace[];

	/** Layout settings */
	layout: LayoutStyle;

	/** Pre-computed bounds (for consistent axis scaling) */
	bounds: {
		xMin: number;
		xMax: number;
		yMin: number;
		yMax: number;
	};

	/** Spectrum-specific: frequency values for tick labels */
	frequencies?: number[];
}

// ============================================================
// STORE STATE TYPE
// ============================================================

export interface PlotDataState {
	/** Processed plots keyed by nodeId */
	plots: Map<string, ProcessedPlot>;
	/** Whether simulation is currently streaming */
	isStreaming: boolean;
	/** Timestamp of last update */
	lastUpdateTime: number;
}

// ============================================================
// DECIMATION RESULT TYPE
// ============================================================

export interface DecimationResult {
	x: number[];
	y: number[];
	xMin: number;
	xMax: number;
	yMin: number;
	yMax: number;
}

// ============================================================
// BOUNDS TYPE
// ============================================================

export interface DataBounds {
	xMin: number;
	xMax: number;
	yMin: number;
	yMax: number;
}
