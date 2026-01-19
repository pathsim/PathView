/**
 * Dimension constants for nodes, handles, and events
 * Single source of truth - used by both live canvas (CSS) and SVG export
 *
 * All dimensions are designed to align with the grid system defined in grid.ts
 */

import { GRID_SIZE, G } from './grid';

/** Node dimension constants (grid-aligned) */
export const NODE = {
	/** Base width: 10 grid units = 100px */
	baseWidth: G.x10,
	/** Base height: 4 grid units = 40px */
	baseHeight: G.x4,
	/** Spacing between ports: 2 grid units = 20px */
	portSpacing: G.x2,
	/** Border width in pixels */
	borderWidth: 1
} as const;

/** Handle (port connector) dimensions */
export const HANDLE = {
	/** Width of horizontal handles (rotation 0, 2): 1 grid unit */
	width: GRID_SIZE,
	/** Height of horizontal handles (rotation 0, 2) */
	height: 8,
	/** Inset from outer to inner path for hollow effect */
	hollowInset: 1.5
} as const;

/** Event node dimensions (grid-aligned) */
export const EVENT = {
	/** Total bounding box size: 8 grid units = 80px */
	size: G.px(8),
	/** Diamond shape size (rotated square) */
	diamondSize: 56,
	/** Diamond offset from center (diamondSize / 2) */
	diamondOffset: 28
} as const;

/** Export padding: 4 grid units = 40px */
export const EXPORT_PADDING = G.x4;

/**
 * Round up to next 2G (20px) boundary for symmetric expansion.
 * This ensures nodes expand evenly from center.
 */
export function snapTo2G(value: number): number {
	return Math.ceil(value / G.x2) * G.x2;
}

/**
 * Calculate port position as CSS calc() expression.
 * Uses offset from center to ensure grid alignment regardless of node size,
 * since the node center is always at a grid-aligned position.
 *
 * @param index - Port index (0-based)
 * @param total - Total number of ports on this edge
 * @returns CSS position value (e.g., "50%" or "calc(50% + 10px)")
 */
export function getPortPositionCalc(index: number, total: number): string {
	if (total <= 0 || total === 1) {
		return '50%'; // Single port at center
	}
	// For N ports with spacing S: span = (N-1)*S, offset from center = -span/2 + i*S
	const span = (total - 1) * NODE.portSpacing;
	const offsetFromCenter = -span / 2 + index * NODE.portSpacing;
	if (offsetFromCenter === 0) {
		return '50%';
	}
	return `calc(50% + ${offsetFromCenter}px)`;
}
