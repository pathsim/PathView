/**
 * Types for SVG export
 */

import type { ThemeColors, ThemeName } from '$lib/constants/theme';
import { EXPORT_PADDING } from '$lib/constants/dimensions';

/** SVG export options */
export interface ExportOptions {
	/** Theme to use: 'light', 'dark', or 'auto' (detects from document) */
	theme?: ThemeName | 'auto';
	/** Background style: 'transparent' or 'solid' */
	background?: 'transparent' | 'solid';
	/** Padding around content in pixels */
	padding?: number;
	/** Whether to render node labels (default: true) */
	showLabels?: boolean;
	/** Whether to render type labels below node names (default: true) */
	showTypeLabels?: boolean;
	/** Whether to render handle shapes (default: true) */
	showHandles?: boolean;
}

/** Render context passed to all renderers */
export interface RenderContext {
	/** Resolved theme colors */
	theme: ThemeColors;
	/** Export options */
	options: Required<ExportOptions>;
}

/** Bounding box */
export interface Bounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/** Default export options */
export const DEFAULT_OPTIONS: Required<ExportOptions> = {
	theme: 'auto',
	background: 'transparent',
	padding: EXPORT_PADDING,
	showLabels: true,
	showTypeLabels: true,
	showHandles: true
};
