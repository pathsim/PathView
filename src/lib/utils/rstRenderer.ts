/**
 * Docstring renderer - processes HTML from docutils and renders math with KaTeX
 *
 * The RST is converted to HTML by Python's docutils in the Pyodide worker.
 * This module just applies KaTeX to any math elements and provides styling.
 */

import { loadKatex } from './katexLoader';

/**
 * Process HTML from docutils and render math with KaTeX
 */
export async function renderDocstring(html: string): Promise<string> {
	if (!html?.trim()) {
		return '<p class="no-docs">No documentation available.</p>';
	}

	// Load KaTeX
	const k = await loadKatex();

	// Create a temporary div to parse the HTML
	const temp = document.createElement('div');
	temp.innerHTML = html;

	// Find all math elements - docutils outputs math in <span class="math"> or <div class="math">
	const mathElements = temp.querySelectorAll('.math');

	for (const el of mathElements) {
		const latex = el.textContent || '';
		if (!latex.trim()) continue;

		try {
			// Clean up the LaTeX
			let cleaned = latex
				.replace(/^\\\(|\\\)$/g, '')  // Remove \( \) delimiters
				.replace(/^\\\[|\\\]$/g, '')  // Remove \[ \] delimiters
				.trim();

			// Convert unsupported environments
			cleaned = cleaned
				.replace(/\\begin\{eqnarray\*?\}/g, '\\begin{aligned}')
				.replace(/\\end\{eqnarray\*?\}/g, '\\end{aligned}');

			// Wrap multi-line equations in aligned environment if not already wrapped
			if (cleaned.includes('\\\\') && !cleaned.includes('\\begin{')) {
				cleaned = `\\begin{aligned}${cleaned}\\end{aligned}`;
			}

			const isDisplay = el.tagName === 'DIV' || latex.includes('\\[');

			const rendered = k.default.renderToString(cleaned, {
				displayMode: isDisplay,
				throwOnError: false,
				strict: false
			});

			el.innerHTML = rendered;
			el.classList.add('katex-rendered');
		} catch (e) {
			console.warn('KaTeX error for:', latex, e);
			// Leave original content
		}
	}

	return temp.innerHTML;
}

// Re-export for convenience
export { getKatexCssUrl } from './katexLoader';
