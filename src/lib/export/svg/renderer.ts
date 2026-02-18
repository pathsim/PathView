/**
 * SVG Renderer
 *
 * Renders the current graph view as SVG using dom2svg.
 * Resets the SvelteFlow viewport to zoom=1 before capture so that
 * CSS values (font-size, border-radius, etc.) and getBoundingClientRect
 * sizes are consistent — no zoom-induced mismatch.
 *
 * KaTeX math is converted to SVG paths using opentype.js so the SVG
 * is self-contained and renders correctly in any viewer without fonts.
 */

import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import { domToSvg } from '../dom2svg/index.js';
import type { FontMapping } from '../dom2svg/index.js';
import type { ExportOptions } from './types';
import { DEFAULT_OPTIONS } from './types';

/** SvelteFlow UI elements to exclude from export */
const EXCLUDE_SELECTORS = [
	'.svelte-flow__background',
	'.svelte-flow__controls',
	'.svelte-flow__minimap',
	'.svelte-flow__panel',
	'.svelte-flow__edge-interaction',
	'.svelte-flow__attribution',
	'.drop-zone-overlay'
].join(', ');

/** KaTeX font CDN base URL */
const KATEX_CDN = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/fonts';

/** Font mapping for dom2svg textToPath conversion */
const EXPORT_FONTS: FontMapping = {
	// UI fonts — TTF for opentype.js compatibility (woff2 not supported by opentype.js v1.x)
	Inter: { url: '/fonts/InterVariable.ttf' },
	'JetBrains Mono': [
		{ url: '/fonts/JetBrainsMono-Regular.ttf', weight: 400, style: 'normal' },
		{ url: '/fonts/JetBrainsMono-Medium.ttf', weight: 500, style: 'normal' }
	],
	// KaTeX math fonts (CDN)
	KaTeX_Main: [
		{ url: `${KATEX_CDN}/KaTeX_Main-Regular.woff2`, weight: 'normal', style: 'normal' },
		{ url: `${KATEX_CDN}/KaTeX_Main-Bold.woff2`, weight: 'bold', style: 'normal' },
		{ url: `${KATEX_CDN}/KaTeX_Main-Italic.woff2`, weight: 'normal', style: 'italic' },
		{ url: `${KATEX_CDN}/KaTeX_Main-BoldItalic.woff2`, weight: 'bold', style: 'italic' }
	],
	KaTeX_Math: [
		{ url: `${KATEX_CDN}/KaTeX_Math-Italic.woff2`, weight: 'normal', style: 'italic' },
		{ url: `${KATEX_CDN}/KaTeX_Math-BoldItalic.woff2`, weight: 'bold', style: 'italic' }
	],
	KaTeX_Size1: [{ url: `${KATEX_CDN}/KaTeX_Size1-Regular.woff2`, weight: 'normal', style: 'normal' }],
	KaTeX_Size2: [{ url: `${KATEX_CDN}/KaTeX_Size2-Regular.woff2`, weight: 'normal', style: 'normal' }],
	KaTeX_Size3: [{ url: `${KATEX_CDN}/KaTeX_Size3-Regular.woff2`, weight: 'normal', style: 'normal' }],
	KaTeX_Size4: [{ url: `${KATEX_CDN}/KaTeX_Size4-Regular.woff2`, weight: 'normal', style: 'normal' }],
	KaTeX_AMS: [{ url: `${KATEX_CDN}/KaTeX_AMS-Regular.woff2`, weight: 'normal', style: 'normal' }],
	KaTeX_Caligraphic: [
		{ url: `${KATEX_CDN}/KaTeX_Caligraphic-Regular.woff2`, weight: 'normal', style: 'normal' },
		{ url: `${KATEX_CDN}/KaTeX_Caligraphic-Bold.woff2`, weight: 'bold', style: 'normal' }
	],
	KaTeX_Fraktur: [
		{ url: `${KATEX_CDN}/KaTeX_Fraktur-Regular.woff2`, weight: 'normal', style: 'normal' },
		{ url: `${KATEX_CDN}/KaTeX_Fraktur-Bold.woff2`, weight: 'bold', style: 'normal' }
	],
	KaTeX_SansSerif: [
		{ url: `${KATEX_CDN}/KaTeX_SansSerif-Regular.woff2`, weight: 'normal', style: 'normal' },
		{ url: `${KATEX_CDN}/KaTeX_SansSerif-Bold.woff2`, weight: 'bold', style: 'normal' },
		{ url: `${KATEX_CDN}/KaTeX_SansSerif-Italic.woff2`, weight: 'normal', style: 'italic' }
	],
	KaTeX_Script: [{ url: `${KATEX_CDN}/KaTeX_Script-Regular.woff2`, weight: 'normal', style: 'normal' }],
	KaTeX_Typewriter: [{ url: `${KATEX_CDN}/KaTeX_Typewriter-Regular.woff2`, weight: 'normal', style: 'normal' }]
};

interface Bounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/** Parse the viewport's inline transform to extract pan and zoom */
function parseViewport(viewport: HTMLElement): { panX: number; panY: number; zoom: number } {
	const transform = viewport.style.transform;
	const translateMatch = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
	const scaleMatch = transform.match(/scale\(([^)]+)\)/);
	return {
		panX: translateMatch ? parseFloat(translateMatch[1]) : 0,
		panY: translateMatch ? parseFloat(translateMatch[2]) : 0,
		zoom: scaleMatch ? parseFloat(scaleMatch[1]) : 1
	};
}

/**
 * Calculate content bounds in flow space by converting screen-space
 * getBoundingClientRect positions back to flow coordinates.
 */
function calculateBounds(container: HTMLElement, viewport: HTMLElement): Bounds {
	const { panX, panY, zoom } = parseViewport(viewport);
	const containerRect = container.getBoundingClientRect();
	const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

	function includeRect(rect: DOMRect) {
		if (rect.width === 0 && rect.height === 0) return;
		const flowX = (rect.left - containerRect.left - panX) / zoom;
		const flowY = (rect.top - containerRect.top - panY) / zoom;
		const flowW = rect.width / zoom;
		const flowH = rect.height / zoom;
		bounds.minX = Math.min(bounds.minX, flowX);
		bounds.minY = Math.min(bounds.minY, flowY);
		bounds.maxX = Math.max(bounds.maxX, flowX + flowW);
		bounds.maxY = Math.max(bounds.maxY, flowY + flowH);
	}

	// All SvelteFlow nodes (pathview nodes, events, annotations)
	for (const el of container.querySelectorAll('.svelte-flow__node')) {
		includeRect(el.getBoundingClientRect());
	}

	// Edge connection paths (may extend beyond node bounds)
	for (const el of container.querySelectorAll('.svelte-flow__edge')) {
		includeRect(el.getBoundingClientRect());
	}

	if (!isFinite(bounds.minX)) {
		return { minX: 0, minY: 0, maxX: 200, maxY: 200 };
	}

	return bounds;
}

/**
 * Fix SVG z-order: move edge groups before node groups.
 * SvelteFlow layers nodes above edges via CSS z-index, but SVG uses
 * DOM order for paint order. Find the deepest group containing all
 * content and reorder so edges come first.
 */
function fixEdgeNodeOrder(svg: SVGSVGElement): void {
	// Find the viewport group (deepest group with multiple children)
	let group: Element = svg;
	while (true) {
		const gChildren = Array.from(group.children).filter(c => c.tagName === 'g');
		if (gChildren.length === 1) { group = gChildren[0]; continue; }
		break;
	}

	// Partition children into edge groups and non-edge groups
	const children = Array.from(group.children);
	const edgeGroups: Element[] = [];
	const otherGroups: Element[] = [];

	for (const child of children) {
		const hasEdge = child.querySelector('[aria-label^="Edge from"]');
		if (hasEdge) {
			edgeGroups.push(child);
		} else {
			otherGroups.push(child);
		}
	}

	if (edgeGroups.length === 0) return;

	// Reorder: edges first (painted below), then everything else (painted on top)
	for (const el of [...edgeGroups, ...otherGroups]) {
		group.appendChild(el);
	}
}

export async function exportToSVG(options: ExportOptions = {}): Promise<string> {
	const opts: Required<ExportOptions> = { ...DEFAULT_OPTIONS, ...options };
	const padding = opts.padding;

	const element = document.querySelector('.svelte-flow') as HTMLElement;
	if (!element) throw new Error('SvelteFlow element not found');

	const viewport = element.querySelector('.svelte-flow__viewport') as HTMLElement;
	if (!viewport) throw new Error('SvelteFlow viewport not found');

	// Read surface color before changes
	const surfaceColor = getComputedStyle(element).getPropertyValue('--surface').trim();

	// Calculate content bounds in flow space (works at any zoom level)
	const bounds = calculateBounds(element, viewport);
	const contentWidth = bounds.maxX - bounds.minX;
	const contentHeight = bounds.maxY - bounds.minY;
	const svgWidth = contentWidth + 2 * padding;
	const svgHeight = contentHeight + 2 * padding;

	// Save original inline styles
	const origBg = element.style.backgroundColor;
	const origWidth = element.style.width;
	const origHeight = element.style.height;
	const origMinWidth = element.style.minWidth;
	const origMinHeight = element.style.minHeight;
	const origOverflow = element.style.overflow;

	// Use a <style> element with !important to override Svelte's reactive
	// binding on the viewport transform — inline style alone would be
	// overwritten on the next Svelte tick.
	const styleOverride = document.createElement('style');
	styleOverride.textContent = `.svelte-flow__viewport { transform: translate(${-bounds.minX + padding}px, ${-bounds.minY + padding}px) scale(1) !important; }`;
	document.head.appendChild(styleOverride);

	// Make background transparent and resize container to fit all content
	element.style.backgroundColor = 'transparent';
	element.style.width = `${svgWidth}px`;
	element.style.height = `${svgHeight}px`;
	element.style.minWidth = `${svgWidth}px`;
	element.style.minHeight = `${svgHeight}px`;
	element.style.overflow = 'visible';

	// Wait two frames for layout to settle with new transforms/sizes
	await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

	try {
		const result = await domToSvg(element, {
			background: opts.background === 'solid' ? surfaceColor : undefined,
			padding: 0,
			exclude: EXCLUDE_SELECTORS,
			flattenTransforms: true,
			textToPath: true,
			fonts: EXPORT_FONTS,
			compat: opts.compat
		});

		// Crop SVG to the content area
		result.svg.setAttribute('width', String(svgWidth));
		result.svg.setAttribute('height', String(svgHeight));
		result.svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

		// Fix z-order: SvelteFlow uses CSS z-index to layer nodes above edges,
		// but SVG has no z-index — paint order is DOM order. Move edge groups
		// before node groups so nodes render on top.
		fixEdgeNodeOrder(result.svg);

		return result.toString();
	} finally {
		// Restore everything
		styleOverride.remove();
		element.style.backgroundColor = origBg;
		element.style.width = origWidth;
		element.style.height = origHeight;
		element.style.minWidth = origMinWidth;
		element.style.minHeight = origMinHeight;
		element.style.overflow = origOverflow;
	}
}

export async function exportToPDF(options: ExportOptions = {}): Promise<void> {
	const svgString = await exportToSVG(options);

	// Parse SVG string into a DOM element
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgString, 'image/svg+xml');
	const svgEl = doc.documentElement;

	const width = parseFloat(svgEl.getAttribute('width') || '800');
	const height = parseFloat(svgEl.getAttribute('height') || '600');

	const pdf = new jsPDF({
		orientation: width > height ? 'landscape' : 'portrait',
		unit: 'pt',
		format: [width, height]
	});

	await (pdf as any).svg(svgEl, { x: 0, y: 0, width, height });
	pdf.save('pathview-graph.pdf');
}
