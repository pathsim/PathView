/**
 * Processing module exports
 */

export { createRenderQueue, type RenderQueue } from './renderQueue';
export { processPlot, type ProcessPlotOptions } from './dataProcessor';

// Singleton instance for the application
import { createRenderQueue } from './renderQueue';
import { RENDER_QUEUE_FPS } from '../core/constants';

/** Global render queue for all plot updates */
export const plotRenderQueue = createRenderQueue({
	fps: RENDER_QUEUE_FPS,
	name: 'PlotRenderQueue'
});
