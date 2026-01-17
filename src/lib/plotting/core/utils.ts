/**
 * Utility functions for the plotting system
 */

import type { TraceStyle, DecimationResult, DataBounds } from './types';
import { PREVIEW_TARGET_BUCKETS } from './constants';

/**
 * Check if a trace should be rendered (has line or marker)
 */
export function isTraceVisible(style: TraceStyle): boolean {
	return style.lineStyle !== null || style.markerStyle !== null;
}

/**
 * Min-max decimation: preserves peaks and valleys
 * O(n) single pass, outputs ~2*buckets points
 *
 * @param x - X data array
 * @param y - Y data array
 * @param targetBuckets - Number of buckets to divide data into
 */
export function decimateMinMax(
	x: number[],
	y: number[],
	targetBuckets: number = PREVIEW_TARGET_BUCKETS
): DecimationResult {
	const len = x.length;

	if (len === 0) {
		return { x: [], y: [], xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
	}

	// If data is small enough, return as-is with bounds
	if (len <= targetBuckets * 2) {
		let yMin = y[0],
			yMax = y[0];
		for (let i = 1; i < len; i++) {
			if (y[i] < yMin) yMin = y[i];
			if (y[i] > yMax) yMax = y[i];
		}
		return { x, y, xMin: x[0], xMax: x[len - 1], yMin, yMax };
	}

	const bucketSize = len / targetBuckets;
	const outX: number[] = [];
	const outY: number[] = [];
	let globalYMin = Infinity,
		globalYMax = -Infinity;

	for (let bucket = 0; bucket < targetBuckets; bucket++) {
		const startIdx = Math.floor(bucket * bucketSize);
		const endIdx = Math.floor((bucket + 1) * bucketSize);

		let minIdx = startIdx,
			maxIdx = startIdx;
		let minVal = y[startIdx],
			maxVal = y[startIdx];

		// Find min and max in this bucket
		for (let i = startIdx + 1; i < endIdx && i < len; i++) {
			if (y[i] < minVal) {
				minVal = y[i];
				minIdx = i;
			}
			if (y[i] > maxVal) {
				maxVal = y[i];
				maxIdx = i;
			}
		}

		// Add points in chronological order
		if (minIdx <= maxIdx) {
			outX.push(x[minIdx]);
			outY.push(y[minIdx]);
			if (maxIdx !== minIdx) {
				outX.push(x[maxIdx]);
				outY.push(y[maxIdx]);
			}
		} else {
			outX.push(x[maxIdx]);
			outY.push(y[maxIdx]);
			outX.push(x[minIdx]);
			outY.push(y[minIdx]);
		}

		if (minVal < globalYMin) globalYMin = minVal;
		if (maxVal > globalYMax) globalYMax = maxVal;
	}

	// Always include last point
	const lastX = x[len - 1];
	const lastY = y[len - 1];
	if (outX[outX.length - 1] !== lastX) {
		outX.push(lastX);
		outY.push(lastY);
	}

	return {
		x: outX,
		y: outY,
		xMin: x[0],
		xMax: x[len - 1],
		yMin: globalYMin,
		yMax: globalYMax
	};
}

/**
 * Compute bounds from multiple data arrays
 */
export function computeBounds(dataArrays: { x: number[]; y: number[] }[]): DataBounds {
	let xMin = Infinity,
		xMax = -Infinity;
	let yMin = Infinity,
		yMax = -Infinity;

	for (const { x, y } of dataArrays) {
		for (let i = 0; i < x.length; i++) {
			if (x[i] < xMin) xMin = x[i];
			if (x[i] > xMax) xMax = x[i];
			if (y[i] < yMin) yMin = y[i];
			if (y[i] > yMax) yMax = y[i];
		}
	}

	// Handle empty/invalid bounds
	if (!isFinite(xMin)) xMin = 0;
	if (!isFinite(xMax)) xMax = 1;
	if (!isFinite(yMin)) yMin = 0;
	if (!isFinite(yMax)) yMax = 1;

	return { xMin, xMax, yMin, yMax };
}

/**
 * Format frequency for display (compact notation)
 */
export function formatFrequency(freq: number): string {
	if (freq >= 1e6) return (freq / 1e6).toFixed(1) + 'M';
	if (freq >= 1e3) return (freq / 1e3).toFixed(1) + 'k';
	if (freq >= 1) return freq.toFixed(1);
	return freq.toExponential(1);
}

/**
 * Read a CSS variable value from the document root
 */
export function getCssVar(name: string): string {
	if (typeof document === 'undefined') return '';
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
