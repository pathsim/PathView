/**
 * Layout constants - Must match CSS variables in app.css
 *
 * CSS Variables (app.css):
 *   --panel-gap: var(--space-md) = 12px
 *   --panel-toggles-width: 52px
 */

/** Gap between panels (matches --panel-gap / --space-md) */
export const PANEL_GAP = 12;

/** Width of the panel toggles sidebar (matches --panel-toggles-width) */
export const PANEL_TOGGLES_WIDTH = 52;

/** Minimum width for bottom panels when split */
export const MIN_BOTTOM_PANEL_WIDTH = 300;

/** Default offset for duplicated nodes */
export const DUPLICATE_OFFSET = { x: 50, y: 50 };

/** Navigation bar height (12px top margin + 44px logo + 12px gap) */
export const NAV_HEIGHT = 68;

/** Default initial panel dimensions */
export const PANEL_DEFAULTS = {
	width: 320,
	height: 280,
	minWidth: 200,
	minHeight: 150,
	maxWidth: 800
} as const;

/**
 * Calculate total available width for bottom panels
 * Layout: [toggles + gap][panel1][gap][panel2][gap]
 */
export function getBottomPanelTotalWidth(viewportWidth: number): number {
	// W1 + W2 = viewport - toggles - 3*gap
	return viewportWidth - PANEL_TOGGLES_WIDTH - PANEL_GAP * 3;
}
