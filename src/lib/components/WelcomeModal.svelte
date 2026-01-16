<script lang="ts">
	import { onMount } from 'svelte';
    import { base } from '$app/paths';
	import { scale, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from '$lib/components/icons/Icon.svelte';

	interface Example {
		name: string;
		file: string;
		nodeCount: number;
		description?: string;
	}

	interface Props {
		onNew: () => void;
		onOpen: () => void;
		onLoadExample: (file: string) => void;
		onClose: () => void;
	}

	let { onNew, onOpen, onLoadExample, onClose }: Props = $props();

	let examples = $state<Example[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			// Fetch manifest (just a list of filenames)
			const manifestRes = await fetch(`${base}/examples/manifest.json`);
			if (!manifestRes.ok) throw new Error('No manifest');
			const manifest = await manifestRes.json();
			const files: string[] = manifest.files || [];

			// Fetch all files in parallel to get metadata
			const loadedExamples = await Promise.all(
				files.map(async (filename): Promise<Example | null> => {
					try {
						const fileRes = await fetch(`${base}/examples/${filename}`);
						if (fileRes.ok) {
							const data = await fileRes.json();
							return {
								name: data.metadata?.name || filename.replace('.json', ''),
								file: `${base}/examples/${filename}`,
								nodeCount: data.graph?.nodes?.length || 0,
								description: data.metadata?.description
							};
						}
					} catch (e) {
						console.warn(`Could not load example: ${filename}`);
					}
					return null;
				})
			);
			examples = loadedExamples.filter((e): e is Example => e !== null);
		} catch (e) {
			console.warn('Could not load examples');
		}
		loading = false;
	});

	function handleNew() {
		onNew();
		onClose();
	}

	function handleOpen() {
		onOpen();
		onClose();
	}

	function handleExample(file: string) {
		onLoadExample(file);
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="dialog-backdrop" transition:fade={{ duration: 150 }} onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="presentation">
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div class="modal glass-panel" transition:scale={{ start: 0.95, duration: 200, easing: cubicOut }} onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
		<div class="header">
			<img src="{base}/pathview_logo.png" alt="PathView" class="logo" />
		</div>

		<div class="actions">
			<button class="action-card" onclick={handleNew}>
				<Icon name="new-canvas" size={20} />
				<span class="action-label">New</span>
			</button>

			<button class="action-card" onclick={handleOpen}>
				<Icon name="download" size={20} />
				<span class="action-label">Open</span>
			</button>

			<a href="https://docs.pathsim.org" target="_blank" class="action-card">
				<Icon name="book" size={20} />
				<span class="action-label">Docs</span>
			</a>

			<a href="https://github.com/pathsim" target="_blank" class="action-card">
				<Icon name="github" size={20} />
				<span class="action-label">GitHub</span>
			</a>

			<a href="https://github.com/sponsors/milanofthe" target="_blank" class="action-card">
				<Icon name="heart" size={20} />
				<span class="action-label">Sponsor</span>
			</a>
		</div>

		{#if loading}
			<div class="examples-section">
				<h3>Examples</h3>
				<div class="loading-text">Loading examples...</div>
			</div>
		{:else if examples.length > 0}
			<div class="examples-section">
				<h3>Examples</h3>
				<div class="examples-grid">
					{#each examples as example}
						<button class="example-card" onclick={() => handleExample(example.file)}>
							<span class="example-name">{example.name}</span>
							<span class="example-desc">{example.description || `${example.nodeCount} nodes`}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

	</div>
</div>

<style>
	/* Uses global .dialog-backdrop from app.css */

	.modal {
		width: 90%;
		max-width: 580px;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.header {
		text-align: center;
	}

	.logo {
		height: 100px;
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 8px;
	}

	.action-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px 12px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
		text-decoration: none;
		font-family: inherit;
	}

	.action-card:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
		transform: translateY(-1px);
	}

	.action-card :global(svg) {
		color: var(--accent);
	}

	.action-label {
		font-size: 11px;
		font-weight: 500;
	}

	.examples-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.examples-section h3 {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0;
	}

	.loading-text {
		color: var(--text-disabled);
		font-size: 11px;
		text-align: center;
		padding: 16px;
	}

	.examples-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}

	.example-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 8px 10px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
	}

	.example-card:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
	}

	.example-name {
		font-size: 11px;
		font-weight: 500;
		color: var(--accent);
	}

	.example-desc {
		font-size: 10px;
		color: var(--text-muted);
		line-height: 1.3;
	}

</style>
