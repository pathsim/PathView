/**
 * SVG renderer - converts ProcessedPlot to SVG path data for previews
 */

import type { ProcessedPlot, AxisScale } from '../core/types';
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
// AXIS SCALING HELPERS
// ============================================================

/** Minimum value for log scale (prevents -Infinity) */
const LOG_MIN_VALUE = 1e-10;

/**
 * Transform a value based on axis scale
 */
function transformValue(value: number, scale: AxisScale): number {
	if (scale === 'log') {
		// Clamp to minimum positive value for log scale
		return Math.log10(Math.max(value, LOG_MIN_VALUE));
	}
	return value;
}

/**
 * Compute bounds for an axis with scaling applied
 */
function computeScaledBounds(
	min: number,
	max: number,
	scale: AxisScale
): { scaledMin: number; scaledMax: number; range: number } {
	if (scale === 'log') {
		// For log scale, ensure positive values
		const safeMin = Math.max(min, LOG_MIN_VALUE);
		const safeMax = Math.max(max, LOG_MIN_VALUE);
		const scaledMin = Math.log10(safeMin);
		const scaledMax = Math.log10(safeMax);
		const range = scaledMax - scaledMin || 1;
		return { scaledMin, scaledMax, range };
	}
	// Linear scale
	const range = max - min || 1;
	return { scaledMin: min, scaledMax: max, range };
}

// ============================================================
// SVG PATH GENERATION
// ============================================================

/**
 * Convert ProcessedPlot to SVG path data for preview rendering
 *
 * Respects the axis scale settings (linear/log) from the plot's layout.
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
	const { traces, bounds, layout } = plot;

	if (traces.length === 0) return [];

	const { xMin, xMax, yMin, yMax } = bounds;
	const xScale = layout.xAxisScale;
	const yScale = layout.yAxisScale;

	// Compute scaled bounds for each axis
	const xBounds = computeScaledBounds(xMin, xMax, xScale);
	const yBounds = computeScaledBounds(yMin, yMax, yScale);

	const plotWidth = width - padding * 2;
	const plotHeight = height - padding * 2;

	return traces.map((trace) => {
		const { xDecimated, yDecimated, style, ghost } = trace;

		// Build SVG path string
		const pathPoints: string[] = [];

		for (let i = 0; i < xDecimated.length; i++) {
			const rawX = xDecimated[i];
			const rawY = yDecimated[i];

			// Skip invalid values for log scale
			if (xScale === 'log' && rawX <= 0) continue;
			if (yScale === 'log' && rawY <= 0) continue;

			// Transform values based on axis scale
			const scaledX = transformValue(rawX, xScale);
			const scaledY = transformValue(rawY, yScale);

			// Map to pixel coordinates
			const x = padding + ((scaledX - xBounds.scaledMin) / xBounds.range) * plotWidth;
			const y = height - padding - ((scaledY - yBounds.scaledMin) / yBounds.range) * plotHeight;

			// Clamp to visible area
			const clampedX = Math.max(padding, Math.min(width - padding, x));
			const clampedY = Math.max(padding, Math.min(height - padding, y));

			// Use 'M' for first point or after skipped points
			const command = pathPoints.length === 0 ? 'M' : 'L';
			pathPoints.push(`${command}${clampedX.toFixed(1)},${clampedY.toFixed(1)}`);
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
 * Convert ProcessedPlot to SVG paths using linear scaling for both axes
 * (Convenience function for simple previews that ignore layout settings)
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
