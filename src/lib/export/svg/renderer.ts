/**
 * SVG Renderer
 *
 * Renders the current graph view as SVG using a hybrid approach:
 * - Edges: cloned directly from SvelteFlow's SVG (already vector graphics)
 * - Nodes/Events: pure SVG with dimensions and styles read from DOM
 *
 * This approach ensures pixel-perfect accuracy while producing clean SVG output.
 */

import { get } from 'svelte/store';
import { graphStore } from '$lib/stores/graph';
import { eventStore } from '$lib/stores/events';
import { nodeRegistry } from '$lib/nodes';
import { getThemeColors } from '$lib/constants/theme';
import { NODE, EVENT } from '$lib/constants/dimensions';
import { getHandlePath } from '$lib/constants/handlePaths';
import type { ExportOptions, RenderContext, Bounds } from './types';
import { DEFAULT_OPTIONS } from './types';
import type { NodeInstance } from '$lib/types/nodes';
import type { EventInstance } from '$lib/types/events';

// ============================================================================
// DOM UTILITIES
// ============================================================================

function getZoom(): number {
	const viewport = document.querySelector('.svelte-flow__viewport') as HTMLElement;
	if (!viewport) return 1;
	const match = viewport.style.transform.match(/scale\(([^)]+)\)/);
	return match ? parseFloat(match[1]) : 1;
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function getNodeDimensions(nodeId: string): { width: number; height: number } | null {
	const wrapper = document.querySelector(`[data-id="${nodeId}"]`) as HTMLElement;
	if (!wrapper) return null;
	const rect = wrapper.getBoundingClientRect();
	const zoom = getZoom();
	return { width: rect.width / zoom, height: rect.height / zoom };
}

// ============================================================================
// EDGE RENDERING - Clone from DOM
// ============================================================================

function renderEdges(ctx: RenderContext): string {
	const container = document.querySelector('.svelte-flow__edges');
	if (!container) return '';

	const parts: string[] = [];

	container.querySelectorAll('.svelte-flow__edge').forEach((edge) => {
		const edgeParts: string[] = [];

		// Get all paths and groups within this edge
		edge.querySelectorAll('path').forEach((pathEl) => {
			const d = pathEl.getAttribute('d');
			if (!d) return;

			// Check if it's the main edge path or arrow
			if (pathEl.classList.contains('svelte-flow__edge-path')) {
				edgeParts.push(
					`<path d="${d}" fill="none" stroke="${ctx.theme.edge}" stroke-width="1.5"/>`
				);
			}
		});

		// Find arrow groups (have transform with rotate)
		edge.querySelectorAll('g').forEach((g) => {
			const transform = g.getAttribute('transform');
			if (transform && transform.includes('rotate')) {
				const arrowPath = g.querySelector('path');
				if (arrowPath) {
					const d = arrowPath.getAttribute('d');
					if (d) {
						edgeParts.push(`<g transform="${transform}"><path d="${d}" fill="${ctx.theme.edge}"/></g>`);
					}
				}
			}
		});

		if (edgeParts.length > 0) {
			parts.push(`<g class="edge">${edgeParts.join('')}</g>`);
		}
	});

	return parts.length > 0 ? `<g class="edges">\n${parts.join('\n')}\n</g>` : '';
}

// ============================================================================
// HANDLE RENDERING
// ============================================================================

function renderHandles(nodeId: string, nodeX: number, nodeY: number, ctx: RenderContext): string {
	const wrapper = document.querySelector(`[data-id="${nodeId}"]`);
	if (!wrapper) return '';

	const nodeEl = wrapper.querySelector('[data-rotation]') || wrapper;
	const rotation = parseInt(nodeEl.getAttribute('data-rotation') || '0');
	const paths = getHandlePath(rotation);
	const zoom = getZoom();
	const nodeRect = wrapper.getBoundingClientRect();

	const handles: string[] = [];

	nodeEl.querySelectorAll('.svelte-flow__handle').forEach((handle) => {
		const rect = handle.getBoundingClientRect();
		const cx = (rect.left + rect.width / 2 - nodeRect.left) / zoom;
		const cy = (rect.top + rect.height / 2 - nodeRect.top) / zoom;
		const x = nodeX + cx - paths.width / 2;
		const y = nodeY + cy - paths.height / 2;

		handles.push(`<g transform="translate(${x.toFixed(2)}, ${y.toFixed(2)})">
	<path d="${paths.outer}" fill="${ctx.theme.edge}"/>
	<path d="${paths.inner}" fill="${ctx.theme.surfaceRaised}" transform="translate(1, 1)"/>
</g>`);
	});

	return handles.join('\n');
}

// ============================================================================
// NODE RENDERING - Pure SVG with DOM-read styles
// ============================================================================

function renderNode(node: NodeInstance, ctx: RenderContext): string {
	const wrapper = document.querySelector(`[data-id="${node.id}"]`) as HTMLElement;
	if (!wrapper) return '';

	const dims = getNodeDimensions(node.id);
	if (!dims) return '';
	const { width, height } = dims;

	// Position is center-origin, convert to top-left for SVG
	const x = node.position.x - width / 2;
	const y = node.position.y - height / 2;

	const nodeEl = wrapper.querySelector('.node') as HTMLElement;
	if (!nodeEl) return '';

	// Read styles from DOM
	const computed = getComputedStyle(nodeEl);
	const borderRadius = parseFloat(computed.borderRadius) || 8;
	const isSubsystem = node.type === 'Subsystem' || node.type === 'Interface';
	const color = node.color || ctx.theme.accent;

	// Get text content
	const nameEl = nodeEl.querySelector('.node-name');
	const typeEl = nodeEl.querySelector('.node-type');
	const nodeName = nameEl?.textContent || node.name;
	const nodeType = typeEl?.textContent || '';

	const parts: string[] = [];

	// Background fill
	parts.push(
		`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${borderRadius}" fill="${ctx.theme.surfaceRaised}"/>`
	);

	// Border
	const strokeDasharray = isSubsystem ? ' stroke-dasharray="4 2"' : '';
	parts.push(
		`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${borderRadius}" fill="none" stroke="${ctx.theme.edge}" stroke-width="1"${strokeDasharray}/>`
	);

	// Get pinned params info
	const typeDef = nodeRegistry.get(node.type);
	const validPinnedParams = node.pinnedParams?.filter(
		(name) => typeDef?.params.some((p) => p.name === name)
	) || [];
	const hasPinnedParams = validPinnedParams.length > 0;

	// Calculate content area height (excluding pinned params)
	// Pinned params: 7px top padding + 24px per row
	const pinnedParamsHeight = hasPinnedParams ? 7 + 24 * validPinnedParams.length : 0;
	const contentHeight = height - pinnedParamsHeight;

	// Labels
	if (ctx.options.showLabels) {
		const centerX = x + width / 2;
		const contentCenterY = y + contentHeight / 2;

		if (ctx.options.showTypeLabels && nodeType) {
			// Name above center
			parts.push(
				`<text x="${centerX}" y="${contentCenterY - 4}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="10" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${escapeXml(nodeName)}</text>`
			);
			// Type below center
			parts.push(
				`<text x="${centerX}" y="${contentCenterY + 8}" text-anchor="middle" dominant-baseline="middle" fill="${ctx.theme.textMuted}" font-size="8" font-family="system-ui, -apple-system, sans-serif">${escapeXml(nodeType)}</text>`
			);
		} else {
			// Just name, centered
			parts.push(
				`<text x="${centerX}" y="${contentCenterY}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="10" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${escapeXml(nodeName)}</text>`
			);
		}
	}

	// Pinned parameters
	if (hasPinnedParams && typeDef) {
		const pinnedY = y + contentHeight;

		// Separator line
		parts.push(
			`<line x1="${x}" y1="${pinnedY}" x2="${x + width}" y2="${pinnedY}" stroke="${ctx.theme.border}" stroke-width="1"/>`
		);

		// Background for pinned params area
		parts.push(
			`<rect x="${x + 1}" y="${pinnedY + 1}" width="${width - 2}" height="${pinnedParamsHeight - 2}" rx="${Math.max(0, borderRadius - 1)}" fill="${ctx.theme.surface}"/>`
		);

		// Each pinned param row
		validPinnedParams.forEach((paramName, index) => {
			const paramDef = typeDef.params.find((p) => p.name === paramName);
			const value = node.params[paramName];
			const displayValue = value !== undefined && value !== '' ? String(value) : (paramDef?.default !== undefined ? String(paramDef.default) : '');

			// Row Y position: 7px top padding + 24px per row, center each row
			const rowY = pinnedY + 7 + index * 24 + 10; // +10 for vertical centering in 20px row

			// Label (left side)
			parts.push(
				`<text x="${x + 10}" y="${rowY}" dominant-baseline="middle" fill="${ctx.theme.textMuted}" font-size="8" font-family="system-ui, -apple-system, sans-serif">${escapeXml(paramName)}</text>`
			);

			// Value (right side, in a box)
			const inputX = x + 60;
			const inputWidth = width - 70;
			const inputY = rowY - 10;
			const inputHeight = 20;

			// Input background
			parts.push(
				`<rect x="${inputX}" y="${inputY}" width="${inputWidth}" height="${inputHeight}" rx="4" fill="${ctx.theme.surfaceRaised}" stroke="${ctx.theme.border}" stroke-width="1"/>`
			);

			// Input value
			parts.push(
				`<text x="${inputX + 8}" y="${rowY}" dominant-baseline="middle" fill="${ctx.theme.text}" font-size="9" font-family="ui-monospace, monospace">${escapeXml(displayValue)}</text>`
			);
		});
	}

	// Handles
	if (ctx.options.showHandles) {
		const handles = renderHandles(node.id, x, y, ctx);
		if (handles) parts.push(handles);
	}

	return `<g class="node" data-id="${node.id}">\n${parts.join('\n')}\n</g>`;
}

// ============================================================================
// EVENT RENDERING - Pure SVG
// ============================================================================

function renderEvent(event: EventInstance, ctx: RenderContext): string {
	const wrapper = document.querySelector(`[data-id="${event.id}"]`) as HTMLElement;

	// Get text from DOM or fallback to data
	let eventName = event.name;
	let eventType = '';

	if (wrapper) {
		const nameEl = wrapper.querySelector('.event-name');
		const typeEl = wrapper.querySelector('.event-type');
		eventName = nameEl?.textContent || event.name;
		eventType = typeEl?.textContent || '';
	}

	// Position is center-origin, so position IS the center
	const cx = event.position.x;
	const cy = event.position.y;
	const color = event.color || ctx.theme.accent;

	const parts: string[] = [];

	// Diamond background
	parts.push(
		`<rect x="${cx - EVENT.diamondOffset}" y="${cy - EVENT.diamondOffset}" width="${EVENT.diamondSize}" height="${EVENT.diamondSize}" rx="4" fill="${ctx.theme.surfaceRaised}" transform="rotate(45 ${cx} ${cy})"/>`
	);

	// Diamond border
	parts.push(
		`<rect x="${cx - EVENT.diamondOffset}" y="${cy - EVENT.diamondOffset}" width="${EVENT.diamondSize}" height="${EVENT.diamondSize}" rx="4" fill="none" stroke="${ctx.theme.edge}" stroke-width="1" transform="rotate(45 ${cx} ${cy})"/>`
	);

	// Labels
	if (ctx.options.showLabels) {
		if (ctx.options.showTypeLabels && eventType) {
			parts.push(
				`<text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="10" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${escapeXml(eventName)}</text>`
			);
			parts.push(
				`<text x="${cx}" y="${cy + 8}" text-anchor="middle" dominant-baseline="middle" fill="${ctx.theme.textMuted}" font-size="8" font-family="system-ui, -apple-system, sans-serif">${escapeXml(eventType)}</text>`
			);
		} else {
			parts.push(
				`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="10" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${escapeXml(eventName)}</text>`
			);
		}
	}

	return `<g class="event" data-id="${event.id}">\n${parts.join('\n')}\n</g>`;
}

// ============================================================================
// BOUNDS & MAIN EXPORT
// ============================================================================

function calculateBounds(nodes: NodeInstance[], events: EventInstance[]): Bounds {
	const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

	for (const node of nodes) {
		const dims = getNodeDimensions(node.id);
		const width = dims?.width ?? NODE.baseWidth;
		const height = dims?.height ?? NODE.baseHeight;
		// Position is center-origin, calculate corners
		const left = node.position.x - width / 2;
		const top = node.position.y - height / 2;
		bounds.minX = Math.min(bounds.minX, left);
		bounds.minY = Math.min(bounds.minY, top);
		bounds.maxX = Math.max(bounds.maxX, left + width);
		bounds.maxY = Math.max(bounds.maxY, top + height);
	}

	for (const event of events) {
		// Events also use center-origin
		const left = event.position.x - EVENT.size / 2;
		const top = event.position.y - EVENT.size / 2;
		bounds.minX = Math.min(bounds.minX, left);
		bounds.minY = Math.min(bounds.minY, top);
		bounds.maxX = Math.max(bounds.maxX, left + EVENT.size);
		bounds.maxY = Math.max(bounds.maxY, top + EVENT.size);
	}

	return isFinite(bounds.minX) ? bounds : { minX: 0, minY: 0, maxX: 200, maxY: 200 };
}

export function exportToSVG(options: ExportOptions = {}): string {
	const opts: Required<ExportOptions> = { ...DEFAULT_OPTIONS, ...options };
	const themeColors = getThemeColors(opts.theme);
	const ctx: RenderContext = { theme: themeColors, options: opts };

	const nodes = get(graphStore.nodesArray);
	const events = get(eventStore.eventsArray);
	const bounds = calculateBounds(nodes, events);

	const width = bounds.maxX - bounds.minX + opts.padding * 2;
	const height = bounds.maxY - bounds.minY + opts.padding * 2;
	const viewBox = `${bounds.minX - opts.padding} ${bounds.minY - opts.padding} ${width} ${height}`;

	const parts: string[] = [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">`
	];

	// Background
	if (opts.background === 'solid') {
		parts.push(
			`<rect x="${bounds.minX - opts.padding}" y="${bounds.minY - opts.padding}" width="${width}" height="${height}" fill="${ctx.theme.surface}"/>`
		);
	}

	// Edges
	const edges = renderEdges(ctx);
	if (edges) parts.push(edges);

	// Events
	if (events.length > 0) {
		parts.push('<g class="events">');
		for (const event of events) {
			parts.push(renderEvent(event, ctx));
		}
		parts.push('</g>');
	}

	// Nodes
	if (nodes.length > 0) {
		parts.push('<g class="nodes">');
		for (const node of nodes) {
			const rendered = renderNode(node, ctx);
			if (rendered) parts.push(rendered);
		}
		parts.push('</g>');
	}

	parts.push('</svg>');
	return parts.join('\n');
}
