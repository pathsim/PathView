<script lang="ts">
	import { onDestroy } from 'svelte';
	import { NodeResizer } from '@xyflow/svelte';
	import { graphStore, ANNOTATION_FONT_SIZE } from '$lib/stores/graph';
	import { editAnnotationTrigger } from '$lib/stores/viewActions';
	import { renderMarkdown } from '$lib/utils/markdownRenderer';
	import { getKatexCssUrl } from '$lib/utils/katexLoader';
	import { DEFAULT_NODE_COLOR } from '$lib/utils/colors';
	import { GRID_SIZE } from '$lib/constants/grid';
	import { tooltip } from '$lib/components/Tooltip.svelte';
	import ColorPicker from '$lib/components/dialogs/shared/ColorPicker.svelte';
	import Icon from '$lib/components/icons/Icon.svelte';
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
	// svelte-ignore state_referenced_locally
	let fontSize = $state(data.fontSize || ANNOTATION_FONT_SIZE.DEFAULT);

	// Subscribe to store updates for this annotation
	const unsubscribe = graphStore.annotations.subscribe((annotations) => {
		const annotation = annotations.get(id);
		if (annotation) {
			content = annotation.content || '';
			color = annotation.color || DEFAULT_NODE_COLOR;
			fontSize = annotation.fontSize || ANNOTATION_FONT_SIZE.DEFAULT;
		}
	});

	// Subscribe to edit trigger from context menu
	let lastEditTriggerId = 0;
	const unsubscribeEdit = editAnnotationTrigger.subscribe((trigger) => {
		if (trigger.id > lastEditTriggerId && trigger.annotationId === id) {
			lastEditTriggerId = trigger.id;
			isEditing = true;
		}
	});

	// Cleanup subscriptions on destroy
	onDestroy(() => {
		unsubscribe();
		unsubscribeEdit();
	});

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

	function increaseFontSize() {
		const newSize = Math.min(fontSize + ANNOTATION_FONT_SIZE.STEP, ANNOTATION_FONT_SIZE.MAX);
		graphStore.updateAnnotation(id, { fontSize: newSize });
	}

	function decreaseFontSize() {
		const newSize = Math.max(fontSize - ANNOTATION_FONT_SIZE.STEP, ANNOTATION_FONT_SIZE.MIN);
		graphStore.updateAnnotation(id, { fontSize: newSize });
	}

	function handleWheel(e: WheelEvent) {
		const target = e.currentTarget as HTMLElement;
		// Only stop propagation if element has scrollable content
		if (target.scrollHeight > target.clientHeight) {
			e.stopPropagation();
		}
	}

	// Snap resize dimensions to grid
	function handleResizeEnd(_event: unknown, params: { width: number; height: number }) {
		const snappedWidth = Math.round(params.width / GRID_SIZE) * GRID_SIZE;
		const snappedHeight = Math.round(params.height / GRID_SIZE) * GRID_SIZE;
		graphStore.updateAnnotation(id, {
			width: Math.max(100, snappedWidth),
			height: Math.max(50, snappedHeight)
		});
	}
</script>

<svelte:head>
	<link rel="stylesheet" href={getKatexCssUrl()} />
</svelte:head>

<!-- Wrapper to scope CSS variable for resize handles -->
<div class="annotation-wrapper" class:nodrag={isEditing} style="--annotation-color: {color}; --annotation-font-size: {fontSize}px;">
	<NodeResizer
		minWidth={100}
		minHeight={50}
		isVisible={selected}
		onResizeEnd={handleResizeEnd}
	/>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="annotation"
		ondblclick={handleDoubleClick}
	>
	{#if selected}
		<!-- Toolbar when selected -->
		<div class="toolbar">
			<button
				class="toolbar-btn"
				onclick={increaseFontSize}
				disabled={fontSize >= ANNOTATION_FONT_SIZE.MAX}
				use:tooltip={{ text: 'Increase font size', position: 'top' }}
			>
				<Icon name="font-size-increase" size={14} />
			</button>
			<button
				class="toolbar-btn"
				onclick={decreaseFontSize}
				disabled={fontSize <= ANNOTATION_FONT_SIZE.MIN}
				use:tooltip={{ text: 'Decrease font size', position: 'top' }}
			>
				<Icon name="font-size-decrease" size={14} />
			</button>
			<ColorPicker
				currentColor={color}
				defaultColor={DEFAULT_NODE_COLOR}
				onSelect={handleColorSelect}
				popupPosition="top"
				tooltipPosition="top"
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
			onwheel={handleWheel}
			placeholder="Markdown with $math$..."
			spellcheck="false"
		></textarea>
	{:else}
		<!-- View mode: rendered content -->
		<div class="rendered" onwheel={handleWheel}>
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
		top: -26px;
		left: 0;
		display: flex;
		align-items: center;
		gap: 1px;
		z-index: 10;
	}

	/* Toolbar buttons */
	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--annotation-color);
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.toolbar-btn:hover:not(:disabled) {
		opacity: 0.7;
	}

	.toolbar-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* Textarea */
	textarea {
		width: 100%;
		height: 100%;
		background: transparent;
		border: none;
		resize: none;
		font-family: var(--font-mono);
		font-size: var(--annotation-font-size);
		line-height: 1.5;
		color: var(--annotation-color);
		outline: none;
		padding: 8px;
		box-sizing: border-box;
		box-shadow: none;
	}

	textarea:focus {
		box-shadow: none;
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
		font-size: var(--annotation-font-size);
		line-height: 1.5;
		color: var(--annotation-color);
		overflow: auto;
	}

	.rendered :global(h1) {
		font-size: calc(var(--annotation-font-size) * 1.3);
		font-weight: 600;
		margin: 0 0 6px;
		color: var(--annotation-color);
	}

	.rendered :global(h2) {
		font-size: calc(var(--annotation-font-size) * 1.1);
		font-weight: 600;
		margin: 0 0 4px;
		color: var(--annotation-color);
	}

	.rendered :global(h3) {
		font-size: var(--annotation-font-size);
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
