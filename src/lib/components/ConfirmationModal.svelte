<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { confirmationStore } from '$lib/stores/confirmation';
	import Icon from '$lib/components/icons/Icon.svelte';

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
			<div class="dialog-header">
				<span id="confirmation-title">{state.options.title}</span>
				<button class="icon-btn" onclick={handleCancel} aria-label="Close">
					<Icon name="x" size={16} />
				</button>
			</div>

			<div class="dialog-body">
				<p id="confirmation-message">{state.options.message}</p>
			</div>

			<div class="dialog-footer">
				<button class="ghost" onclick={handleCancel}>
					{state.options.cancelText}
				</button>
				<button
					class:primary={!state.options.destructive}
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

	.dialog-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md) var(--space-md);
	}

	.dialog-footer button.destructive {
		background: transparent;
		color: var(--error);
	}

	.dialog-footer button.destructive:hover {
		background: var(--error-bg);
	}
</style>
