<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { scale, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from '$lib/components/icons/Icon.svelte';

	interface Example {
		name: string;
		description?: string;
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
									description: data.metadata?.description,
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

		<div class="separator"></div>

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

		<div class="separator"></div>

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
								{#if example.description}
									<div class="example-description">{example.description}</div>
								{/if}
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
		padding: 24px 0;
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
		padding: 6px 12px;
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: none;
		font-family: inherit;
	}

	.action-card :global(svg) {
		color: var(--accent);
		transition: transform 0.15s ease;
	}

	.action-card:hover :global(svg) {
		transform: scale(1.2);
	}

	.action-label {
		font-size: 11px;
		font-weight: 500;
	}

	.separator {
		height: 1px;
		background: var(--border);
		margin: 0 -24px;
	}

	.examples-section {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
		margin: -16px -24px -24px -24px;
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
		padding: 16px;
	}

	.example-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: flex-start;
		padding: 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: transform 0.15s ease;
		text-align: left;
		overflow: hidden;
		font-family: inherit;
	}

	.example-card:hover {
		transform: scale(1.03);
	}

	.example-info {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 1;
		padding: 6px 8px;
		text-align: left;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		transition: padding 0.15s ease;
	}

	.example-card:hover .example-info {
		border-radius: var(--radius-md);
	}

	.example-name {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-muted);
	}

	.example-description {
		font-size: 10px;
		color: var(--text-muted);
		max-height: 0;
		overflow: hidden;
		opacity: 0;
		transition: max-height 0.15s ease, opacity 0.15s ease, margin 0.15s ease;
	}

	.example-card:hover .example-description {
		max-height: 100px;
		opacity: 1;
		margin-top: 4px;
	}

	.example-preview {
		background: var(--surface);
		width: 100%;
		padding-top: 28px; /* Space for the header */
	}

	.example-preview img {
		display: block;
		width: 100%;
		height: auto;
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
