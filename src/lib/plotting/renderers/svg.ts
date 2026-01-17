/**
 * SVG renderer - converts ProcessedPlot to SVG path data for previews
 */

import type { ProcessedPlot } from '../core/types';
import { LINE_DASH_SVG, PREVIEW_WIDTH, PREVIEW_HEIGHT, PREVIEW_PADDING } from '../core/constants';

// ============================================================
// SVG PATH DATA TYPE
// ============================================================

export interface SVGPathData {
	/** SVG path d attribute */
	d: string;
	/** Stroke color */
	color: string;
	/** Opacity (1 for main traces, <1 for ghosts) */
	opacity: number;
	/** Stroke width */
	strokeWidth: number;
	/** Stroke dasharray for line style */
	dasharray: string;
}

// ============================================================
// SVG PATH GENERATION
// ============================================================

/**
 * Convert ProcessedPlot to SVG path data for preview rendering
 *
 * Uses decimated data and pre-computed bounds from the ProcessedPlot
 *
 * @param plot - Processed plot data
 * @param width - SVG width (default: PREVIEW_WIDTH)
 * @param height - SVG height (default: PREVIEW_HEIGHT)
 * @param padding - Padding inside SVG (default: PREVIEW_PADDING)
 */
export function toSVGPaths(
	plot: ProcessedPlot,
	width: number = PREVIEW_WIDTH,
	height: number = PREVIEW_HEIGHT,
	padding: number = PREVIEW_PADDING
): SVGPathData[] {
	const { traces, bounds, type } = plot;

	if (traces.length === 0) return [];

	const { xMin, xMax, yMin, yMax } = bounds;
	const xRange = xMax - xMin || 1;
	const yRange = yMax - yMin || 1;
	const plotWidth = width - padding * 2;
	const plotHeight = height - padding * 2;

	// For spectrum previews, apply log transform to y values
	const isSpectrum = type === 'spectrum';

	return traces.map((trace) => {
		const { xDecimated, yDecimated, style, ghost } = trace;

		// Build SVG path string
		const pathPoints: string[] = [];

		for (let i = 0; i < xDecimated.length; i++) {
			const xVal = xDecimated[i];
			// For spectrum, apply log transform to y values for preview
			let yVal = yDecimated[i];
			if (isSpectrum && yVal > 0) {
				// Apply log scale for visualization
				const logYMin = yMin > 0 ? Math.log10(yMin) : -10;
				const logYMax = yMax > 0 ? Math.log10(yMax) : 0;
				const logYVal = Math.log10(yVal);
				const logRange = logYMax - logYMin || 1;
				yVal = logYMin + ((logYVal - logYMin) / logRange) * (yMax - yMin) + yMin;
			}

			const x = padding + ((xVal - xMin) / xRange) * plotWidth;
			const y = height - padding - ((yVal - yMin) / yRange) * plotHeight;

			// Clamp to visible area
			const clampedX = Math.max(padding, Math.min(width - padding, x));
			const clampedY = Math.max(padding, Math.min(height - padding, y));

			pathPoints.push(`${i === 0 ? 'M' : 'L'}${clampedX.toFixed(1)},${clampedY.toFixed(1)}`);
		}

		return {
			d: pathPoints.join(' '),
			color: style.color,
			opacity: ghost?.opacity ?? 1,
			strokeWidth: ghost ? 0.7 : 1,
			dasharray: style.lineStyle ? LINE_DASH_SVG[style.lineStyle] : ''
		};
	});
}

/**
 * Convert ProcessedPlot to SVG paths using linear y-scale
 * (Simpler version without log transform for scope data)
 */
export function toSVGPathsLinear(
	plot: ProcessedPlot,
	width: number = PREVIEW_WIDTH,
	height: number = PREVIEW_HEIGHT,
	padding: number = PREVIEW_PADDING
): SVGPathData[] {
	const { traces, bounds } = plot;

	if (traces.length === 0) return [];

	const { xMin, xMax, yMin, yMax } = bounds;
	const xRange = xMax - xMin || 1;
	const yRange = yMax - yMin || 1;
	const plotWidth = width - padding * 2;
	const plotHeight = height - padding * 2;

	return traces.map((trace) => {
		const { xDecimated, yDecimated, style, ghost } = trace;

		// Build SVG path string
		const pathPoints: string[] = [];

		for (let i = 0; i < xDecimated.length; i++) {
			const x = padding + ((xDecimated[i] - xMin) / xRange) * plotWidth;
			const y = height - padding - ((yDecimated[i] - yMin) / yRange) * plotHeight;
			pathPoints.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
		}

		return {
			d: pathPoints.join(' '),
			color: style.color,
			opacity: ghost?.opacity ?? 1,
			strokeWidth: ghost ? 0.7 : 1,
			dasharray: style.lineStyle ? LINE_DASH_SVG[style.lineStyle] : ''
		};
	});
}
