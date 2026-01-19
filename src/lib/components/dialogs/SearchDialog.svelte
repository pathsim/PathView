<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { graphStore, type SearchableNode } from '$lib/stores/graph';
	import { triggerFocusNode } from '$lib/stores/viewActions';
	import Icon from '$lib/components/icons/Icon.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let searchQuery = $state('');
	let searchInput = $state<HTMLInputElement | undefined>(undefined);
	let selectedIndex = $state(0);

	// Get all nodes with path info (refreshed when dialog opens)
	let allSearchableNodes = $state<SearchableNode[]>([]);
	let currentPath = $state<string[]>([]);

	// Subscribe to current path for prioritizing current view
	const unsubscribePath = graphStore.currentPath.subscribe((path) => {
		currentPath = path;
	});

	onDestroy(() => {
		unsubscribePath();
	});

	// Refresh node list when dialog opens
	$effect(() => {
		if (open) {
			allSearchableNodes = graphStore.getAllNodesWithPaths();
		}
	});

	// Check if a node is in the current view
	function isInCurrentView(item: SearchableNode): boolean {
		if (item.path.length !== currentPath.length) return false;
		return item.path.every((id, i) => id === currentPath[i]);
	}

	// Filter and sort nodes based on search query
	const filteredNodes = $derived(() => {
		let results = allSearchableNodes;

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			results = results.filter(
				(item) =>
					item.node.name.toLowerCase().includes(query) ||
					item.node.type.toLowerCase().includes(query)
			);
		}

		// Sort: current view first, then by depth
		return [...results].sort((a, b) => {
			const aInView = isInCurrentView(a);
			const bInView = isInCurrentView(b);
			if (aInView && !bInView) return -1;
			if (!aInView && bInView) return 1;
			return a.depth - b.depth;
		});
	});

	// Reset state when dialog opens
	$effect(() => {
		if (open) {
			searchQuery = '';
			selectedIndex = 0;
			setTimeout(() => searchInput?.focus(), 50);
		}
	});

	// Clamp selected index when results change
	$effect(() => {
		const nodes = filteredNodes();
		if (selectedIndex >= nodes.length) {
			selectedIndex = Math.max(0, nodes.length - 1);
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;

		const items = filteredNodes();

		if (event.key === 'Escape') {
			onClose();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const item = items[selectedIndex];
			if (item) {
				selectNode(item);
			}
		}
	}

	function selectNode(item: SearchableNode) {
		// Navigate to the correct subsystem path first
		const itemPath = item.path;
		const current = graphStore.getCurrentPath();

		// Only navigate if we're not already at the right path
		const pathsMatch =
			itemPath.length === current.length &&
			itemPath.every((id, i) => id === current[i]);

		if (!pathsMatch) {
			graphStore.navigateToPath(itemPath);
		}

		// Select and focus the node
		graphStore.selectNode(item.node.id, false);
		triggerFocusNode(item.node.id);
		onClose();
	}

	// Format path for display
	function formatPath(pathNames: string[]): string {
		return pathNames.join(' > ');
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div class="dialog-backdrop" transition:fade={{ duration: 100 }} onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="presentation">
		<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
		<div
			class="search-dialog glass-panel"
			transition:scale={{ start: 0.95, duration: 150, easing: cubicOut }}
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
			aria-modal="true"
		>
			<div class="search-container">
				<span class="search-icon"><Icon name="search" size={14} /></span>
				<input
					bind:this={searchInput}
					type="text"
					placeholder="Find block..."
					bind:value={searchQuery}
					class="search-input"
				/>
				{#if searchQuery}
					<button class="clear-btn" onclick={() => (searchQuery = '')}><Icon name="x" size={12} /></button>
				{/if}
			</div>

			{#if filteredNodes().length > 0}
				<div class="results">
					{#each filteredNodes() as item, index}
						<button
							class="result-item"
							class:selected={index === selectedIndex}
							onclick={() => selectNode(item)}
							onmouseenter={() => selectedIndex = index}
						>
							<div class="result-main">
								<span class="node-name">{item.node.name}</span>
								<span class="node-type">{item.node.type}</span>
							</div>
							<div class="result-path">{formatPath(item.pathNames)}</div>
						</button>
					{/each}
				</div>
			{:else if searchQuery}
				<div class="no-results">No blocks found</div>
			{/if}

			<div class="footer">
				<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
				<span><kbd>↵</kbd> select</span>
				<span><kbd>esc</kbd> close</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.search-dialog {
		position: absolute;
		top: 15vh;
		width: 320px;
		max-width: 90vw;
		padding: 0;
		overflow: hidden;
	}

	.search-container {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		height: var(--header-height);
		padding: 0 var(--space-md);
		background: var(--surface-raised);
		border-bottom: 1px solid var(--border);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
	}

	.search-icon {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		font-size: var(--font-base);
		color: var(--text);
		outline: none;
		box-shadow: none;
		padding: 0;
	}

	.search-input::placeholder {
		color: var(--text-muted);
	}

	.clear-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--text-muted);
		padding: 2px;
		cursor: pointer;
	}

	.clear-btn:hover {
		color: var(--text);
	}

	.results {
		max-height: 300px;
		overflow-y: auto;
		padding: 4px;
	}

	.result-item {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		width: 100%;
		padding: 6px 10px;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text);
		font-size: 12px;
		text-align: left;
		cursor: pointer;
		transition: background var(--transition-fast);
		gap: 2px;
	}

	.result-item:hover {
		background: var(--surface-hover);
	}

	.result-item.selected {
		background: var(--surface-hover);
	}


	.result-main {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.node-name {
		font-weight: 500;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.node-type {
		font-size: 10px;
		color: var(--text-muted);
		background: var(--surface-raised);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.result-path {
		font-size: 10px;
		color: var(--text-disabled);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.no-results {
		padding: var(--space-md);
		text-align: center;
		color: var(--text-muted);
		font-size: 11px;
	}

	.footer {
		display: flex;
		justify-content: center;
		gap: var(--space-md);
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-raised);
		border-top: 1px solid var(--border);
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
		font-size: 10px;
		color: var(--text-disabled);
	}

	.footer kbd {
		display: inline-block;
		padding: 1px 4px;
		font-family: inherit;
		font-size: 9px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
	}
</style>
