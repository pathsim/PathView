<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { graphStore } from '$lib/stores/graph';
	import Icon from '$lib/components/icons/Icon.svelte';

	let breadcrumbs = $state<{ id: string; name: string }[]>([]);
	let isAtRoot = $state(true);

	const unsubscribe = graphStore.breadcrumbs.subscribe((crumbs) => {
		breadcrumbs = crumbs;
		isAtRoot = crumbs.length <= 1;
	});

	onDestroy(unsubscribe);

	function handleClick(index: number) {
		graphStore.navigateTo(index);
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick(index);
		}
	}
</script>

{#if !isAtRoot}
	<nav class="breadcrumb glass-panel" transition:fly={{ y: -10, duration: 150 }}>
		{#each breadcrumbs as crumb, i}
			<button
				class="crumb-pill"
				class:current={i === breadcrumbs.length - 1}
				onclick={() => handleClick(i)}
				onkeydown={(e) => handleKeydown(e, i)}
				disabled={i === breadcrumbs.length - 1}
			>
				{#if i === 0}
					<Icon name="home" size={14} />
				{:else}
					{crumb.name}
				{/if}
			</button>
		{/each}
	</nav>
{/if}

<style>
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		height: var(--header-height);
		padding: 0 var(--space-xs);
		user-select: none;
	}

	.crumb-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		color: var(--text-muted);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.crumb-pill:hover:not(:disabled) {
		background: var(--surface-hover);
		border-color: var(--border-focus);
		color: var(--text);
	}

	.crumb-pill.current {
		background: color-mix(in srgb, var(--accent) 15%, var(--surface-raised));
		border-color: var(--accent);
		color: var(--accent);
		cursor: default;
		opacity: 1;
	}
</style>
