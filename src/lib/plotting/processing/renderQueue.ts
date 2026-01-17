/**
 * Unified render queue for batching and throttling plot updates
 */

type RenderTask = () => void;

interface RenderQueueOptions {
	/** Target frames per second */
	fps: number;
	/** Name for debugging */
	name?: string;
}

export interface RenderQueue {
	/** Add or replace a task in the queue */
	enqueue: (id: symbol, task: RenderTask) => void;
	/** Cancel a pending task */
	cancel: (id: symbol) => void;
	/** Check if the page is visible */
	isVisible: () => boolean;
	/** Clean up the queue (remove event listeners) */
	destroy: () => void;
}

/**
 * Factory function to create a render queue with configurable FPS
 *
 * Features:
 * - Symbol-based task deduplication (one task per component)
 * - Configurable FPS throttling
 * - Visibility API integration (pauses when tab is hidden)
 * - Batches all queued tasks in one animation frame
 */
export function createRenderQueue(options: RenderQueueOptions): RenderQueue {
	const { fps, name = 'RenderQueue' } = options;
	const minInterval = 1000 / fps;

	const taskQueue = new Map<symbol, RenderTask>();
	let rafId: number | null = null;
	let lastProcessTime = 0;
	let visible = true;

	function handleVisibilityChange() {
		visible = document.visibilityState === 'visible';
		if (visible && taskQueue.size > 0 && rafId === null) {
			scheduleProcess();
		}
	}

	// Only add listener in browser environment
	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', handleVisibilityChange);
	}

	function scheduleProcess() {
		if (rafId !== null) return;
		rafId = requestAnimationFrame(process);
	}

	function process(timestamp: number) {
		rafId = null;

		if (!visible || taskQueue.size === 0) return;

		// Throttle to target FPS
		if (timestamp - lastProcessTime < minInterval) {
			scheduleProcess();
			return;
		}

		lastProcessTime = timestamp;

		// Process all queued tasks in one batch
		const tasks = Array.from(taskQueue.values());
		taskQueue.clear();

		for (const task of tasks) {
			try {
				task();
			} catch (e) {
				console.error(`[${name}] Task error:`, e);
			}
		}

		// If new tasks were added during processing, schedule again
		if (taskQueue.size > 0) {
			scheduleProcess();
		}
	}

	return {
		enqueue(id: symbol, task: RenderTask) {
			taskQueue.set(id, task);
			if (visible) scheduleProcess();
		},

		cancel(id: symbol) {
			taskQueue.delete(id);
		},

		isVisible() {
			return visible;
		},

		destroy() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			taskQueue.clear();
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', handleVisibilityChange);
			}
		}
	};
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

import { RENDER_QUEUE_FPS } from '../core/constants';

/** Global render queue for all plot updates */
export const plotRenderQueue = createRenderQueue({
	fps: RENDER_QUEUE_FPS,
	name: 'PlotRenderQueue'
});
