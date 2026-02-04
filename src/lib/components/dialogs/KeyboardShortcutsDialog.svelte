<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from '$lib/components/icons/Icon.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	const shortcuts = [
		{
			category: 'File',
			items: [
				{ keys: ['Ctrl', 'O'], description: 'Open' },
				{ keys: ['Ctrl', 'S'], description: 'Save' },
				{ keys: ['Ctrl', 'Shift', 'S'], description: 'Save as' },
				{ keys: ['Ctrl', 'E'], description: 'Export Python' }
			]
		},
		{
			category: 'Edit',
			items: [
				{ keys: ['Ctrl', 'Z'], description: 'Undo' },
				{ keys: ['Ctrl', 'Y'], description: 'Redo' },
				{ keys: ['Ctrl', 'A'], description: 'Select all' },
				{ keys: ['Ctrl', 'X'], description: 'Cut' },
				{ keys: ['Ctrl', 'C'], description: 'Copy' },
				{ keys: ['Ctrl', 'V'], description: 'Paste' },
				{ keys: ['Ctrl', 'D'], description: 'Duplicate' },
				{ keys: ['Del'], description: 'Delete' },
				{ keys: ['Ctrl', 'F'], description: 'Find' },
				{ keys: ['Esc'], description: 'Deselect' }
			]
		},
		{
			category: 'Transform',
			items: [
				{ keys: ['R'], description: 'Rotate 90°' },
				{ keys: ['X'], description: 'Flip H' },
				{ keys: ['Y'], description: 'Flip V' },
				{ keys: ['Arrows'], description: 'Nudge' },
				{ keys: ['Shift', 'Arrows'], description: 'Nudge 10px' }
			]
		},
		{
			category: 'View',
			items: [
				{ keys: ['F'], description: 'Fit view' },
				{ keys: ['H'], description: 'Go to root' },
				{ keys: ['+'], description: 'Zoom in' },
				{ keys: ['-'], description: 'Zoom out' },
				{ keys: ['L'], description: 'Port labels' },
				{ keys: ['T'], description: 'Theme' }
			]
		},
		{
			category: 'Panels',
			items: [
				{ keys: ['S'], description: 'Simulation' },
				{ keys: ['B'], description: 'Blocks' },
				{ keys: ['N'], description: 'Events' },
				{ keys: ['E'], description: 'Editor' },
				{ keys: ['V'], description: 'Results' },
				{ keys: ['C'], description: 'Console' },
				{ keys: ['P'], description: 'Pin plots' }
			]
		},
		{
			category: 'Run',
			items: [
				{ keys: ['Ctrl', 'Enter'], description: 'Simulate' },
				{ keys: ['Shift', 'Enter'], description: 'Continue' },
				{ keys: ['?'], description: 'Shortcuts' }
			]
		}
	];
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div class="dialog-backdrop" transition:fade={{ duration: 150 }} onclick={onClose} role="presentation">
		<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
		<div
			class="dialog glass-panel"
			transition:scale={{ start: 0.95, duration: 150, easing: cubicOut }}
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="shortcuts-title"
		>
			<div class="dialog-header">
				<span id="shortcuts-title">Keyboard Shortcuts</span>
				<button class="icon-btn ghost" onclick={onClose} aria-label="Close">
					<Icon name="x" size={16} />
				</button>
			</div>

			<div class="dialog-body">
				{#each shortcuts as section}
					<div class="section">
						<div class="section-header">{section.category}</div>
						<div class="section-items">
							{#each section.items as shortcut}
								<div class="shortcut-row">
									<span class="keys">
										{#each shortcut.keys as key, i}
											<kbd>{key}</kbd>{#if i < shortcut.keys.length - 1}<span class="separator">+</span>{/if}
										{/each}
									</span>
									<span class="label">{shortcut.description}</span>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div class="dialog-footer">
				Press <kbd>?</kbd> to toggle
			</div>
		</div>
	</div>
{/if}

<style>
	.dialog {
		width: 580px;
		max-width: 90vw;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.dialog-body {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0;
		padding: 0;
		overflow-y: auto;
	}

	.section {
		padding: var(--space-md);
		border-right: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.section:nth-child(3n) {
		border-right: none;
	}

	.section:nth-last-child(-n+3) {
		border-bottom: none;
	}

	.section-header {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-disabled);
		margin-bottom: var(--space-sm);
	}

	.section-items {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.keys {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}

	.separator {
		color: var(--text-disabled);
		font-size: 9px;
		margin: 0 1px;
	}

	kbd {
		display: inline-block;
		padding: 2px 5px;
		font-family: inherit;
		font-size: 10px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--text-muted);
		min-width: 16px;
		text-align: center;
	}

	.label {
		font-size: 11px;
		color: var(--text-muted);
		text-align: right;
	}

	.dialog-footer {
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-raised);
		border-top: 1px solid var(--border);
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
		font-size: 10px;
		color: var(--text-disabled);
		text-align: center;
	}

	.dialog-footer kbd {
		font-size: 9px;
		padding: 1px 4px;
		margin: 0 2px;
	}

	@media (max-width: 560px) {
		.dialog-body {
			grid-template-columns: repeat(2, 1fr);
		}

		.section:nth-child(3n) {
			border-right: 1px solid var(--border);
		}

		.section:nth-child(2n) {
			border-right: none;
		}

		.section:nth-last-child(-n+3) {
			border-bottom: 1px solid var(--border);
		}

		.section:nth-last-child(-n+2) {
			border-bottom: none;
		}
	}
</style>
