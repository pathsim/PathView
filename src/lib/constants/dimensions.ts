/**
 * Dimension constants for nodes, handles, and events
 * Single source of truth - used by both live canvas (CSS) and SVG export
 */

/** Node dimension constants */
export const NODE = {
	/** Base width in pixels */
	baseWidth: 90,
	/** Base height in pixels */
	baseHeight: 36,
	/** Spacing between ports in pixels */
	portSpacing: 18,
	/** Border width in pixels */
	borderWidth: 1
} as const;

/** Handle (port connector) dimensions */
export const HANDLE = {
	/** Width of horizontal handles (rotation 0, 2) */
	width: 10,
	/** Height of horizontal handles (rotation 0, 2) */
	height: 8,
	/** Inset from outer to inner path for hollow effect */
	hollowInset: 1.5
} as const;

/** Event node dimensions */
export const EVENT = {
	/** Total bounding box size */
	size: 80,
	/** Center point (size / 2) */
	center: 40,
	/** Diamond shape size (rotated square) */
	diamondSize: 56,
	/** Diamond offset from center (diamondSize / 2) */
	diamondOffset: 28
} as const;

/** Export padding */
export const EXPORT_PADDING = 40;

/** Calculate node dimensions based on ports and rotation */
export function calculateNodeDimensions(
	inputCount: number,
	outputCount: number,
	rotation: number
): { width: number; height: number } {
	const isVertical = rotation === 1 || rotation === 3;
	const maxPorts = Math.max(inputCount, outputCount);

	if (isVertical) {
		return {
			width: Math.max(NODE.baseWidth, maxPorts * NODE.portSpacing + 20),
			height: NODE.baseHeight
		};
	}

	return {
		width: NODE.baseWidth,
		height: Math.max(NODE.baseHeight, maxPorts * NODE.portSpacing + 10)
	};
}
