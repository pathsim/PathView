/**
 * Renderers module exports
 */

// Plotly renderer
export {
	toPlotlyTrace,
	toPlotlySpectrumTrace,
	toPlotlyLayout,
	getBaseLayout,
	createEmptyLayout,
	PLOTLY_CONFIG
} from './plotly';

// SVG renderer
export { toSVGPaths, type SVGPathData } from './svg';
