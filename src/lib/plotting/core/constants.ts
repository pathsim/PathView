/**
 * Constants for the plotting system
 */

import type { LineStyle, MarkerStyle } from './types';

// ============================================================
// RENDER QUEUE CONFIGURATION
// ============================================================

/** Target FPS for the unified render queue */
export const RENDER_QUEUE_FPS = 15;

/** Minimum interval between renders in ms */
export const RENDER_QUEUE_INTERVAL = 1000 / RENDER_QUEUE_FPS;

// ============================================================
// DECIMATION CONFIGURATION
// ============================================================

/** Target number of buckets for min-max decimation (~2x points output) */
export const PREVIEW_TARGET_BUCKETS = 400;

// ============================================================
// GHOST TRACE CONFIGURATION
// ============================================================

/** Opacity for most recent ghost trace */
export const GHOST_OPACITY_MAX = 0.5;

/** Opacity for oldest ghost trace */
export const GHOST_OPACITY_MIN = 0.2;

/**
 * Calculate ghost trace opacity based on index
 * @param ghostIndex - 0 = most recent, higher = older
 * @param totalGhosts - Total number of ghost traces
 */
export function calculateGhostOpacity(ghostIndex: number, totalGhosts: number): number {
	if (totalGhosts <= 1) return GHOST_OPACITY_MAX;
	const range = GHOST_OPACITY_MAX - GHOST_OPACITY_MIN;
	return GHOST_OPACITY_MAX - (ghostIndex / (totalGhosts - 1)) * range;
}

// ============================================================
// COLORS
// ============================================================

/** Supplementary trace colors (after accent) */
export const TRACE_COLORS = [
	'#E57373', // Red
	'#81C784', // Green
	'#64B5F6', // Blue
	'#BA68C8', // Purple
	'#4DD0E1', // Cyan
	'#FFB74D', // Orange
	'#F06292', // Pink
	'#4DB6AC', // Teal
	'#90A4AE' // Grey
];

/**
 * Get trace color for a signal index
 * @param index - Signal index (0 = accent color)
 * @param accentColor - CSS accent color value
 */
export function getTraceColor(index: number, accentColor: string): string {
	if (index === 0) return accentColor;
	return TRACE_COLORS[(index - 1) % TRACE_COLORS.length];
}

/**
 * Read accent color from CSS variables
 */
export function getAccentColor(): string {
	if (typeof document === 'undefined') return '#0070C0';
	return (
		getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0070C0'
	);
}

// ============================================================
// LINE DASH PATTERNS
// ============================================================

/** Plotly dash values */
export const LINE_DASH_PLOTLY: Record<LineStyle, string> = {
	solid: 'solid',
	dash: 'dash',
	dot: 'dot'
};

/** SVG stroke-dasharray values */
export const LINE_DASH_SVG: Record<LineStyle, string> = {
	solid: '',
	dash: '6,3',
	dot: '2,2'
};

// ============================================================
// MARKER SYMBOLS
// ============================================================

/** Plotly marker symbols */
export const MARKER_SYMBOL_PLOTLY: Record<MarkerStyle, string> = {
	circle: 'circle',
	square: 'square',
	'triangle-up': 'triangle-up'
};

// ============================================================
// PLOTLY CONFIGURATION
// ============================================================

/** Common Plotly config for all plots */
export const PLOTLY_CONFIG: Partial<Plotly.Config> = {
	responsive: true,
	displaylogo: false,
	displayModeBar: 'hover',
	modeBarButtonsToRemove: ['lasso2d', 'select2d'],
	modeBarButtonsToAdd: [],
	toImageButtonOptions: {
		format: 'svg',
		filename: 'pathview_plot',
		height: 600,
		width: 1000,
		scale: 2
	},
	scrollZoom: true
};

// ============================================================
// SVG PREVIEW DIMENSIONS
// ============================================================

export const PREVIEW_WIDTH = 224;
export const PREVIEW_HEIGHT = 96;
export const PREVIEW_PADDING = 8;
