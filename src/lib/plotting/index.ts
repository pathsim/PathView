/**
 * Plotting module - public API
 *
 * This module provides a unified, modular plotting system with:
 * - Centralized data processing
 * - Single render queue
 * - Pluggable renderers (Plotly + SVG)
 */

// Core types and constants
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
} from './core/types';

export {
	RENDER_QUEUE_FPS,
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
} from './core/constants';

export { isTraceVisible, decimateMinMax, computeBounds, formatFrequency, getCssVar } from './core/utils';

// Processing
export { createRenderQueue, plotRenderQueue, type RenderQueue } from './processing/renderQueue';
export { processPlot, type ProcessPlotOptions } from './processing/dataProcessor';
export { plotDataStore } from './processing/plotDataStore';

// Renderers
export {
	toPlotlyTrace,
	toPlotlySpectrumTrace,
	toPlotlyLayout,
	getBaseLayout,
	createEmptyLayout,
	PLOTLY_CONFIG as PLOTLY_RENDER_CONFIG
} from './renderers/plotly';

export { toSVGPaths, toSVGPathsLinear, type SVGPathData } from './renderers/svg';
