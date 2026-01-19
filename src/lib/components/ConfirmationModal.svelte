<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { confirmationStore, type ConfirmationOptions } from '$lib/stores/confirmation';
	import Icon from '$lib/components/icons/Icon.svelte';

	let state = $state<{
		open: boolean;
		options: ConfirmationOptions | null;
	}>({ open: false, options: null });

	confirmationStore.subscribe((s) => {
		state = { open: s.open, options: s.options };
	});

	function handleConfirm() {
		confirmationStore.confirm();
	}

	function handleCancel() {
		confirmationStore.cancel();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleCancel();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!state.open) return;
		if (event.key === 'Escape') {
			handleCancel();
		} else if (event.key === 'Enter') {
			handleConfirm();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if state.open && state.options}
	<div
		class="dialog-backdrop"
		onclick={handleBackdropClick}
		transition:fade={{ duration: 150 }}
		role="presentation"
	>
		<div
			class="confirmation-dialog glass-panel"
			transition:scale={{ start: 0.95, duration: 150, easing: cubicOut }}
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="confirmation-title"
			aria-describedby="confirmation-message"
		>
			<div class="dialog-header">
				<span id="confirmation-title">{state.options.title}</span>
				<button class="icon-btn" onclick={handleCancel} aria-label="Close">
					<Icon name="x" size={16} />
				</button>
			</div>

			<div class="dialog-body">
				<p id="confirmation-message">{state.options.message}</p>
			</div>

			<div class="dialog-hint">
				Press <kbd>↵</kbd> to confirm
			</div>

			<div class="dialog-footer">
				<button class="ghost" onclick={handleCancel}>
					{state.options.cancelText}
				</button>
				<button onclick={handleConfirm}>
					{state.options.confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.confirmation-dialog {
		width: 90%;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.dialog-body {
		padding: var(--space-md);
	}

	.dialog-body p {
		margin: 0;
		font-size: var(--font-sm);
		color: var(--text-muted);
		line-height: 1.5;
	}

	.dialog-hint {
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-raised);
		border-top: 1px solid var(--border);
		font-size: 10px;
		color: var(--text-disabled);
		text-align: center;
	}

	.dialog-hint kbd {
		display: inline-block;
		padding: 1px 4px;
		font-family: inherit;
		font-size: 9px;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 3px;
		color: var(--text-muted);
		margin: 0 2px;
	}

	.dialog-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md) var(--space-md);
	}

	.dialog-footer button {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.dialog-footer button.ghost {
		background: transparent;
		color: var(--text-muted);
	}

	.dialog-footer button.ghost:hover {
		background: var(--surface-hover);
		color: var(--text);
		border-color: var(--border-focus);
	}

	.dialog-footer button:not(.ghost) {
		background: var(--surface-raised);
		color: var(--text);
		border-color: var(--accent);
	}

	.dialog-footer button:not(.ghost):hover {
		background: var(--surface-hover);
		border-color: var(--accent);
	}
</style>
