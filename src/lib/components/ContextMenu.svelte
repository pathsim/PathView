<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from './icons/Icon.svelte';

	export type MenuItemType = {
		label: string;
		icon?: string;
		shortcut?: string;
		action: () => void;
		disabled?: boolean;
		divider?: boolean;
	};

	interface Props {
		x: number;
		y: number;
		items: MenuItemType[];
		onClose: () => void;
	}

	let { x, y, items, onClose }: Props = $props();

	// Track menu element for position adjustments
	let menuEl: HTMLDivElement;
	let menuRect = $state<DOMRect | null>(null);

	// Update rect when menu element is available
	$effect(() => {
		if (menuEl) {
			menuRect = menuEl.getBoundingClientRect();
		}
	});

	// Compute adjusted position to keep menu on screen
	const adjustedX = $derived(() => {
		if (!menuRect) return x;
		const viewportWidth = window.innerWidth;
		if (x + menuRect.width > viewportWidth - 10) {
			return x - menuRect.width;
		}
		return x;
	});

	const adjustedY = $derived(() => {
		if (!menuRect) return y;
		const viewportHeight = window.innerHeight;
		if (y + menuRect.height > viewportHeight - 10) {
			return y - menuRect.height;
		}
		return y;
	});

	function handleItemClick(item: MenuItemType) {
		if (!item.disabled) {
			item.action();
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="backdrop" onclick={onClose} oncontextmenu={(e) => { e.preventDefault(); onClose(); }} onkeydown={(e) => e.key === 'Escape' && onClose()} role="presentation">
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div
		bind:this={menuEl}
		class="context-menu glass-panel"
		style="left: {adjustedX()}px; top: {adjustedY()}px;"
		transition:scale={{ start: 0.95, duration: 100, easing: cubicOut }}
		onclick={(e) => e.stopPropagation()}
		role="menu"
		tabindex="-1"
	>
		{#each items as item}
			{#if item.divider}
				<div class="divider"></div>
			{:else}
				<button
					class="menu-item"
					class:disabled={item.disabled}
					onclick={() => handleItemClick(item)}
					disabled={item.disabled}
					role="menuitem"
				>
					{#if item.icon}
						<span class="icon"><Icon name={item.icon} /></span>
					{/if}
					<span class="label">{item.label}</span>
					{#if item.shortcut}
						<kbd class="shortcut">{item.shortcut}</kbd>
					{/if}
				</button>
			{/if}
		{/each}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
	}

	.context-menu {
		position: fixed;
		min-width: 160px;
		padding: 4px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 11px;
		cursor: pointer;
		text-align: left;
		transition: background var(--transition-fast);
	}

	.menu-item:hover:not(:disabled) {
		background: var(--surface-hover);
	}

	.menu-item:disabled,
	.menu-item.disabled {
		color: var(--text-disabled);
		cursor: not-allowed;
	}

	.icon {
		width: 16px;
		text-align: center;
		font-size: 14px;
	}

	.label {
		flex: 1;
	}

	.shortcut {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-disabled);
	}

	.divider {
		height: 1px;
		background: var(--border);
		margin: 4px -4px;
	}
</style>
