<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { graphStore } from '$lib/stores/graph';
	import Icon from '$lib/components/icons/Icon.svelte';
	import { NAV_HEIGHT, PANEL_GAP } from '$lib/constants/layout';

	interface Props {
		position: 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right';
		initialWidth?: number;
		initialHeight?: number;
		minWidth?: number;
		minHeight?: number;
		maxWidth?: number;
		maxHeight?: number;
		bottomOffset?: number;
		currentHeight?: number;
		width?: number; // Controlled width (for bottom-left/bottom-right)
		onWidthChange?: (width: number) => void;
		title?: string;
		onClose: () => void;
		header?: import('svelte').Snippet;
		actions?: import('svelte').Snippet;
		toolbar?: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
		children?: import('svelte').Snippet;
	}

	let {
		position,
		initialWidth = 320,
		initialHeight = 280,
		minWidth = 200,
		minHeight = 150,
		maxWidth = 800,
		maxHeight,
		bottomOffset = 0,
		currentHeight = $bindable(280),
		width: controlledWidth,
		onWidthChange,
		title,
		onClose,
		header,
		actions,
		toolbar,
		footer,
		children
	}: Props = $props();

	// Calculate dynamic max height for bottom panels (viewport - nav bar - gaps)
	function getEffectiveMaxHeight(): number {
		if (maxHeight !== undefined) {
			return maxHeight;
		}
		// For bottom panels, calculate based on viewport
		if (position.includes('bottom')) {
			return window.innerHeight - NAV_HEIGHT - PANEL_GAP * 2;
		}
		return 600; // Default for side panels
	}

	// Internal state for dimensions (untrack since we intentionally only use initial values)
	let internalWidth = $state(untrack(() => initialWidth));
	let height = $state(untrack(() => initialHeight));

	// Effective width - controlled externally or internal
	function getWidth() {
		return controlledWidth ?? internalWidth;
	}

	function setWidth(newWidth: number) {
		if (onWidthChange) {
			onWidthChange(newWidth);
		} else {
			internalWidth = newWidth;
		}
	}

	// Sync height to parent
	$effect(() => {
		currentHeight = height;
	});
	let isResizing = $state(false);
	let resizeEdge = $state<'left' | 'right' | 'top' | 'bottom' | null>(null);

	// Compute max-height reactively based on bottomOffset
	const maxHeightStyle = $derived(
		position === 'left' || position === 'right'
			? `max-height: calc(100vh - 80px${bottomOffset > 0 ? ` - ${bottomOffset}px` : ''});`
			: ''
	);

	// Determine which edges are resizable based on position
	const resizableEdges = $derived(() => {
		switch (position) {
			case 'left': return { right: true, bottom: true };
			case 'right': return { left: true, bottom: true };
			case 'bottom': return { top: true };
			case 'bottom-left': return { top: true, right: true };
			case 'bottom-right': return { top: true, left: true };
			default: return {};
		}
	});

	// Get transition direction
	const transition = $derived(() => {
		switch (position) {
			case 'left': return { x: -20 };
			case 'right': return { x: 20 };
			case 'bottom':
			case 'bottom-left':
			case 'bottom-right': return { y: 20 };
			default: return { x: 0 };
		}
	});

	// Track active resize cleanup for component destroy
	let activeCleanup: (() => void) | null = null;

	function startResize(edge: 'left' | 'right' | 'top' | 'bottom') {
		return (event: MouseEvent) => {
			event.preventDefault();
			isResizing = true;
			resizeEdge = edge;

			const startX = event.clientX;
			const startY = event.clientY;
			const startWidth = getWidth();
			const startHeight = height;

			function onMouseMove(e: MouseEvent) {
				if (!isResizing) return;

				const deltaX = e.clientX - startX;
				const deltaY = e.clientY - startY;

				if (resizeEdge === 'right') {
					// When controlled (onWidthChange provided), let parent handle max constraint
					const newWidth = Math.max(minWidth, startWidth + deltaX);
					setWidth(onWidthChange ? newWidth : Math.min(maxWidth, newWidth));
				} else if (resizeEdge === 'left') {
					const newWidth = Math.max(minWidth, startWidth - deltaX);
					setWidth(onWidthChange ? newWidth : Math.min(maxWidth, newWidth));
				} else if (resizeEdge === 'bottom') {
					height = Math.min(getEffectiveMaxHeight(), Math.max(minHeight, startHeight + deltaY));
				} else if (resizeEdge === 'top') {
					height = Math.min(getEffectiveMaxHeight(), Math.max(minHeight, startHeight - deltaY));
				}
			}

			function cleanup() {
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
				document.body.classList.remove('resizing-ew', 'resizing-ns');
				activeCleanup = null;
			}

			function onMouseUp() {
				isResizing = false;
				resizeEdge = null;
				cleanup();
			}

			activeCleanup = cleanup;
			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
			document.body.classList.add((edge === 'left' || edge === 'right') ? 'resizing-ew' : 'resizing-ns');
		};
	}

	onDestroy(() => {
		activeCleanup?.();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
<aside
	class="resizable-panel glass-panel {position}"
	class:resizing={isResizing}
	style="
		{position === 'left' || position === 'right' ? `width: ${getWidth()}px;` : ''}
		{(position === 'bottom-left' || position === 'bottom-right') && controlledWidth !== undefined ? `width: ${getWidth()}px;` : ''}
		{position.includes('bottom') ? `height: ${height}px;` : ''}
		{maxHeightStyle}
	"
	transition:fly={{ ...transition(), duration: 200, easing: cubicOut }}
	onmousedown={() => graphStore.clearSelection()}
>
	<!-- Resize handles -->
	{#if resizableEdges().left}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle handle-left" onmousedown={startResize('left')}></div>
	{/if}
	{#if resizableEdges().right}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle handle-right" onmousedown={startResize('right')}></div>
	{/if}
	{#if resizableEdges().top}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle handle-top" onmousedown={startResize('top')}></div>
	{/if}
	{#if resizableEdges().bottom}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle handle-bottom" onmousedown={startResize('bottom')}></div>
	{/if}

	<div class="panel-header">
		{#if header}
			{@render header()}
		{:else}
			<span>{title}</span>
		{/if}
		<div class="header-actions">
			{#if actions}
				{@render actions()}
			{/if}
			<button class="icon-btn ghost" onclick={onClose} aria-label="Close">
				<Icon name="x" size={16} />
			</button>
		</div>
	</div>
	{#if toolbar}
		<div class="panel-toolbar">
			{@render toolbar()}
		</div>
	{/if}
	<div class="panel-content">
		{@render children?.()}
	</div>
	{#if footer}
		<div class="panel-footer">
			{@render footer()}
		</div>
	{/if}
</aside>

<style>
	.resizable-panel {
		position: fixed;
		z-index: 90;
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 80px);
		overflow: hidden;
	}

	.resizable-panel.resizing {
		transition: none;
	}

	/* Position variants - toggles are on left side */
	.resizable-panel.left {
		left: calc(var(--panel-toggles-width) + var(--panel-gap));
		top: 68px;
	}

	.resizable-panel.right {
		right: var(--panel-gap);
		top: 68px;
	}

	.resizable-panel.bottom {
		left: calc(var(--panel-toggles-width) + var(--panel-gap));
		right: var(--panel-gap);
		bottom: var(--panel-gap);
	}

	.resizable-panel.bottom-left {
		left: calc(var(--panel-toggles-width) + var(--panel-gap));
		bottom: var(--panel-gap);
		/* width controlled by inline style when both panels open */
	}

	.resizable-panel.bottom-right {
		right: var(--panel-gap);
		bottom: var(--panel-gap);
		/* width controlled by inline style when both panels open */
	}

	/* Resize handles */
	.resize-handle {
		position: absolute;
		z-index: 10;
	}

	.handle-left {
		left: -4px;
		top: 0;
		bottom: 0;
		width: 8px;
		cursor: ew-resize;
	}

	.handle-right {
		right: -4px;
		top: 0;
		bottom: 0;
		width: 8px;
		cursor: ew-resize;
	}

	.handle-top {
		top: -4px;
		left: 0;
		right: 0;
		height: 8px;
		cursor: ns-resize;
	}

	.handle-bottom {
		bottom: -4px;
		left: 0;
		right: 0;
		height: 8px;
		cursor: ns-resize;
	}


	/* Panel header */
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: var(--header-height);
		padding: 0 var(--space-md);
		background: var(--surface-raised);
		border-bottom: 1px solid var(--border);
		font-weight: 500;
		font-size: var(--font-base);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		flex-shrink: 0;
	}

	.panel-toolbar {
		flex-shrink: 0;
		border-bottom: 1px solid var(--border);
	}

	.panel-content {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: auto;
		min-height: 0;
	}

	.panel-footer {
		flex-shrink: 0;
		background: var(--surface-raised);
		border-top: 1px solid var(--border);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		flex-shrink: 0;
	}

	/* Uses global .icon-btn from app.css */
</style>
