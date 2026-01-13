/**
 * SVG Export Module
 *
 * Exports the current graph view as a clean SVG file.
 * Uses a hybrid approach:
 * - Extracts actual edge paths from SvelteFlow's rendered DOM
 * - Renders simplified node/event shapes with text labels
 * - Extracts handle positions from DOM for accurate placement
 */

import { get } from 'svelte/store';
import { graphStore } from '$lib/stores/graph';
import { eventStore } from '$lib/stores/events';
import { nodeRegistry } from '$lib/nodes';
import { eventRegistry } from '$lib/events/registry';
import type { NodeInstance } from '$lib/types/nodes';
import type { EventInstance } from '$lib/types/events';
import { downloadSvg } from './download';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Layout constants */
const PADDING = 40;
const EVENT_SIZE = 80;
const EVENT_CENTER = EVENT_SIZE / 2; // 40
const EVENT_DIAMOND_SIZE = 56;
const EVENT_DIAMOND_OFFSET = EVENT_DIAMOND_SIZE / 2; // 28

/** Node dimension defaults */
const NODE_BASE_WIDTH = 90;
const NODE_BASE_HEIGHT = 36;
const NODE_PORT_SPACING = 18;

/** Handle arrow paths for each rotation direction (from BaseNode.svelte clip-paths) */
const HANDLE_PATHS: Record<number, { path: string; width: number; height: number }> = {
	0: {
		path: 'M 1 0 L 5 0 Q 6 0 6.71 0.71 L 9.29 3.29 Q 10 4 9.29 4.71 L 6.71 7.29 Q 6 8 5 8 L 1 8 Q 0 8 0 7 L 0 1 Q 0 0 1 0 Z',
		width: 10,
		height: 8
	},
	1: {
		path: 'M 1 0 L 7 0 Q 8 0 8 1 L 8 5 Q 8 6 7.29 6.71 L 4.71 9.29 Q 4 10 3.29 9.29 L 0.71 6.71 Q 0 6 0 5 L 0 1 Q 0 0 1 0 Z',
		width: 8,
		height: 10
	},
	2: {
		path: 'M 5 0 L 9 0 Q 10 0 10 1 L 10 7 Q 10 8 9 8 L 5 8 Q 4 8 3.29 7.29 L 0.71 4.71 Q 0 4 0.71 3.29 L 3.29 0.71 Q 4 0 5 0 Z',
		width: 10,
		height: 8
	},
	3: {
		path: 'M 4.71 0.71 L 7.29 3.29 Q 8 4 8 5 L 8 9 Q 8 10 7 10 L 1 10 Q 0 10 0 9 L 0 5 Q 0 4 0.71 3.29 L 3.29 0.71 Q 4 0 4.71 0.71 Z',
		width: 8,
		height: 10
	}
};

/** Node border radius by category */
const BORDER_RADIUS: Record<string, number> = {
	Sources: 20,
	Recording: 16, // Will be overridden to create circle
	Algebraic: 4,
	default: 8
};

// ============================================================================
// TYPES
// ============================================================================

export interface ExportOptions {
	filename?: string;
	includeBackground?: boolean;
}

interface Colors {
	edge: string;
	text: string;
	textMuted: string;
	accent: string;
	surface: string;
}

interface Bounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Get current theme colors from CSS variables */
function getColors(): Colors {
	const style = getComputedStyle(document.documentElement);
	const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;

	return {
		edge: get('--edge', '#7F7F7F'),
		text: get('--text', '#f0f0f5'),
		textMuted: get('--text-muted', '#808090'),
		accent: get('--accent', '#0070C0'),
		surface: get('--surface', '#08080c')
	};
}

/** Get current viewport zoom level */
function getZoom(): number {
	const viewport = document.querySelector('.svelte-flow__viewport') as HTMLElement;
	if (!viewport) return 1;

	const match = viewport.style.transform.match(/scale\(([^)]+)\)/);
	return match ? parseFloat(match[1]) : 1;
}

/** Escape special XML characters */
function escapeXml(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Get node dimensions from DOM or calculate fallback */
function getNodeDimensions(node: NodeInstance): { width: number; height: number } {
	const nodeEl = document.querySelector(`[data-id="${node.id}"]`) as HTMLElement;
	if (nodeEl) {
		const rect = nodeEl.getBoundingClientRect();
		const zoom = getZoom();
		return { width: rect.width / zoom, height: rect.height / zoom };
	}

	// Fallback calculation
	const rotation = (node.params?.['_rotation'] as number) || 0;
	const isVertical = rotation === 1 || rotation === 3;
	const maxPorts = Math.max(node.inputs.length, node.outputs.length);

	return {
		width: isVertical ? Math.max(NODE_BASE_WIDTH, maxPorts * NODE_PORT_SPACING + 20) : NODE_BASE_WIDTH,
		height: isVertical ? NODE_BASE_HEIGHT : Math.max(NODE_BASE_HEIGHT, maxPorts * NODE_PORT_SPACING + 10)
	};
}

// ============================================================================
// DOM EXTRACTION
// ============================================================================

/** Extract edge paths and arrows from SvelteFlow's rendered DOM */
function extractEdges(colors: Colors): string {
	const container = document.querySelector('.svelte-flow__edges');
	if (!container) return '';

	let svg = '';

	container.querySelectorAll('.svelte-flow__edge').forEach((edge) => {
		// Main edge path
		const pathEl = edge.querySelector('.svelte-flow__edge-path');
		if (pathEl) {
			const d = pathEl.getAttribute('d');
			if (d) {
				svg += `\n\t\t<path d="${d}" fill="none" stroke="${colors.edge}" stroke-width="1.5"/>`;
			}
		}

		// Arrow head
		const arrowGroup = edge.querySelector('g[transform*="rotate"]');
		if (arrowGroup) {
			const transform = arrowGroup.getAttribute('transform');
			const arrowPath = arrowGroup.querySelector('path');
			if (arrowPath && transform) {
				const d = arrowPath.getAttribute('d');
				if (d) {
					svg += `\n\t\t<g transform="${transform}"><path d="${d}" fill="${colors.edge}"/></g>`;
				}
			}
		}
	});

	return svg;
}

/** Extract handle positions and render them */
function extractHandles(nodeId: string, nodeX: number, nodeY: number, colors: Colors): string {
	const wrapper = document.querySelector(`[data-id="${nodeId}"]`);
	if (!wrapper) return '';

	const nodeEl = wrapper.querySelector('[data-rotation]') || wrapper;
	const rotation = parseInt(nodeEl.getAttribute('data-rotation') || '0');
	const handleDef = HANDLE_PATHS[rotation] || HANDLE_PATHS[0];
	const zoom = getZoom();
	const nodeRect = wrapper.getBoundingClientRect();

	let svg = '';

	nodeEl.querySelectorAll('.svelte-flow__handle').forEach((handle) => {
		const rect = handle.getBoundingClientRect();
		const cx = (rect.left + rect.width / 2 - nodeRect.left) / zoom;
		const cy = (rect.top + rect.height / 2 - nodeRect.top) / zoom;
		const x = nodeX + cx - handleDef.width / 2;
		const y = nodeY + cy - handleDef.height / 2;

		svg += `\n\t\t<path d="${handleDef.path}" transform="translate(${x}, ${y})" fill="${colors.edge}"/>`;
	});

	return svg;
}

// ============================================================================
// ELEMENT RENDERERS
// ============================================================================

function renderNode(node: NodeInstance, colors: Colors): string {
	const { width, height } = getNodeDimensions(node);
	const { x, y } = node.position;
	const typeDef = nodeRegistry.get(node.type);
	const color = node.color || colors.accent;
	const isSubsystem = node.type === 'Subsystem' || node.type === 'Interface';

	// Determine border radius
	let rx = BORDER_RADIUS[typeDef?.category || 'default'] || BORDER_RADIUS.default;
	if (typeDef?.category === 'Recording') rx = Math.min(width, height) / 2;

	const handles = extractHandles(node.id, x, y, colors);

	return `
	<g class="node" data-id="${node.id}">
		<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}"
			fill="none" stroke="${colors.edge}" stroke-width="1"${isSubsystem ? ' stroke-dasharray="4 2"' : ''}/>
		<text x="${x + width / 2}" y="${y + height / 2 - 3}" text-anchor="middle" dominant-baseline="middle"
			fill="${color}" font-size="10" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(node.name)}</text>
		<text x="${x + width / 2}" y="${y + height / 2 + 9}" text-anchor="middle" dominant-baseline="middle"
			fill="${colors.textMuted}" font-size="8" font-family="system-ui, sans-serif">${escapeXml(typeDef?.name || node.type)}</text>${handles}
	</g>`;
}

function renderEvent(event: EventInstance, colors: Colors): string {
	const cx = event.position.x + EVENT_CENTER;
	const cy = event.position.y + EVENT_CENTER;
	const color = event.color || colors.accent;
	const typeDef = eventRegistry.get(event.type);

	return `
	<g class="event" data-id="${event.id}">
		<rect x="${cx - EVENT_DIAMOND_OFFSET}" y="${cy - EVENT_DIAMOND_OFFSET}" width="${EVENT_DIAMOND_SIZE}" height="${EVENT_DIAMOND_SIZE}" rx="4"
			fill="none" stroke="${colors.edge}" stroke-width="1" transform="rotate(45 ${cx} ${cy})"/>
		<text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="middle"
			fill="${color}" font-size="10" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(event.name)}</text>
		<text x="${cx}" y="${cy + 10}" text-anchor="middle" dominant-baseline="middle"
			fill="${colors.textMuted}" font-size="8" font-family="system-ui, sans-serif">${escapeXml(typeDef?.name || '')}</text>
	</g>`;
}

// ============================================================================
// BOUNDS CALCULATION
// ============================================================================

function calculateBounds(nodes: NodeInstance[], events: EventInstance[]): Bounds {
	const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

	for (const node of nodes) {
		const { width, height } = getNodeDimensions(node);
		bounds.minX = Math.min(bounds.minX, node.position.x);
		bounds.minY = Math.min(bounds.minY, node.position.y);
		bounds.maxX = Math.max(bounds.maxX, node.position.x + width);
		bounds.maxY = Math.max(bounds.maxY, node.position.y + height);
	}

	for (const event of events) {
		bounds.minX = Math.min(bounds.minX, event.position.x);
		bounds.minY = Math.min(bounds.minY, event.position.y);
		bounds.maxX = Math.max(bounds.maxX, event.position.x + EVENT_SIZE);
		bounds.maxY = Math.max(bounds.maxY, event.position.y + EVENT_SIZE);
	}

	return isFinite(bounds.minX) ? bounds : { minX: 0, minY: 0, maxX: 200, maxY: 200 };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/** Export the current graph as an SVG file */
export function exportGraphAsSvg(options: ExportOptions = {}): void {
	const { filename = 'pathview-graph', includeBackground = false } = options;

	const colors = getColors();
	const nodes = get(graphStore.nodesArray);
	const events = get(eventStore.eventsArray);

	// Calculate SVG dimensions
	const bounds = calculateBounds(nodes, events);
	const width = bounds.maxX - bounds.minX + PADDING * 2;
	const height = bounds.maxY - bounds.minY + PADDING * 2;
	const viewBox = `${bounds.minX - PADDING} ${bounds.minY - PADDING} ${width} ${height}`;

	// Build SVG content
	const parts: string[] = [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">`
	];

	if (includeBackground) {
		parts.push(`\t<rect x="${bounds.minX - PADDING}" y="${bounds.minY - PADDING}" width="${width}" height="${height}" fill="${colors.surface}"/>`);
	}

	// Edges (extracted from DOM)
	parts.push(`\n\t<g class="edges">${extractEdges(colors)}\n\t</g>`);

	// Events
	if (events.length > 0) {
		parts.push(`\n\t<g class="events">${events.map((e) => renderEvent(e, colors)).join('')}\n\t</g>`);
	}

	// Nodes
	if (nodes.length > 0) {
		parts.push(`\n\t<g class="nodes">${nodes.map((n) => renderNode(n, colors)).join('')}\n\t</g>`);
	}

	parts.push('</svg>');

	downloadSvg(parts.join('\n'), `${filename}.svg`);
}
