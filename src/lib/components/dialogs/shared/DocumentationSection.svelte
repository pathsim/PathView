<script lang="ts">
	import { slide } from 'svelte/transition';
	import { onDestroy } from 'svelte';
	import {
		renderDocstring,
		transformDefinitionListsToTables,
		renderCodeBlocks,
		updateCodeBlockTheme,
		cleanupCodeBlocks,
		getKatexCssUrl
	} from '$lib/utils/rstRenderer';
	import { themeStore } from '$lib/stores/theme';
	import Icon from '$lib/components/icons/Icon.svelte';

	interface Props {
		// Raw docstring (needs rendering)
		docstring?: string | undefined;
		// Pre-rendered HTML (display directly)
		docstringHtml?: string | undefined;
	}

	let { docstring, docstringHtml }: Props = $props();

	let expanded = $state(false);
	let renderedDocs = $state<string>('');
	let loading = $state(false);
	let container: HTMLDivElement | undefined = $state();

	// Check if we have any documentation to show
	const hasDocumentation = $derived(!!docstring || !!docstringHtml);

	async function toggle() {
		expanded = !expanded;

		// Load and render if expanding and not already loaded
		if (expanded && !renderedDocs) {
			const html = docstringHtml || docstring;
			if (!html) return;

			loading = true;
			try {
				// renderDocstring handles both raw docstrings and pre-rendered HTML
				// It applies KaTeX rendering to any .math elements
				renderedDocs = await renderDocstring(html);
			} catch (e) {
				console.error('Failed to render docstring:', e);
				renderedDocs = '<p class="docs-error">Failed to render documentation.</p>';
			}
			loading = false;
		}
	}

	// Apply DOM transformations after rendered HTML is inserted
	$effect(() => {
		if (renderedDocs && container && !loading) {
			// Use tick-like delay to ensure DOM is updated
			requestAnimationFrame(async () => {
				if (!container) return;
				transformDefinitionListsToTables(container);
				await renderCodeBlocks(container);
			});
		}
	});

	// Update code block theme when theme changes
	themeStore.subscribe(() => {
		if (expanded && container) {
			updateCodeBlockTheme();
		}
	});

	// Reset state when docstring changes
	$effect(() => {
		// Track both props
		const _ = docstring || docstringHtml;
		if (_) {
			// Reset when content changes
			cleanupCodeBlocks();
			renderedDocs = '';
			expanded = false;
		}
	});

	// Cleanup on destroy
	onDestroy(() => {
		cleanupCodeBlocks();
	});
</script>

<svelte:head>
	<link rel="stylesheet" href={getKatexCssUrl()} />
</svelte:head>

{#if hasDocumentation}
	<div class="docs-section">
		<button class="docs-toggle" onclick={toggle}>
			<span class="toggle-icon" class:expanded>
				<Icon name="chevron-right" size={12} />
			</span>
			Documentation
		</button>
		{#if expanded}
			<div class="docs-content" transition:slide={{ duration: 200 }} bind:this={container}>
				{#if loading}
					<div class="docs-loading">Loading documentation...</div>
				{:else}
					{@html renderedDocs}
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.docs-section {
		border-top: 1px solid var(--border);
		padding-top: var(--space-md);
		margin-top: var(--space-md);
		margin-left: calc(-1 * var(--space-md));
		margin-right: calc(-1 * var(--space-md));
		padding-left: var(--space-md);
		padding-right: var(--space-md);
	}

	.docs-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		background: none;
		border: none;
		padding: 0;
		font-size: 10px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		cursor: pointer;
		text-align: left;
	}

	.docs-toggle:hover {
		color: var(--text);
	}

	.toggle-icon {
		display: flex;
		transition: transform var(--transition-fast);
		flex-shrink: 0;
	}

	.toggle-icon.expanded {
		transform: rotate(90deg);
	}

	.docs-content {
		margin-top: var(--space-md);
		font-size: 11px;
		line-height: 1.6;
		color: var(--text-muted);
	}

	.docs-loading {
		color: var(--text-muted);
		font-style: italic;
	}

	/* Docutils HTML output styles */
	.docs-content :global(p) {
		margin: 0 0 0.75em 0;
	}

	.docs-content :global(p:last-child) {
		margin-bottom: 0;
	}

	.docs-content :global(h1),
	.docs-content :global(h2),
	.docs-content :global(h3),
	.docs-content :global(h4),
	.docs-content :global(h5) {
		font-weight: 600;
		color: var(--text-muted);
		margin: 1.5em 0 0.5em 0;
	}

	.docs-content :global(h4) {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Inline code */
	.docs-content :global(tt),
	.docs-content :global(code),
	.docs-content :global(.literal) {
		font-family: var(--font-mono);
		font-size: 10px;
		background: var(--surface-raised);
		padding: 1px 4px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		color: var(--text-muted);
	}

	/* Don't style code inside CodeMirror or tables */
	.docs-content :global(.cm-content code),
	.docs-content :global(.param-name code),
	.docs-content :global(.param-type code) {
		background: none;
		padding: 0;
		border: none;
		border-radius: 0;
	}

	/* Code block wrapper with header */
	.docs-content :global(.code-block-wrapper) {
		margin: 0.75em 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	/* Hide header in docs code blocks - no copy button or label needed */
	.docs-content :global(.code-block-header) {
		display: none;
	}

	.docs-content :global(.cm-container) {
		font-size: 11px;
		line-height: 1.4;
	}

	/* CodeMirror overrides for compact display */
	.docs-content :global(.cm-editor) {
		background: var(--surface);
		font-size: 11px !important;
	}

	.docs-content :global(.cm-scroller),
	.docs-content :global(.cm-content),
	.docs-content :global(.cm-line) {
		font-size: 11px !important;
	}

	/* Hide line numbers in docs code blocks */
	.docs-content :global(.cm-gutters) {
		display: none;
	}

	/* Fallback pre/code styles (before CodeMirror processes) */
	.docs-content :global(pre:not(.cm-processed)),
	.docs-content :global(.literal-block) {
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: var(--space-sm);
		margin: 0.75em 0;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.5;
	}

	.docs-content :global(pre:not(.cm-processed) code),
	.docs-content :global(.literal-block code) {
		background: none;
		padding: 0;
		font-size: inherit;
		color: var(--text-muted);
		border: none;
	}

	/* Parameter tables (transformed from definition lists) */
	.docs-content :global(.param-table-wrapper) {
		margin: 0.75em 0;
		overflow-x: auto;
	}

	.docs-content :global(.param-table) {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 10px;
		table-layout: auto;
	}

	/* Header styled like panel-header */
	.docs-content :global(.param-table thead th) {
		padding: var(--space-xs) var(--space-sm);
		background: var(--surface-raised);
		font-size: 9px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		text-align: left;
		border: 1px solid var(--border);
		border-right: none;
	}

	.docs-content :global(.param-table thead th:last-child) {
		border-right: 1px solid var(--border);
		border-top-right-radius: var(--radius-md);
	}

	.docs-content :global(.param-table thead th:first-child) {
		border-top-left-radius: var(--radius-md);
	}

	.docs-content :global(.param-table td) {
		padding: var(--space-xs) var(--space-sm);
		background: var(--surface);
		vertical-align: top;
		border-left: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.docs-content :global(.param-table td:last-child) {
		border-right: 1px solid var(--border);
	}

	/* Rounded corners on last row */
	.docs-content :global(.param-table tbody tr:last-child td:first-child) {
		border-bottom-left-radius: var(--radius-md);
	}

	.docs-content :global(.param-table tbody tr:last-child td:last-child) {
		border-bottom-right-radius: var(--radius-md);
	}

	.docs-content :global(.param-table .param-name) {
		white-space: nowrap;
	}

	.docs-content :global(.param-table .param-name code) {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		color: var(--node-color, var(--accent));
	}

	.docs-content :global(.param-table .param-type) {
		word-break: break-word;
	}

	.docs-content :global(.param-table .param-type code) {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-muted);
		word-break: break-word;
	}

	.docs-content :global(.param-table .param-desc) {
		color: var(--text-muted);
		line-height: 1.5;
	}

	/* RST sections */
	.docs-content :global(.section) {
		margin-top: var(--space-sm);
	}

	.docs-content :global(.section:first-child) {
		margin-top: 0;
	}

	/* Section headers (h3, h4 inside .section) - match .section-title style */
	.docs-content :global(.section h3),
	.docs-content :global(.section h4) {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin: 0 0 var(--space-xs) 0;
	}

	/* Math blocks from docutils */
	.docs-content :global(.math),
	.docs-content :global(div.math) {
		margin: 0.5em 0;
		text-align: center;
	}

	/* KaTeX styling */
	.docs-content :global(.katex) {
		font-size: 1.3em;
	}

	.docs-content :global(.katex-display) {
		margin: 0.5em 0;
	}

	/* Generic definition lists (fallback if not transformed) */
	.docs-content :global(dl:not(.docutils)) {
		margin: 0.5em 0;
	}

	.docs-content :global(dl:not(.docutils) dt) {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--accent);
		margin-top: 0.75em;
		font-weight: 500;
	}

	.docs-content :global(dl:not(.docutils) dd) {
		margin-left: var(--space-md);
		color: var(--text-muted);
		margin-top: var(--space-xs);
	}

	/* Field lists */
	.docs-content :global(.field-list) {
		margin: 0.75em 0;
	}

	.docs-content :global(.field-name) {
		font-weight: 600;
	}

	.docs-content :global(.field-body) {
		margin-left: 0.5em;
	}

	/* Docutils admonitions */
	.docs-content :global(.note),
	.docs-content :global(.warning),
	.docs-content :global(.tip),
	.docs-content :global(.admonition) {
		margin: 0.75em 0;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		border-left: 3px solid var(--accent);
	}

	.docs-content :global(.warning) {
		border-left-color: var(--warning);
	}

	.docs-content :global(.admonition-title) {
		font-weight: 600;
		margin-bottom: 0.5em;
	}

	.docs-content :global(.no-docs) {
		color: var(--text-muted);
		font-style: italic;
	}

	/* Lists */
	.docs-content :global(ul),
	.docs-content :global(ol) {
		margin: 0.5em 0;
		padding-left: 1.5em;
	}

	.docs-content :global(li) {
		margin: 0.25em 0;
	}

	/* Hyperlinks */
	.docs-content :global(a) {
		color: var(--accent);
		text-decoration: none;
	}

	.docs-content :global(a:hover) {
		color: var(--accent-hover);
		text-decoration: underline;
	}

	/* Tables */
	.docs-content :global(table:not(.param-table)) {
		width: 100%;
		border-collapse: collapse;
		margin: 0.75em 0;
		font-size: 10px;
	}

	.docs-content :global(table:not(.param-table) th),
	.docs-content :global(table:not(.param-table) td) {
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--border);
		text-align: left;
	}

	.docs-content :global(table:not(.param-table) th) {
		background: var(--surface-raised);
		font-weight: 600;
		color: var(--text-muted);
	}

	/* Strong text */
	.docs-content :global(strong) {
		font-weight: 600;
	}

	/* Blockquote */
	.docs-content :global(blockquote) {
		margin: 0.75em 0;
		padding-left: var(--space-md);
		border-left: 3px solid var(--accent);
		color: var(--text-muted);
	}
</style>
