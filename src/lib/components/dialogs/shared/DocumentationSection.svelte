<script lang="ts">
	import { slide } from 'svelte/transition';
	import { renderDocstring, getKatexCssUrl } from '$lib/utils/rstRenderer';
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

	// Reset state when docstring changes
	$effect(() => {
		// Track both props
		const _ = docstring || docstringHtml;
		if (_) {
			// Reset when content changes
			renderedDocs = '';
			expanded = false;
		}
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
			<div class="docs-content" transition:slide={{ duration: 200 }}>
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
		margin: 0 0 1em 0;
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
		font-size: 12px;
	}

	.docs-content :global(tt),
	.docs-content :global(code),
	.docs-content :global(.literal) {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-muted);
	}

	.docs-content :global(pre),
	.docs-content :global(.literal-block) {
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: var(--space-sm);
		margin: 1em 0;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.5;
	}

	.docs-content :global(pre code),
	.docs-content :global(.literal-block code) {
		background: none;
		padding: 0;
		font-size: inherit;
		color: var(--text-muted);
	}

	/* Math blocks from docutils - no special background */
	.docs-content :global(.math),
	.docs-content :global(div.math) {
		margin: 1em 0;
		overflow-x: auto;
		text-align: center;
	}

	/* Definition lists (Parameters, Returns, etc.) */
	.docs-content :global(dl) {
		margin: 0.5em 0;
	}

	.docs-content :global(dt) {
		font-weight: 600;
		margin-top: 1em;
	}

	.docs-content :global(dd) {
		margin-left: 1.5em;
		margin-top: 0.25em;
	}

	/* Field lists */
	.docs-content :global(.field-list) {
		margin: 1em 0;
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
		margin: 1em 0;
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

</style>
