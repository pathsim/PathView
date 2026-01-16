<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { confirmationStore } from '$lib/stores/confirmation';

	let state = $state<{
		open: boolean;
		options: {
			title: string;
			message: string;
			confirmText?: string;
			cancelText?: string;
			destructive?: boolean;
		} | null;
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
			<div class="confirmation-content">
				<h2 id="confirmation-title">{state.options.title}</h2>
				<p id="confirmation-message">{state.options.message}</p>
			</div>
			<div class="confirmation-actions">
				<button class="btn secondary" onclick={handleCancel}>
					{state.options.cancelText}
				</button>
				<button
					class="btn primary"
					class:destructive={state.options.destructive}
					onclick={handleConfirm}
				>
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
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.confirmation-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.confirmation-content h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}

	.confirmation-content p {
		margin: 0;
		font-size: 13px;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.confirmation-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
	}

	.btn {
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn.secondary {
		background: var(--surface-hover);
		border: 1px solid var(--border);
		color: var(--text);
	}

	.btn.secondary:hover {
		background: var(--surface-active);
	}

	.btn.primary {
		background: var(--accent);
		border: 1px solid var(--accent);
		color: white;
	}

	.btn.primary:hover {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	.btn.primary.destructive {
		background: var(--error);
		border-color: var(--error);
	}

	.btn.primary.destructive:hover {
		background: color-mix(in srgb, var(--error) 85%, black);
		border-color: color-mix(in srgb, var(--error) 85%, black);
	}
</style>
