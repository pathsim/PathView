/**
 * Assembly Animation
 *
 * Creates a satisfying fly-in animation when loading a graph:
 * 1. Nodes fly in from random directions with staggered timing
 * 2. Edges draw themselves when both connected nodes have landed
 * 3. Arrow tips pop in after each edge path completes
 *
 * Enabled by default. Disable with URL parameter: ?fancyloading=false
 * Press Space or click canvas to skip animation.
 *
 * Usage:
 *   import { requestAssemblyAnimation, runAssemblyAnimation } from '$lib/animation/assemblyAnimation';
 *
 *   // In file load handler:
 *   requestAssemblyAnimation();
 *
 *   // In FlowUpdater (inside SvelteFlow context):
 *   runAssemblyAnimation(getNodes, getEdges, fitViewFn);
 */

import { writable } from 'svelte/store';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
	// Node animation
	nodeDuration: 500,       // Duration of each node's fly-in (ms)
	nodeStagger: 50,         // Delay between nodes (ms)
	flyDistanceMargin: 100,  // Extra margin beyond viewport edge (px in flow coords)

	// Edge animation
	edgeDuration: 300,       // Duration of edge drawing (ms)
	arrowDuration: 150,      // Duration of arrow pop-in (ms)

	// Timing delays
	initialDelay: 100,       // Wait for DOM to be ready (ms)
	fitViewDelay: 50,        // Wait after fitView before animating (ms)
};

// ============================================================================
// URL Parameter Check
// ============================================================================

function isAnimationEnabled(): boolean {
	if (typeof window === 'undefined') return false;
	const params = new URLSearchParams(window.location.search);
	// Enabled by default, disable with ?fancyloading=false
	return params.get('fancyloading') !== 'false';
}

// ============================================================================
// Types
// ============================================================================

export interface EdgeInfo {
	id: string;
	source: string;
	target: string;
}

export interface ViewportInfo {
	zoom: number;
	x: number;       // Viewport pan x
	y: number;       // Viewport pan y
	width: number;   // Canvas width in pixels
	height: number;  // Canvas height in pixels
}

export interface NodeInfo {
	id: string;
	x: number;
	y: number;
}

// ============================================================================
// State
// ============================================================================

// Trigger counter - increments when animation should start
export const assemblyAnimationTrigger = writable(0);

// Internal state (not reactive, just storage during animation)
let nodeDelays = new Map<string, number>();
let nodeFlyFrom = new Map<string, { x: number; y: number }>();
let edgeDelays = new Map<string, number>();
let isActive = false;
let cleanupTimeoutId: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// Skip Handlers
// ============================================================================

function handleKeydown(event: KeyboardEvent): void {
	if (event.code === 'Space' && !event.repeat && isActive) {
		event.preventDefault();
		skipAnimation();
	}
}

function handleCanvasClick(event: MouseEvent): void {
	if (!isActive) return;
	const target = event.target as HTMLElement;
	if (target.closest('.svelte-flow__pane')) {
		skipAnimation();
	}
}

function addSkipListeners(): void {
	window.addEventListener('keydown', handleKeydown);
	document.addEventListener('click', handleCanvasClick, true);
}

function removeSkipListeners(): void {
	window.removeEventListener('keydown', handleKeydown);
	document.removeEventListener('click', handleCanvasClick, true);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Request an assembly animation (call after loading a graph)
 * This just sets the trigger - actual animation runs when FlowUpdater picks it up
 */
export function requestAssemblyAnimation(): void {
	assemblyAnimationTrigger.update(n => n + 1);
}

/**
 * Check if animation is currently running
 */
export function isAnimating(): boolean {
	return isActive;
}

/**
 * Skip the animation and jump to final positions
 */
export function skipAnimation(): void {
	if (!isActive) return;

	// Cancel scheduled cleanup
	if (cleanupTimeoutId) {
		clearTimeout(cleanupTimeoutId);
		cleanupTimeoutId = null;
	}

	// Run cleanup immediately (removes animation classes, shows final state)
	cleanup();
}

/**
 * Run the assembly animation
 * Call this from inside SvelteFlow context (e.g., FlowUpdater)
 *
 * @param getNodes - Function to get current nodes with positions (called after delay)
 * @param getEdges - Function to get current edges (called after delay)
 * @param fitView - Function to fit the view before animation
 * @param getViewport - Function to get viewport info (zoom, pan, and dimensions)
 */
export function runAssemblyAnimation(
	getNodes: () => NodeInfo[],
	getEdges: () => EdgeInfo[],
	fitView: () => void,
	getViewport: () => ViewportInfo
): void {
	if (!isAnimationEnabled()) {
		return;
	}

	// Hide everything immediately
	document.body.classList.add('assembly-pending');

	// Wait for nodes to load, then fit view
	setTimeout(() => {
		fitView();

		// Calculate animation timing and start
		setTimeout(() => {
			const nodes = getNodes();
			const edges = getEdges();
			const viewport = getViewport();

			if (nodes.length === 0) {
				document.body.classList.remove('assembly-pending');
				return;
			}

			calculateAnimationTiming(nodes, edges, viewport);
			document.body.classList.remove('assembly-pending');
			applyAnimationToDOM();
		}, CONFIG.fitViewDelay);
	}, CONFIG.initialDelay);
}

// ============================================================================
// Internal Functions
// ============================================================================

function calculateAnimationTiming(nodes: NodeInfo[], edges: EdgeInfo[], viewport: ViewportInfo): void {
	// Shuffle nodes for organic feel
	const shuffledNodes = [...nodes].sort(() => Math.random() - 0.5);

	// Calculate top-left corner of viewport in flow coordinates
	// This is where the PathView logo is
	const cornerX = -viewport.x / viewport.zoom;
	const cornerY = -viewport.y / viewport.zoom;

	// Add margin so nodes start outside the viewport
	const margin = CONFIG.flyDistanceMargin;
	const spawnX = cornerX - margin;
	const spawnY = cornerY - margin;

	// Calculate delays and fly-from positions for nodes
	nodeDelays = new Map();
	nodeFlyFrom = new Map();

	shuffledNodes.forEach((node, index) => {
		nodeDelays.set(node.id, index * CONFIG.nodeStagger);

		// Calculate offset from node's final position to the spawn point
		nodeFlyFrom.set(node.id, {
			x: spawnX - node.x,
			y: spawnY - node.y
		});
	});

	// Calculate delays for edges - appear when BOTH connected nodes have landed
	edgeDelays = new Map();
	edges.forEach((edge) => {
		const sourceDelay = nodeDelays.get(edge.source) ?? 0;
		const targetDelay = nodeDelays.get(edge.target) ?? 0;
		const bothNodesLanded = Math.max(sourceDelay, targetDelay) + CONFIG.nodeDuration * 0.7;
		edgeDelays.set(edge.id, bothNodesLanded);
	});

	isActive = true;
	addSkipListeners();

	// Schedule cleanup
	const maxNodeDelay = shuffledNodes.length * CONFIG.nodeStagger;
	const maxEdgeDelay = Math.max(...Array.from(edgeDelays.values()), 0);
	const totalDuration = Math.max(maxNodeDelay, maxEdgeDelay) +
		CONFIG.nodeDuration + CONFIG.edgeDuration + CONFIG.arrowDuration + 200;

	cleanupTimeoutId = setTimeout(cleanup, totalDuration);
}

function applyAnimationToDOM(): void {
	if (!isActive) return;

	const nodeElements = document.querySelectorAll('.svelte-flow__node');
	const edgeElements = document.querySelectorAll('.svelte-flow__edge');

	// Apply to nodes
	nodeElements.forEach((el) => {
		const nodeId = el.getAttribute('data-id');
		if (!nodeId) return;

		const delay = nodeDelays.get(nodeId) ?? 0;
		const flyFrom = nodeFlyFrom.get(nodeId) ?? { x: 0, y: -100 };
		const htmlEl = el as HTMLElement;

		htmlEl.style.setProperty('--assembly-delay', `${delay}ms`);
		htmlEl.style.setProperty('--assembly-duration', `${CONFIG.nodeDuration}ms`);
		htmlEl.style.setProperty('--fly-from-x', `${flyFrom.x}px`);
		htmlEl.style.setProperty('--fly-from-y', `${flyFrom.y}px`);
		el.classList.add('assembling');
	});

	// Apply to edges
	edgeElements.forEach((el) => {
		const edgeId = el.getAttribute('data-id');
		if (!edgeId) return;

		const delay = edgeDelays.get(edgeId) ?? 0;
		const htmlEl = el as HTMLElement;

		// Calculate path length for drawing animation
		const pathEl = el.querySelector('path.svelte-flow__edge-path') as SVGPathElement;
		if (pathEl) {
			const pathLength = pathEl.getTotalLength();
			htmlEl.style.setProperty('--edge-length', `${pathLength}`);
		}

		htmlEl.style.setProperty('--assembly-delay', `${delay}ms`);
		htmlEl.style.setProperty('--assembly-duration', `${CONFIG.edgeDuration}ms`);
		el.classList.add('assembling');
	});
}

function cleanup(): void {
	// Remove animation classes and CSS variables
	document.querySelectorAll('.assembling').forEach((el) => {
		el.classList.remove('assembling');
		const htmlEl = el as HTMLElement;
		htmlEl.style.removeProperty('--assembly-delay');
		htmlEl.style.removeProperty('--assembly-duration');
		htmlEl.style.removeProperty('--fly-from-x');
		htmlEl.style.removeProperty('--fly-from-y');
		htmlEl.style.removeProperty('--edge-length');
	});

	// Also remove pending class if skip happened during initial delay
	document.body.classList.remove('assembly-pending');

	// Reset state
	nodeDelays = new Map();
	nodeFlyFrom = new Map();
	edgeDelays = new Map();
	isActive = false;
	cleanupTimeoutId = null;
	removeSkipListeners();
}
