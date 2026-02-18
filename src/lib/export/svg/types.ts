/**
 * Types for SVG export
 */

import { EXPORT_PADDING } from '$lib/constants/dimensions';
import type { SvgCompat } from '../dom2svg/index.js';

/** SVG export options */
export interface ExportOptions {
	/** Background style: 'transparent' or 'solid' */
	background?: 'transparent' | 'solid';
	/** Padding around content in pixels */
	padding?: number;
	/** SVG compatibility preset (default: 'inkscape') */
	compat?: SvgCompat;
}

/** Default export options */
export const DEFAULT_OPTIONS: Required<ExportOptions> = {
	background: 'transparent',
	padding: EXPORT_PADDING,
	compat: 'inkscape'
};
