/**
 * SVG Export Module
 *
 * Hybrid approach for accurate SVG export:
 * - Edges: cloned from SvelteFlow's SVG (already vector graphics)
 * - Nodes/Events: pure SVG with dimensions and styles read from DOM
 */

export { exportToSVG } from './renderer';
export type { ExportOptions, RenderContext, Bounds } from './types';
export { DEFAULT_OPTIONS } from './types';
