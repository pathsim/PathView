/**
 * Handle path definitions for all rotations
 * Single source of truth - used by both CSS clip-paths and SVG export
 *
 * Each handle has:
 * - outer: The border/fill path (pentagon shape with rounded corners)
 * - inner: The cutout path (makes it hollow)
 * - width/height: Dimensions of the handle bounding box
 *
 * The hollow effect is created by layering:
 * 1. Outer path filled with border color
 * 2. Inner path filled with background color, offset by 1px (matches CSS inset: 1px)
 */

export interface HandlePathDef {
	/** Outer shape path (the border) */
	outer: string;
	/** Inner shape path (the hollow cutout) */
	inner: string;
	/** Handle width in pixels */
	width: number;
	/** Handle height in pixels */
	height: number;
}

/**
 * Handle paths for each rotation direction
 * - 0: Arrow pointing right (inputs left, outputs right)
 * - 1: Arrow pointing down (inputs top, outputs bottom)
 * - 2: Arrow pointing left (inputs right, outputs left)
 * - 3: Arrow pointing up (inputs bottom, outputs top)
 */
export const HANDLE_PATHS: Record<0 | 1 | 2 | 3, HandlePathDef> = {
	// Right-pointing (default)
	0: {
		outer:
			'M 1.00 0.00 L 5.00 0.00 Q 6.00 0.00 6.71 0.71 L 9.29 3.29 Q 10.00 4.00 9.29 4.71 L 6.71 7.29 Q 6.00 8.00 5.00 8.00 L 1.00 8.00 Q 0.00 8.00 0.00 7.00 L 0.00 1.00 Q 0.00 0.00 1.00 0.00 Z',
		inner:
			'M 0.80 0.00 L 3.79 0.00 Q 4.59 0.00 5.15 0.57 L 7.02 2.43 Q 7.59 3.00 7.02 3.57 L 5.15 5.43 Q 4.59 6.00 3.79 6.00 L 0.80 6.00 Q 0.00 6.00 0.00 5.20 L 0.00 0.80 Q 0.00 0.00 0.80 0.00 Z',
		width: 10,
		height: 8
	},

	// Down-pointing
	1: {
		outer:
			'M 1.00 0.00 L 7.00 0.00 Q 8.00 0.00 8.00 1.00 L 8.00 5.00 Q 8.00 6.00 7.29 6.71 L 4.71 9.29 Q 4.00 10.00 3.29 9.29 L 0.71 6.71 Q 0.00 6.00 0.00 5.00 L 0.00 1.00 Q 0.00 0.00 1.00 0.00 Z',
		inner:
			'M 0.80 0.00 L 5.20 0.00 Q 6.00 0.00 6.00 0.80 L 6.00 3.79 Q 6.00 4.59 5.43 5.15 L 3.57 7.02 Q 3.00 7.59 2.43 7.02 L 0.57 5.15 Q 0.00 4.59 0.00 3.79 L 0.00 0.80 Q 0.00 0.00 0.80 0.00 Z',
		width: 8,
		height: 10
	},

	// Left-pointing
	2: {
		outer:
			'M 5.00 0.00 L 9.00 0.00 Q 10.00 0.00 10.00 1.00 L 10.00 7.00 Q 10.00 8.00 9.00 8.00 L 5.00 8.00 Q 4.00 8.00 3.29 7.29 L 0.71 4.71 Q 0.00 4.00 0.71 3.29 L 3.29 0.71 Q 4.00 0.00 5.00 0.00 Z',
		inner:
			'M 4.21 0.00 L 7.20 0.00 Q 8.00 0.00 8.00 0.80 L 8.00 5.20 Q 8.00 6.00 7.20 6.00 L 4.21 6.00 Q 3.41 6.00 2.85 5.43 L 0.98 3.57 Q 0.41 3.00 0.98 2.43 L 2.85 0.57 Q 3.41 0.00 4.21 0.00 Z',
		width: 10,
		height: 8
	},

	// Up-pointing
	3: {
		outer:
			'M 4.71 0.71 L 7.29 3.29 Q 8.00 4.00 8.00 5.00 L 8.00 9.00 Q 8.00 10.00 7.00 10.00 L 1.00 10.00 Q 0.00 10.00 0.00 9.00 L 0.00 5.00 Q 0.00 4.00 0.71 3.29 L 3.29 0.71 Q 4.00 0.00 4.71 0.71 Z',
		inner:
			'M 3.57 0.98 L 5.43 2.85 Q 6.00 3.41 6.00 4.21 L 6.00 7.20 Q 6.00 8.00 5.20 8.00 L 0.80 8.00 Q 0.00 8.00 0.00 7.20 L 0.00 4.21 Q 0.00 3.41 0.57 2.85 L 2.43 0.98 Q 3.00 0.41 3.57 0.98 Z',
		width: 8,
		height: 10
	}
} as const;

export type HandleRotation = keyof typeof HANDLE_PATHS;

/** Get handle path definition for a rotation */
export function getHandlePath(rotation: number): HandlePathDef {
	const normalizedRotation = ((rotation % 4) + 4) % 4;
	return HANDLE_PATHS[normalizedRotation as HandleRotation];
}
