/**
 * Dimension constants for nodes, handles, and events
 * Single source of truth - used by both live canvas (CSS) and SVG export
 *
 * All dimensions are designed to align with the grid system defined in grid.ts
 */

import { GRID_SIZE, G } from './grid';

/** Node dimension constants (grid-aligned) */
export const NODE = {
	/** Base width: 8 grid units = 80px */
	baseWidth: G.px(8),
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

/**
 * Calculate node dimensions from node data.
 * Used by both SvelteFlow (for bounds) and BaseNode (for CSS).
 */
export function calculateNodeDimensions(
	name: string,
	inputCount: number,
	outputCount: number,
	pinnedParamCount: number,
	rotation: number,
	typeName?: string
): { width: number; height: number } {
	const isVertical = rotation === 1 || rotation === 3;
	const maxPortsOnSide = Math.max(inputCount, outputCount);
	const minPortDimension = Math.max(1, maxPortsOnSide) * NODE.portSpacing;

	// Pinned params height: border(1) + padding(10) + rows(20 each) + gaps(4 between)
	const pinnedParamsHeight = pinnedParamCount > 0 ? 7 + 24 * pinnedParamCount : 0;

	// Width: base, name estimate, type name estimate, pinned params minimum, port dimension (if vertical)
	// Name uses 10px font (~6px per char), type uses 8px font (~5px per char), plus padding for node margins
	// Use slightly larger estimates to ensure text fits (ceil behavior)
	const nameWidth = name.length * 6 + 20;
	const typeWidth = typeName ? typeName.length * 5 + 20 : 0;
	const pinnedParamsWidth = pinnedParamCount > 0 ? 160 : 0;
	const width = snapTo2G(Math.max(
		NODE.baseWidth,
		nameWidth,
		typeWidth,
		pinnedParamsWidth,
		isVertical ? minPortDimension : 0
	));

	// Height: content height vs port dimension (they share vertical space)
	const contentHeight = NODE.baseHeight + pinnedParamsHeight;
	const height = isVertical
		? snapTo2G(contentHeight)
		: snapTo2G(Math.max(contentHeight, minPortDimension));

	return { width, height };
}
