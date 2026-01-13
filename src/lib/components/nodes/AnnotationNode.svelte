<script lang="ts">
	import { onDestroy } from 'svelte';
	import { NodeResizer } from '@xyflow/svelte';
	import { graphStore } from '$lib/stores/graph';
	import { renderMarkdown } from '$lib/utils/markdownRenderer';
	import { getKatexCssUrl } from '$lib/utils/katexLoader';
	import { DEFAULT_NODE_COLOR } from '$lib/utils/colors';
	import ColorPicker from '$lib/components/dialogs/shared/ColorPicker.svelte';
	import type { Annotation } from '$lib/nodes/types';

	interface Props {
		id: string;
		data: Annotation;
		selected?: boolean;
	}

	let { id, data, selected = false }: Props = $props();

	// Read from store (source of truth) instead of SvelteFlow's potentially stale props
	// Initialize from data to avoid flash of empty content (subscription below handles updates)
	// svelte-ignore state_referenced_locally
	let content = $state(data.content || '');
	// svelte-ignore state_referenced_locally
	let color = $state(data.color || DEFAULT_NODE_COLOR);

	// Subscribe to store updates for this annotation
	const unsubscribe = graphStore.annotations.subscribe((annotations) => {
		const annotation = annotations.get(id);
		if (annotation) {
			content = annotation.content || '';
			color = annotation.color || DEFAULT_NODE_COLOR;
		}
	});

	// Cleanup subscription on destroy
	onDestroy(unsubscribe);

	let renderedHtml = $state('');
	let textareaRef = $state<HTMLTextAreaElement | undefined>(undefined);
	let isEditing = $state(false);

	// Render markdown when content changes (debounced slightly for performance)
	$effect(() => {
		if (content) {
			renderMarkdown(content).then(html => {
				renderedHtml = html;
			});
		} else {
			renderedHtml = '';
		}
	});

	// Auto-focus textarea when entering edit mode
	$effect(() => {
		if (isEditing && textareaRef) {
			textareaRef.focus();
			textareaRef.selectionStart = textareaRef.value.length;
		}
	});

	// Exit edit mode when deselected
	$effect(() => {
		if (!selected) {
			isEditing = false;
		}
	});

	function handleInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		graphStore.updateAnnotation(id, { content: value });
	}

	// Handle keyboard in textarea (edit mode only)
	function handleTextareaKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			// Exit edit mode, stay selected
			isEditing = false;
			e.stopPropagation();
			return;
		}
		// Stop propagation to prevent node deletion/other actions while typing
		e.stopPropagation();
	}

	function handleDoubleClick(e: MouseEvent) {
		if (!selected) return;
		// Don't trigger if clicking color picker
		if ((e.target as HTMLElement).closest('.color-picker-wrapper')) return;
		isEditing = true;
	}

	function handleColorSelect(newColor: string | undefined) {
		graphStore.updateAnnotation(id, { color: newColor });
	}

</script>

<svelte:head>
	<link rel="stylesheet" href={getKatexCssUrl()} />
</svelte:head>

<!-- Wrapper to scope CSS variable for resize handles -->
<div class="annotation-wrapper" style="--annotation-color: {color};">
	<NodeResizer
		minWidth={100}
		minHeight={50}
		isVisible={selected}
	/>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="annotation"
		class:selected
		class:editing={isEditing}
		ondblclick={handleDoubleClick}
	>
	{#if selected}
		<!-- Toolbar when selected -->
		<div class="toolbar">
			<ColorPicker
				currentColor={color}
				defaultColor={DEFAULT_NODE_COLOR}
				onSelect={handleColorSelect}
				popupPosition="top"
				iconColor={color}
				iconSize={14}
				variant="ghost"
			/>
		</div>
	{/if}

	{#if isEditing}
		<!-- Edit mode: raw textarea -->
		<textarea
			bind:this={textareaRef}
			value={content}
			oninput={handleInput}
			onkeydown={handleTextareaKeydown}
			placeholder="Markdown with $math$..."
			spellcheck="false"
		></textarea>
	{:else}
		<!-- View mode: rendered content -->
		<div class="rendered">
			{#if content}
				{@html renderedHtml}
			{:else}
				<span class="placeholder">Double-click to add note...</span>
			{/if}
		</div>
	{/if}
</div>
</div>

<style>
	/* Wrapper scopes the CSS variable for resize handles */
	.annotation-wrapper {
		width: 100%;
		height: 100%;
	}

	/* Style NodeResizer handles and lines to match annotation color */
	.annotation-wrapper :global(.svelte-flow__resize-control.handle) {
		background: var(--annotation-color) !important;
		border: 1px solid var(--annotation-color) !important;
	}

	.annotation-wrapper :global(.svelte-flow__resize-control.line) {
		border-color: var(--annotation-color) !important;
	}

	.annotation {
		width: 100%;
		height: 100%;
		background: transparent;
		border: none;
		overflow: visible;
		position: relative;
		cursor: default;
	}


	/* Toolbar */
	.toolbar {
		position: absolute;
		top: -20px;
		left: 0;
		display: flex;
		align-items: center;
		gap: 4px;
		z-index: 10;
	}

	/* Textarea */
	textarea {
		width: 100%;
		height: 100%;
		background: transparent;
		border: none;
		resize: none;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.5;
		color: var(--annotation-color);
		outline: none;
		padding: 8px;
		box-sizing: border-box;
	}

	textarea::placeholder {
		color: var(--annotation-color);
		opacity: 0.6;
	}

	/* Rendered content */
	.rendered {
		width: 100%;
		height: 100%;
		padding: 8px;
		box-sizing: border-box;
		font-size: 11px;
		line-height: 1.5;
		color: var(--annotation-color);
		overflow: auto;
	}

	.rendered :global(h1) {
		font-size: 14px;
		font-weight: 600;
		margin: 0 0 6px;
		color: var(--annotation-color);
	}

	.rendered :global(h2) {
		font-size: 12px;
		font-weight: 600;
		margin: 0 0 4px;
		color: var(--annotation-color);
	}

	.rendered :global(h3) {
		font-size: 11px;
		font-weight: 600;
		margin: 0 0 3px;
		color: var(--annotation-color);
	}

	.rendered :global(p) {
		margin: 0 0 8px;
	}

	.rendered :global(p:last-child) {
		margin-bottom: 0;
	}

	.rendered :global(ul),
	.rendered :global(ol) {
		margin: 0 0 8px;
		padding-left: 20px;
	}

	.rendered :global(li) {
		margin: 2px 0;
	}

	.rendered :global(blockquote) {
		margin: 0 0 8px;
		padding: 4px 12px;
		border-left: 3px solid var(--annotation-color);
		opacity: 0.8;
	}

	.rendered :global(hr) {
		border: none;
		border-top: 1px solid var(--annotation-color);
		margin: 8px 0;
		opacity: 0.5;
	}

	.rendered :global(pre) {
		background: var(--surface-raised);
		padding: 8px;
		border-radius: var(--radius-sm);
		margin: 0 0 8px;
		overflow-x: auto;
	}

	.rendered :global(pre code) {
		background: transparent;
		padding: 0;
	}

	.rendered :global(code) {
		background: var(--surface-raised);
		padding: 1px 4px;
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 0.9em;
	}

	.rendered :global(strong) {
		font-weight: 600;
	}

	.rendered :global(a) {
		color: var(--accent);
		text-decoration: none;
	}

	.rendered :global(a:hover) {
		text-decoration: underline;
	}

	.rendered :global(.katex) {
		font-size: 1em;
	}

	.rendered :global(.katex-display) {
		margin: 8px 0;
		text-align: center;
	}

	.placeholder {
		color: var(--annotation-color);
		opacity: 0.6;
		font-style: italic;
	}
</style>
