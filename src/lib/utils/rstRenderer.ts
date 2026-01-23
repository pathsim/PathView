/**
 * Docstring renderer - processes HTML from docutils and renders math with KaTeX
 * Also transforms definition lists to tables and applies CodeMirror to code blocks.
 *
 * The RST is converted to HTML by Python's docutils in the Pyodide worker.
 * This module applies KaTeX to math elements, transforms definition lists to
 * parameter tables, and optionally renders code blocks with CodeMirror.
 */

import { loadKatex } from './katexLoader';
import { loadCodeMirrorModules, createEditorExtensions, type CodeMirrorModules } from './codemirror';

// Track CodeMirror editor instances for cleanup
let editorViews: import('@codemirror/view').EditorView[] = [];
let codeBlocks: { wrapper: HTMLElement; code: string }[] = [];
let cmModules: CodeMirrorModules | null = null;

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

/**
 * Transform docutils definition lists (<dl class="docutils">) to styled parameter tables.
 * This makes Parameters, Returns, Attributes sections look much better.
 */
export function transformDefinitionListsToTables(container: HTMLElement): void {
	const dlElements = container.querySelectorAll('dl.docutils');

	for (const dl of dlElements) {
		// Skip if already transformed
		if (dl.classList.contains('table-transformed')) continue;

		// Create wrapper for panel styling
		const wrapper = document.createElement('div');
		wrapper.className = 'param-table-wrapper';

		const table = document.createElement('table');
		table.className = 'param-table';

		// Add header row
		const thead = document.createElement('thead');
		const headerRow = document.createElement('tr');
		['Name', 'Type', 'Description'].forEach(text => {
			const th = document.createElement('th');
			th.textContent = text;
			headerRow.appendChild(th);
		});
		thead.appendChild(headerRow);
		table.appendChild(thead);

		const tbody = document.createElement('tbody');

		// Get all dt/dd pairs
		const dts = dl.querySelectorAll(':scope > dt');

		for (const dt of dts) {
			const row = document.createElement('tr');

			// Extract name (text before classifier-delimiter)
			const nameCell = document.createElement('td');
			nameCell.className = 'param-name';
			const nameCode = document.createElement('code');

			// Get the name - it's the first text node or text before classifier-delimiter
			let name = '';
			for (const node of dt.childNodes) {
				if (node.nodeType === Node.TEXT_NODE) {
					name = node.textContent?.trim() || '';
					if (name) break;
				} else if (node.nodeType === Node.ELEMENT_NODE) {
					const el = node as Element;
					if (el.classList.contains('classifier-delimiter')) break;
					name = el.textContent?.trim() || '';
					if (name) break;
				}
			}
			nameCode.textContent = name;
			nameCell.appendChild(nameCode);
			row.appendChild(nameCell);

			// Extract type from classifier span
			const typeCell = document.createElement('td');
			typeCell.className = 'param-type';
			const classifier = dt.querySelector('.classifier');
			if (classifier) {
				const typeCode = document.createElement('code');
				typeCode.textContent = classifier.textContent || '';
				typeCell.appendChild(typeCode);
			}
			row.appendChild(typeCell);

			// Get description from following dd
			const descCell = document.createElement('td');
			descCell.className = 'param-desc';
			const dd = dt.nextElementSibling;
			if (dd && dd.tagName === 'DD') {
				descCell.innerHTML = dd.innerHTML;
			}
			row.appendChild(descCell);

			tbody.appendChild(row);
		}

		table.appendChild(tbody);
		wrapper.appendChild(table);

		// Replace dl with wrapped table
		dl.parentNode?.replaceChild(wrapper, dl);
	}
}

/**
 * Detect language from code content
 */
function detectLanguage(code: string): 'python' | 'console' {
	// Check for Python REPL prompts
	if (code.includes('>>>') || code.includes('...')) {
		return 'console';
	}
	return 'python';
}

/**
 * Create a copy button for code blocks
 */
function createCopyButton(code: string): HTMLButtonElement {
	const button = document.createElement('button');
	button.className = 'copy-btn';
	button.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
	button.title = 'Copy code';

	button.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(code);
			button.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
			setTimeout(() => {
				button.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
			}, 2000);
		} catch (e) {
			console.error('Failed to copy:', e);
		}
	});

	return button;
}

/**
 * Render code blocks with CodeMirror syntax highlighting.
 * Call this after the HTML is inserted into the DOM.
 */
export async function renderCodeBlocks(container: HTMLElement): Promise<void> {
	// Clean up existing editors
	cleanupCodeBlocks();

	cmModules = await loadCodeMirrorModules();
	const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

	// Find all pre elements that contain code
	const preElements = container.querySelectorAll('pre');

	for (const preEl of preElements) {
		// Skip if already processed
		if (preEl.classList.contains('cm-processed')) continue;

		// Get code content - either from nested code element or directly from pre
		const codeEl = preEl.querySelector('code');
		const code = codeEl ? codeEl.textContent : preEl.textContent;
		if (!code?.trim()) continue;

		// Mark as processed
		preEl.classList.add('cm-processed');

		const trimmedCode = code.trim();
		const language = detectLanguage(trimmedCode);

		// Create wrapper div
		const wrapper = document.createElement('div');
		wrapper.className = 'code-block-wrapper';

		// Create header
		const header = document.createElement('div');
		header.className = 'code-block-header';

		const label = document.createElement('span');
		label.className = 'code-label';
		label.textContent = language === 'console' ? 'CONSOLE' : 'PYTHON';
		header.appendChild(label);

		header.appendChild(createCopyButton(trimmedCode));
		wrapper.appendChild(header);

		// Create editor container
		const editorDiv = document.createElement('div');
		editorDiv.className = 'cm-container';
		wrapper.appendChild(editorDiv);

		// Replace pre with wrapper
		preEl.parentNode?.replaceChild(wrapper, preEl);

		// Store code and wrapper for theme switching
		codeBlocks.push({ wrapper, code: trimmedCode });

		// Create CodeMirror editor
		const view = new cmModules.EditorView({
			doc: trimmedCode,
			extensions: createEditorExtensions(cmModules, isDark, { readOnly: true }),
			parent: editorDiv
		});

		editorViews.push(view);
	}
}

/**
 * Update code block themes (call when theme changes)
 */
export async function updateCodeBlockTheme(): Promise<void> {
	if (!cmModules || codeBlocks.length === 0) return;

	const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

	// Destroy old editors
	for (const view of editorViews) {
		view.destroy();
	}
	editorViews = [];

	// Recreate editors with new theme
	for (const { wrapper, code } of codeBlocks) {
		const editorDiv = wrapper.querySelector('.cm-container');
		if (!editorDiv) continue;

		// Clear old editor content
		editorDiv.innerHTML = '';

		// Create new editor with updated theme
		const view = new cmModules.EditorView({
			doc: code,
			extensions: createEditorExtensions(cmModules, isDark, { readOnly: true }),
			parent: editorDiv as HTMLElement
		});

		editorViews.push(view);
	}
}

/**
 * Clean up CodeMirror editors (call on component destroy)
 */
export function cleanupCodeBlocks(): void {
	for (const view of editorViews) {
		view.destroy();
	}
	editorViews = [];
	codeBlocks = [];
}

// Re-export for convenience
export { getKatexCssUrl } from './katexLoader';
