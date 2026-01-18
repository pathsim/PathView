<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { scale, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from '$lib/components/icons/Icon.svelte';

	interface Example {
		name: string;
		file: string;
		previewBase: string;
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
	let isDark = $state(true);

	onMount(() => {
		// Detect theme and watch for changes
		const updateTheme = () => {
			isDark = document.documentElement.getAttribute('data-theme') !== 'light';
		};
		updateTheme();

		const observer = new MutationObserver(updateTheme);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

		// Load examples
		(async () => {
			try {
				const manifestRes = await fetch(`${base}/examples/manifest.json`);
				if (!manifestRes.ok) throw new Error('No manifest');
				const manifest = await manifestRes.json();
				const files: string[] = manifest.files || [];

				const loadedExamples = await Promise.all(
					files.map(async (filename): Promise<Example | null> => {
						try {
							const fileRes = await fetch(`${base}/examples/${filename}`);
							if (fileRes.ok) {
								const data = await fileRes.json();
								const baseName = filename.replace('.json', '');
								return {
									name: data.metadata?.name || baseName,
									file: `${base}/examples/${filename}`,
									previewBase: `${base}/examples/${baseName}`
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
		})();

		return () => observer.disconnect();
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

			<a href="https://github.com/pathsim/pathview" target="_blank" class="action-card">
				<Icon name="github" size={20} />
				<span class="action-label">GitHub</span>
			</a>

			<a href="https://github.com/pathsim/pathview/issues/new/choose" target="_blank" class="action-card">
				<Icon name="alert-triangle" size={20} />
				<span class="action-label">Issue</span>
			</a>

			<a href="https://github.com/sponsors/milanofthe" target="_blank" class="action-card">
				<Icon name="heart" size={20} />
				<span class="action-label">Sponsor</span>
			</a>
		</div>

		{#if loading}
			<div class="examples-section">
				<div class="loading-text">Loading examples...</div>
			</div>
		{:else if examples.length > 0}
			<div class="examples-section">
				<div class="examples-grid">
					{#each examples as example}
						<button class="example-card" onclick={() => handleExample(example.file)}>
							<div class="example-info">
								<div class="example-name">{example.name}</div>
							</div>
							<div class="example-preview">
								<img src="{example.previewBase}-{isDark ? 'dark' : 'light'}.svg" alt="{example.name} preview" />
							</div>
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
		max-width: 780px;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		background: var(--surface-raised);
		overflow: hidden;
	}

	.header {
		text-align: center;
	}

	.logo {
		height: 100px;
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 8px;
	}

	.action-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px 12px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
		text-decoration: none;
		font-family: inherit;
	}

	.action-card:hover {
		background: var(--surface-hover);
		border-color: var(--border);
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
		min-height: 0;
		flex: 1;
		margin: 0 -24px -24px -24px;
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
		grid-auto-rows: min-content;
		align-items: start;
		gap: 10px;
		overflow-y: auto;
		max-height: 320px;
		padding: 0 24px 24px 24px;
	}

	.example-card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: flex-start;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
		overflow: hidden;
		font-family: inherit;
	}

	.example-card:hover {
		border-color: var(--accent);
	}

	.example-preview {
		background: var(--surface);
		width: 100%;
	}

	.example-preview img {
		display: block;
		width: 100%;
		height: auto;
	}

	.example-info {
		padding: 0;
		text-align: left;
	}

	.example-name {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-muted);
	}

	@media (max-width: 700px) {
		.examples-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 600px) {
		.actions {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 500px) {
		.examples-grid {
			grid-template-columns: 1fr;
		}
	}

</style>
