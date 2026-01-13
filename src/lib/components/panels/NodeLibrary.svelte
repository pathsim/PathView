<script lang="ts">
	import { nodeRegistry, blockConfig, type NodeCategory, type NodeTypeDefinition } from '$lib/nodes';
	import { NODE_TYPES } from '$lib/constants/nodeTypes';
	import NodePreview from '$lib/components/nodes/NodePreview.svelte';
	import Icon from '$lib/components/icons/Icon.svelte';
	import { tooltip } from '$lib/components/Tooltip.svelte';

	interface Props {
		onAddNode?: (type: string) => void;
		focusSearch?: boolean;
	}

	let { onAddNode, focusSearch = false }: Props = $props();

	// Search query
	let searchQuery = $state('');
	let searchInput: HTMLInputElement;

	// Keyboard navigation
	let selectedIndex = $state(-1);

	// Track drag state to prevent click after drag
	let isDragging = $state(false);

	// Collapsed categories
	let collapsedCategories = $state<Set<string>>(new Set());

	function toggleCategory(category: string) {
		collapsedCategories = new Set(collapsedCategories);
		if (collapsedCategories.has(category)) {
			collapsedCategories.delete(category);
		} else {
			collapsedCategories.add(category);
		}
	}

	// Category order derived from blockConfig (source of truth)
	// Add Subsystem at end since it's registered separately
	const categoryOrder: NodeCategory[] = [...Object.keys(blockConfig) as NodeCategory[], 'Subsystem'];

	// Get all node types
	const nodeTypes = nodeRegistry.getAll();

	// Filter nodes based on search and context
	// Interface is NEVER shown in library - it's auto-created inside subsystems
	const filteredNodes = $derived(() => {
		// Always hide Interface block - it's auto-created inside subsystems
		let nodes = nodeTypes.filter((node) => node.type !== NODE_TYPES.INTERFACE);

		if (!searchQuery.trim()) return nodes;
		const query = searchQuery.toLowerCase();
		return nodes.filter(
			(node) =>
				node.name.toLowerCase().includes(query) ||
				node.category.toLowerCase().includes(query) ||
				node.description.toLowerCase().includes(query)
		);
	});

	// Group by category (ordered)
	const groupedNodes = $derived(() => {
		const groups = new Map<NodeCategory, NodeTypeDefinition[]>();
		for (const node of filteredNodes()) {
			if (!groups.has(node.category)) {
				groups.set(node.category, []);
			}
			groups.get(node.category)!.push(node);
		}
		// Return in order
		const ordered = new Map<NodeCategory, NodeTypeDefinition[]>();
		for (const cat of categoryOrder) {
			if (groups.has(cat)) {
				ordered.set(cat, groups.get(cat)!);
			}
		}
		return ordered;
	});

	// Flat list for keyboard navigation
	const flatNodes = $derived(() => {
		const result: NodeTypeDefinition[] = [];
		for (const [, nodes] of groupedNodes()) {
			result.push(...nodes);
		}
		return result;
	});

	// Handle drag start
	function handleDragStart(event: DragEvent, nodeType: NodeTypeDefinition) {
		isDragging = true;
		if (event.dataTransfer) {
			event.dataTransfer.setData('application/pathview-node', nodeType.type);
			event.dataTransfer.effectAllowed = 'copy';
		}
	}

	// Handle drag end
	function handleDragEnd() {
		// Reset after a short delay to prevent click from firing
		setTimeout(() => {
			isDragging = false;
		}, 100);
	}

	// Handle click to add node (only if not dragging)
	function handleNodeClick(node: NodeTypeDefinition) {
		if (isDragging) return;
		if (onAddNode) {
			onAddNode(node.type);
		}
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		const nodes = flatNodes();

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, nodes.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, -1);
		} else if (event.key === 'Enter' && selectedIndex >= 0) {
			event.preventDefault();
			const node = nodes[selectedIndex];
			if (node && onAddNode) {
				onAddNode(node.type);
			}
		} else if (event.key === 'Escape') {
			if (searchQuery) {
				// First Escape: clear search
				searchQuery = '';
				selectedIndex = -1;
				event.stopPropagation();
			} else {
				// Second Escape: unfocus search input
				searchInput?.blur();
			}
		}
	}

	// Reset selection when search changes
	$effect(() => {
		searchQuery; // dependency
		selectedIndex = searchQuery ? 0 : -1;
	});

	// Focus search input when requested
	$effect(() => {
		if (focusSearch && searchInput) {
			searchInput.focus();
		}
	});

	// Check if node is selected
	function isSelected(node: NodeTypeDefinition): boolean {
		const nodes = flatNodes();
		return nodes[selectedIndex]?.type === node.type;
	}

	// Export focus method
	export function focus() {
		searchInput?.focus();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="node-library" onkeydown={handleKeydown}>
	<div class="search-container">
		<span class="search-icon"><Icon name="search" size={14} /></span>
		<input
			bind:this={searchInput}
			type="text"
			placeholder="Search nodes..."
			bind:value={searchQuery}
			class="search-input"
		/>
		{#if searchQuery}
			<button class="clear-btn" onclick={() => (searchQuery = '')}><Icon name="x" size={12} /></button>
		{/if}
	</div>

	<div class="node-grid-container">
		{#each Array.from(groupedNodes().entries()) as [category, nodes]}
			<div class="category">
				<button class="category-header" onclick={() => toggleCategory(category)}>
					<span class="chevron" class:expanded={!collapsedCategories.has(category)}>
						<Icon name="chevron-right" size={12} />
					</span>
					<span class="category-name">{category}</span>
				</button>
				{#if !collapsedCategories.has(category)}
					<div class="tile-grid">
						{#each nodes as node}
							<button
								class="node-tile"
								class:selected={isSelected(node)}
								draggable="true"
								ondragstart={(e) => handleDragStart(e, node)}
								ondragend={handleDragEnd}
								onclick={() => handleNodeClick(node)}
								use:tooltip={node.description}
							>
								<NodePreview {node} />
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div class="empty">
				<span>No nodes found</span>
				<span class="hint">Try "gain", "source", or "plot"</span>
			</div>
		{/each}
	</div>

	<div class="footer">
		<span>Click or drag to add</span>
		<span>↑↓ Enter</span>
	</div>
</div>

<style>
	.node-library {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.search-container {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		height: var(--header-height);
		padding: 0 var(--space-md);
		border-bottom: 1px solid var(--border);
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

	.node-grid-container {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
		padding: var(--space-md);
		background: var(--surface);
	}

	.category {
		margin-bottom: var(--space-lg);
	}

	.category-header {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		width: 100%;
		padding: var(--space-xs) 0;
		margin-bottom: var(--space-sm);
		font-size: 10px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.category-header:hover {
		color: var(--text);
	}

	.category-header .chevron {
		display: flex;
		transition: transform var(--transition-fast);
		flex-shrink: 0;
	}

	.category-header .chevron.expanded {
		transform: rotate(90deg);
	}

	.category-header .category-name {
		flex: 1;
	}

	.tile-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.node-tile {
		background: transparent;
		border: none;
		padding: 0;
		cursor: grab;
		transition: transform var(--transition-fast);
	}

	.node-tile:hover {
		transform: translateY(-2px);
	}

	.node-tile:hover :global(.node-preview) {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}

	.node-tile.selected :global(.node-preview) {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent);
	}

	.node-tile:active {
		cursor: grabbing;
	}

	.empty {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-xl);
		text-align: center;
		color: var(--text-muted);
		font-size: 12px;
	}

	.empty .hint {
		font-size: 10px;
		color: var(--text-disabled);
	}

	.footer {
		flex-shrink: 0;
		display: flex;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-raised);
		border-top: 1px solid var(--border);
		font-size: 10px;
		color: var(--text-disabled);
	}
</style>
