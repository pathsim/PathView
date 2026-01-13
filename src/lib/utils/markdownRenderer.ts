/**
 * Markdown renderer with KaTeX math support
 * Used for canvas annotations
 */

import { loadKatex } from './katexLoader';

/**
 * Render markdown with LaTeX math to HTML
 * Supports: headers, bold, italic, code, links, and $...$ / $$...$$ math
 */
export async function renderMarkdown(content: string): Promise<string> {
	if (!content?.trim()) return '';

	const k = await loadKatex();
	const mathBlocks: string[] = [];

	// Step 1: Extract and render math (preserve placeholders)
	// Display math: $$...$$
	let processed = content.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => {
		const placeholder = `%%MATH_BLOCK_${mathBlocks.length}%%`;
		try {
			mathBlocks.push(k.default.renderToString(latex.trim(), {
				displayMode: true,
				throwOnError: false,
				strict: false
			}));
		} catch {
			mathBlocks.push(`<code class="math-error">${escapeHtml(latex)}</code>`);
		}
		return placeholder;
	});

	// Inline math: $...$  (but not $$ which was already handled)
	processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, latex) => {
		const placeholder = `%%MATH_BLOCK_${mathBlocks.length}%%`;
		try {
			mathBlocks.push(k.default.renderToString(latex.trim(), {
				displayMode: false,
				throwOnError: false,
				strict: false
			}));
		} catch {
			mathBlocks.push(`<code class="math-error">${escapeHtml(latex)}</code>`);
		}
		return placeholder;
	});

	// Step 2: Render markdown
	processed = renderBasicMarkdown(processed);

	// Step 3: Restore math blocks
	mathBlocks.forEach((html, i) => {
		processed = processed.replace(`%%MATH_BLOCK_${i}%%`, html);
	});

	return processed;
}

/**
 * Simple markdown to HTML conversion
 */
function renderBasicMarkdown(text: string): string {
	// Escape HTML first (except for our placeholders)
	let result = text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	// Restore placeholders
	result = result.replace(/%%MATH_BLOCK_(\d+)%%/g, '%%MATH_BLOCK_$1%%');

	// Code blocks (``` ... ```) - must be before other processing
	result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
		return `<pre><code>${code.trim()}</code></pre>`;
	});

	// Headers (must be at start of line)
	result = result.replace(/^### (.*)$/gm, '<h3>$1</h3>');
	result = result.replace(/^## (.*)$/gm, '<h2>$1</h2>');
	result = result.replace(/^# (.*)$/gm, '<h1>$1</h1>');

	// Horizontal rules (---, ***, ___)
	result = result.replace(/^([-*_]){3,}\s*$/gm, '<hr>');

	// Blockquotes (> text)
	result = result.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
	// Merge consecutive blockquotes
	result = result.replace(/<\/blockquote>\n<blockquote>/g, '\n');

	// Unordered lists (- item or * item)
	result = result.replace(/^[-*] (.*)$/gm, '<li>$1</li>');
	// Wrap consecutive <li> in <ul>
	result = result.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

	// Ordered lists (1. item)
	result = result.replace(/^\d+\. (.*)$/gm, '<oli>$1</oli>');
	// Wrap consecutive <oli> in <ol> and convert back to <li>
	result = result.replace(/((?:<oli>.*<\/oli>\n?)+)/g, (match) => {
		return '<ol>' + match.replace(/<\/?oli>/g, (tag) => tag.replace('oli', 'li')) + '</ol>';
	});

	// Bold and italic (order matters - bold first)
	result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
	result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	// Only match *text* if not part of a list marker we already processed
	result = result.replace(/(?<![<])\*([^*\n]+?)\*(?![>])/g, '<em>$1</em>');

	// Inline code
	result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

	// Links
	result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

	// Line breaks: double newline = paragraph break, single = <br>
	result = result
		.split(/\n\n+/)
		.map(para => para.trim())
		.filter(para => para.length > 0)
		.map(para => {
			// Don't wrap block elements in paragraphs
			if (/^<(h[1-6]|ul|ol|blockquote|pre|hr)/.test(para)) return para;
			return `<p>${para.replace(/\n/g, '<br>')}</p>`;
		})
		.join('');

	return result;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
