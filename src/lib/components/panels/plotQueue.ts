/**
 * Shared render queue for Plotly plots in tiles mode.
 * Batches and throttles plot updates to prevent UI freezes during streaming.
 * Pauses processing when page is hidden to save CPU.
 */

type RenderTask = () => void;

const queue = new Map<symbol, RenderTask>();
let rafId: number | null = null;
let lastProcessTime = 0;
const MIN_PROCESS_INTERVAL = 1000 / 15; // Max 15fps for plot updates (slightly higher than previews)

// Visibility API - pause processing when tab is hidden
let isPageVisible = typeof document !== 'undefined' ? !document.hidden : true;

function handleVisibilityChange() {
	isPageVisible = !document.hidden;
	// Resume processing if there are queued tasks
	if (isPageVisible && queue.size > 0 && rafId === null) {
		rafId = requestAnimationFrame(processQueue);
	}
}

if (typeof document !== 'undefined') {
	document.addEventListener('visibilitychange', handleVisibilityChange);
}

function processQueue(timestamp: number) {
	rafId = null;

	// Skip processing when page is hidden
	if (!isPageVisible) return;

	if (queue.size === 0) return;

	// Throttle processing rate
	if (timestamp - lastProcessTime < MIN_PROCESS_INTERVAL) {
		rafId = requestAnimationFrame(processQueue);
		return;
	}
	lastProcessTime = timestamp;

	// Process all queued tasks in one batch
	const tasks = Array.from(queue.values());
	queue.clear();

	for (const task of tasks) {
		task();
	}

	// If more tasks were added during processing, schedule next batch
	if (queue.size > 0) {
		rafId = requestAnimationFrame(processQueue);
	}
}

/**
 * Enqueue a plot update. Replaces any existing task for the same component.
 */
export function enqueuePlotUpdate(id: symbol, task: RenderTask) {
	queue.set(id, task);
	if (rafId === null && isPageVisible) {
		rafId = requestAnimationFrame(processQueue);
	}
}

/**
 * Cancel a pending plot update.
 */
export function cancelPlotUpdate(id: symbol) {
	queue.delete(id);
}

/**
 * Check if page is currently visible (for components that need to know)
 */
export function isVisible(): boolean {
	return isPageVisible;
}
