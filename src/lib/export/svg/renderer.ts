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
import { getThemeColors } from '$lib/constants/theme';
import { NODE, EVENT } from '$lib/constants/dimensions';
import { getHandlePath } from '$lib/constants/handlePaths';
import { latexToSvg, getSvgDimensions, preloadMathJax } from '$lib/utils/mathjaxSvg';

// Preload MathJax when module loads
if (typeof window !== 'undefined') {
	preloadMathJax();
}
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

/**
 * Extract LaTeX from a string with $...$ delimiters
 */
function extractLatex(text: string): { before: string; latex: string; after: string } | null {
	const match = text.match(/^(.*?)\$([^$]+)\$(.*)$/);
	if (!match) return null;
	return { before: match[1], latex: match[2], after: match[3] };
}

/**
 * Render a plain text label as SVG
 */
function renderPlainTextLabel(
	text: string,
	centerX: number,
	centerY: number,
	color: string,
	fontSize: number,
	fontWeight: string
): string {
	return `<text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="${fontSize}" font-weight="${fontWeight}" font-family="system-ui, -apple-system, sans-serif">${escapeXml(text)}</text>`;
}

/**
 * Render a label that may contain math as native SVG using MathJax
 * @param originalText - The original text with $...$ LaTeX delimiters (NOT the rendered DOM content)
 */
async function renderMathLabel(
	originalText: string,
	centerX: number,
	centerY: number,
	color: string,
	fontSize: number,
	fontWeight: string,
	ctx: RenderContext
): Promise<string> {
	const mathParts = extractLatex(originalText);

	if (!mathParts) {
		// Plain text - use regular SVG text
		return renderPlainTextLabel(originalText, centerX, centerY, color, fontSize, fontWeight);
	}

	try {
		// Render the LaTeX to SVG using MathJax
		// Wrap in \boldsymbol to match the bold font-weight (600) used on canvas
		const boldLatex = `\\boldsymbol{${mathParts.latex}}`;
		let svg = await latexToSvg(boldLatex, false);
		const dims = getSvgDimensions(svg);

		// Apply color to the SVG
		svg = svg.replace(/currentColor/g, color);

		// Add stroke to math paths to match system font weight (600)
		// MathJax math fonts are lighter than system-ui bold
		svg = svg.replace(/<path /g, `<path stroke="${color}" stroke-width="1" `);

		// Scale factor: MathJax renders at a larger default size
		// Empirically tuned to match KaTeX rendering at 10px font-size
		const scale = fontSize / 18;

		// Calculate position (center the SVG)
		const x = centerX - (dims.width * scale) / 2;
		const y = centerY - (dims.height * scale) / 2;

		// Wrap in a group with transform for positioning and scaling
		return `<g transform="translate(${x.toFixed(2)}, ${y.toFixed(2)}) scale(${scale.toFixed(3)})">${svg}</g>`;
	} catch (e) {
		console.error('MathJax SVG rendering error:', e);
		// Fall back to plain text showing the raw LaTeX
		return renderPlainTextLabel(originalText, centerX, centerY, color, fontSize, fontWeight);
	}
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

async function renderNode(node: NodeInstance, ctx: RenderContext): Promise<string> {
	const wrapper = document.querySelector(`[data-id="${node.id}"]`) as HTMLElement;
	if (!wrapper) return '';

	const nodeEl = wrapper.querySelector('.node') as HTMLElement;
	if (!nodeEl) return '';

	// Get dimensions from the actual .node element (not SvelteFlow wrapper)
	// This ensures we use our dynamic width calculation for math names
	const zoom = getZoom();
	const nodeRect = nodeEl.getBoundingClientRect();
	const width = nodeRect.width / zoom;
	const height = nodeRect.height / zoom;

	// Position is center-origin, convert to top-left for SVG
	const x = node.position.x - width / 2;
	const y = node.position.y - height / 2;

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

	// Check for pinned params section in DOM
	const pinnedParamsEl = nodeEl.querySelector('.pinned-params') as HTMLElement;

	// Calculate content center (above pinned params if present)
	let contentCenterY = y + height / 2;
	if (pinnedParamsEl) {
		const pinnedRect = pinnedParamsEl.getBoundingClientRect();
		const pinnedTop = (pinnedRect.top - nodeRect.top) / zoom;
		contentCenterY = y + pinnedTop / 2;
	}

	// Labels
	if (ctx.options.showLabels) {
		const centerX = x + width / 2;

		if (ctx.options.showTypeLabels && nodeType) {
			// Name above center (may contain math) - use original node.name for LaTeX source
			// Spacing: name at -6 and type at +10 gives 16px gap for better separation
			parts.push(await renderMathLabel(node.name, centerX, contentCenterY - 6, color, 10, '600', ctx));
			// Type below center
			parts.push(
				`<text x="${centerX}" y="${contentCenterY + 10}" text-anchor="middle" dominant-baseline="middle" fill="${ctx.theme.textMuted}" font-size="8" font-family="system-ui, -apple-system, sans-serif">${escapeXml(nodeType)}</text>`
			);
		} else {
			// Just name, centered (may contain math) - use original node.name for LaTeX source
			parts.push(await renderMathLabel(node.name, centerX, contentCenterY, color, 10, '600', ctx));
		}
	}

	// Pinned parameters - read positions from DOM
	if (pinnedParamsEl) {
		const pinnedRect = pinnedParamsEl.getBoundingClientRect();
		const pinnedTop = y + (pinnedRect.top - nodeRect.top) / zoom;
		const pinnedHeight = pinnedRect.height / zoom;

		// Separator line
		parts.push(
			`<line x1="${x}" y1="${pinnedTop}" x2="${x + width}" y2="${pinnedTop}" stroke="${ctx.theme.border}" stroke-width="1"/>`
		);

		// Background for pinned params area (square top, rounded bottom to match node)
		const px = x + 1;
		const py = pinnedTop + 1;
		const pw = width - 2;
		const ph = pinnedHeight - 1;
		const br = Math.max(0, borderRadius - 1);
		// Path: start top-left, go right, down, rounded bottom-right, left, rounded bottom-left, up
		parts.push(
			`<path d="M${px},${py} h${pw} v${ph - br} a${br},${br} 0 0 1 -${br},${br} h-${pw - 2 * br} a${br},${br} 0 0 1 -${br},-${br} v-${ph - br} z" fill="${ctx.theme.surface}"/>`
		);

		// Each pinned param row - read from DOM
		pinnedParamsEl.querySelectorAll('.pinned-param').forEach((paramEl) => {
			const labelEl = paramEl.querySelector('label') as HTMLElement;
			const inputEl = paramEl.querySelector('input') as HTMLInputElement;
			if (!labelEl || !inputEl) return;

			const labelRect = labelEl.getBoundingClientRect();
			const inputRect = inputEl.getBoundingClientRect();

			// Label position
			const labelX = x + (labelRect.left - nodeRect.left) / zoom;
			const labelY = y + (labelRect.top + labelRect.height / 2 - nodeRect.top) / zoom;
			const labelText = labelEl.textContent || '';

			parts.push(
				`<text x="${labelX}" y="${labelY}" dominant-baseline="middle" fill="${ctx.theme.textMuted}" font-size="8" font-family="system-ui, -apple-system, sans-serif">${escapeXml(labelText)}</text>`
			);

			// Input box position
			const inputX = x + (inputRect.left - nodeRect.left) / zoom;
			const inputY = y + (inputRect.top - nodeRect.top) / zoom;
			const inputW = inputRect.width / zoom;
			const inputH = inputRect.height / zoom;
			const inputValue = inputEl.value || inputEl.placeholder || '';
			const inputBorderRadius = parseFloat(getComputedStyle(inputEl).borderRadius) || inputH / 2;

			// Input background (pill shape)
			parts.push(
				`<rect x="${inputX}" y="${inputY}" width="${inputW}" height="${inputH}" rx="${inputBorderRadius}" fill="${ctx.theme.surfaceRaised}" stroke="${ctx.theme.border}" stroke-width="1"/>`
			);

			// Input value
			parts.push(
				`<text x="${inputX + 8}" y="${inputY + inputH / 2}" dominant-baseline="middle" fill="${ctx.theme.text}" font-size="9" font-family="ui-monospace, monospace">${escapeXml(inputValue)}</text>`
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
	if (!wrapper) return '';

	const zoom = getZoom();

	// Get text from DOM
	const nameEl = wrapper.querySelector('.event-name');
	const typeEl = wrapper.querySelector('.event-type');
	const eventName = nameEl?.textContent || event.name;
	const eventType = typeEl?.textContent || '';

	// Position is center-origin, so position IS the center
	const cx = event.position.x;
	const cy = event.position.y;
	const color = event.color || ctx.theme.accent;

	const parts: string[] = [];

	// Get diamond element and its dimensions from DOM
	const diamondEl = wrapper.querySelector('.diamond') as HTMLElement;
	if (diamondEl) {
		const diamondRect = diamondEl.getBoundingClientRect();
		const diamondSize = diamondRect.width / zoom; // Diamond is square
		const diamondOffset = diamondSize / 2;
		const borderRadius = parseFloat(getComputedStyle(diamondEl).borderRadius) || 4;

		// Diamond background
		parts.push(
			`<rect x="${cx - diamondOffset}" y="${cy - diamondOffset}" width="${diamondSize}" height="${diamondSize}" rx="${borderRadius}" fill="${ctx.theme.surfaceRaised}" transform="rotate(45 ${cx} ${cy})"/>`
		);

		// Diamond border
		parts.push(
			`<rect x="${cx - diamondOffset}" y="${cy - diamondOffset}" width="${diamondSize}" height="${diamondSize}" rx="${borderRadius}" fill="none" stroke="${ctx.theme.edge}" stroke-width="1" transform="rotate(45 ${cx} ${cy})"/>`
		);
	}

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
	const zoom = getZoom();

	for (const node of nodes) {
		// Get dimensions from the actual .node element (not SvelteFlow wrapper)
		const wrapper = document.querySelector(`[data-id="${node.id}"]`) as HTMLElement;
		const nodeEl = wrapper?.querySelector('.node') as HTMLElement;
		let width = NODE.baseWidth;
		let height = NODE.baseHeight;
		if (nodeEl) {
			const rect = nodeEl.getBoundingClientRect();
			width = rect.width / zoom;
			height = rect.height / zoom;
		}
		// Position is center-origin, calculate corners
		const left = node.position.x - width / 2;
		const top = node.position.y - height / 2;
		bounds.minX = Math.min(bounds.minX, left);
		bounds.minY = Math.min(bounds.minY, top);
		bounds.maxX = Math.max(bounds.maxX, left + width);
		bounds.maxY = Math.max(bounds.maxY, top + height);
	}

	for (const event of events) {
		// Events use center-origin, get actual bounding box from DOM
		const wrapper = document.querySelector(`[data-id="${event.id}"]`) as HTMLElement;
		let boundingSize = EVENT.size; // Fallback

		if (wrapper) {
			const diamondEl = wrapper.querySelector('.diamond') as HTMLElement;
			if (diamondEl) {
				const zoom = getZoom();
				const diamondSize = diamondEl.getBoundingClientRect().width / zoom;
				// Rotated 45° square has bounding box of size * sqrt(2)
				boundingSize = diamondSize * Math.SQRT2;
			}
		}

		const left = event.position.x - boundingSize / 2;
		const top = event.position.y - boundingSize / 2;
		bounds.minX = Math.min(bounds.minX, left);
		bounds.minY = Math.min(bounds.minY, top);
		bounds.maxX = Math.max(bounds.maxX, left + boundingSize);
		bounds.maxY = Math.max(bounds.maxY, top + boundingSize);
	}

	return isFinite(bounds.minX) ? bounds : { minX: 0, minY: 0, maxX: 200, maxY: 200 };
}

export async function exportToSVG(options: ExportOptions = {}): Promise<string> {
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

	// Nodes (render in parallel for performance)
	if (nodes.length > 0) {
		parts.push('<g class="nodes">');
		const renderedNodes = await Promise.all(nodes.map((node) => renderNode(node, ctx)));
		for (const rendered of renderedNodes) {
			if (rendered) parts.push(rendered);
		}
		parts.push('</g>');
	}

	parts.push('</svg>');
	return parts.join('\n');
}
