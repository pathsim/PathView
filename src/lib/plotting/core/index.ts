/**
 * Core plotting module exports
 */

// Types
export type {
	LineStyle,
	MarkerStyle,
	AxisScale,
	TraceStyle,
	LayoutStyle,
	RawScopeData,
	RawSpectrumData,
	RawPlotData,
	ProcessedTrace,
	ProcessedPlot,
	PlotDataState,
	DecimationResult,
	DataBounds
} from './types';

// Constants
export {
	RENDER_QUEUE_FPS,
	RENDER_QUEUE_INTERVAL,
	PREVIEW_TARGET_BUCKETS,
	GHOST_OPACITY_MAX,
	GHOST_OPACITY_MIN,
	calculateGhostOpacity,
	TRACE_COLORS,
	getTraceColor,
	getAccentColor,
	LINE_DASH_PLOTLY,
	LINE_DASH_SVG,
	MARKER_SYMBOL_PLOTLY,
	PLOTLY_CONFIG,
	PREVIEW_WIDTH,
	PREVIEW_HEIGHT,
	PREVIEW_PADDING
} from './constants';

// Utils
export {
	isTraceVisible,
	decimateMinMax,
	computeBounds,
	formatFrequency,
	getCssVar
} from './utils';
