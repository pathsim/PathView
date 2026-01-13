/**
 * Common type definitions shared across the application
 */

/** 2D position */
export interface Position {
	x: number;
	y: number;
}

/** Size dimensions */
export interface Size {
	width: number;
	height: number;
}

/** Bounding box */
export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Rotation value (0-3 representing 0, 90, 180, 270 degrees) */
export type RotationValue = 0 | 1 | 2 | 3;
