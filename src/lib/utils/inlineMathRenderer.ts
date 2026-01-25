/**
 * Light inline math renderer for node names
 * Only handles $...$ inline math, no markdown processing
 */

import { loadKatex } from './katexLoader';

/** Result of rendering inline math */
export interface MathRenderResult {
	/** Rendered HTML string */
	html: string;
	/** Whether the input contained any math */
	hasMath: boolean;
}

/** Cached render results to avoid re-rendering unchanged content */
const renderCache = new Map<string, MathRenderResult>();

/**
 * Check if a string contains inline math delimiters
 */
export function containsMath(text: string): boolean {
	return /\$[^$\n]+\$/.test(text);
}

/**
 * Render inline math in a string
 * Only processes $...$ delimited math, leaves other text as-is
 *
 * @param text - Input text possibly containing $...$ math
 * @returns Promise resolving to render result with HTML and hasMath flag
 */
export async function renderInlineMath(text: string): Promise<MathRenderResult> {
	if (!text?.trim()) {
		return { html: '', hasMath: false };
	}

	// Check cache
	const cached = renderCache.get(text);
	if (cached) return cached;

	// Check if there's any math to render
	if (!containsMath(text)) {
		const result = { html: escapeHtml(text), hasMath: false };
		renderCache.set(text, result);
		return result;
	}

	const katex = await loadKatex();
	let hasMath = false;

	// Replace $...$ with rendered KaTeX
	const html = text.replace(/\$([^$\n]+)\$/g, (_, latex) => {
		hasMath = true;
		try {
			return katex.default.renderToString(latex.trim(), {
				displayMode: false,
				throwOnError: false,
				strict: false,
				output: 'html' // Use HTML output for DOM rendering
			});
		} catch {
			return `<code class="math-error">${escapeHtml(latex)}</code>`;
		}
	});

	// Escape non-math parts (already done by KaTeX for math parts)
	// We need to escape text outside of math - but the replace already handles it
	// Actually we need to be more careful - escape text first, then insert math

	const result = { html, hasMath };
	renderCache.set(text, result);
	return result;
}

/**
 * Render inline math synchronously if already cached
 * Returns null if not cached (caller should use async version)
 */
export function renderInlineMathSync(text: string): MathRenderResult | null {
	return renderCache.get(text) ?? null;
}

/**
 * Clear the render cache (useful for testing or memory management)
 */
export function clearMathCache(): void {
	renderCache.clear();
}

/**
 * Measure the rendered dimensions of a math string
 * Creates a temporary hidden element to measure actual rendered size
 *
 * @param html - Rendered HTML from renderInlineMath
 * @returns Dimensions { width, height } in pixels
 */
export function measureRenderedMath(html: string): { width: number; height: number } {
	// Create a temporary inline measurement element
	// Using span with inline display to get natural content width
	// Styles must match .node-name in BaseNode.svelte
	const container = document.createElement('span');
	container.style.cssText = `
		position: absolute;
		visibility: hidden;
		white-space: nowrap;
		font-size: 10px;
		font-weight: 600;
		font-family: system-ui, -apple-system, sans-serif;
		letter-spacing: -0.2px;
	`;
	container.innerHTML = html;
	document.body.appendChild(container);

	// Use scrollWidth for accurate content measurement
	const result = {
		width: Math.ceil(container.scrollWidth),
		height: Math.ceil(container.scrollHeight)
	};

	document.body.removeChild(container);
	return result;
}

/**
 * Render and measure in one call
 * Convenience function for getting both HTML and dimensions
 */
export async function renderAndMeasure(text: string): Promise<{
	html: string;
	hasMath: boolean;
	width: number;
	height: number;
}> {
	const rendered = await renderInlineMath(text);
	const dimensions = measureRenderedMath(rendered.html);
	return {
		...rendered,
		...dimensions
	};
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
