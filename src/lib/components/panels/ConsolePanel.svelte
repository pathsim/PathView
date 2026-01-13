<script lang="ts">
	import { onDestroy } from 'svelte';
	import { consoleStore, type LogEntry } from '$lib/stores/console';
	import Icon from '$lib/components/icons/Icon.svelte';

	let logs = $state<LogEntry[]>([]);
	let scrollContainer: HTMLDivElement | undefined = $state();
	let autoScroll = $state(true);
	let lastLogId = -1;
	let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

	const unsubscribe = consoleStore.subscribe((entries) => {
		logs = entries;
	});

	// Auto-scroll when new logs arrive
	$effect(() => {
		const latestId = logs.length > 0 ? logs[logs.length - 1].id : -1;
		if (latestId > lastLogId && autoScroll && scrollContainer) {
			// Clear any pending scroll
			if (scrollTimeout !== null) {
				clearTimeout(scrollTimeout);
			}
			// Use setTimeout to ensure DOM has updated
			scrollTimeout = setTimeout(() => {
				scrollTimeout = null;
				if (scrollContainer) {
					scrollContainer.scrollTop = scrollContainer.scrollHeight;
				}
			}, 0);
		}
		lastLogId = latestId;
	});

	onDestroy(() => {
		unsubscribe();
		if (scrollTimeout !== null) {
			clearTimeout(scrollTimeout);
		}
	});

	function handleScroll() {
		if (!scrollContainer) return;
		// Disable auto-scroll if user scrolls up
		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		autoScroll = scrollTop + clientHeight >= scrollHeight - 20;
	}

	function clearLogs() {
		consoleStore.clear();
	}

	function scrollToBottom() {
		if (scrollContainer) {
			scrollContainer.scrollTop = scrollContainer.scrollHeight;
			autoScroll = true;
		}
	}
</script>

<div class="console-panel">
	<div class="console-content" bind:this={scrollContainer} onscroll={handleScroll}>
		{#if logs.length === 0}
			<div class="placeholder">
				<p>Run simulation to see output</p>
				<p class="shortcut">Ctrl+Enter</p>
			</div>
		{:else}
			{#each logs as log (log.id)}
				<div class="log-entry {log.level}">
					<span class="log-message">{log.message}</span>
				</div>
			{/each}
		{/if}
	</div>
	{#if !autoScroll && logs.length > 0}
		<button class="scroll-to-bottom" onclick={scrollToBottom} aria-label="Scroll to bottom">
			<Icon name="chevron-down" size={16} />
		</button>
	{/if}
</div>

<style>
	.console-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
		overflow: hidden;
		position: relative;
	}

	.scroll-to-bottom {
		position: absolute;
		bottom: var(--space-md);
		left: 50%;
		transform: translateX(-50%);
		width: 28px;
		height: 28px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 50%;
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
		box-shadow: var(--shadow-md);
	}

	.scroll-to-bottom:hover {
		background: var(--surface-hover);
		color: var(--text);
		border-color: var(--border);
	}

	.console-content {
		flex: 1;
		overflow-y: auto;
		background: var(--surface);
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-disabled);
		font-size: 12px;
		text-align: center;
		gap: var(--space-xs);
	}

	.placeholder .shortcut {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-disabled);
		white-space: nowrap;
	}

	.log-entry,
	.log-message {
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.6;
	}

	.log-entry {
		padding: 2px var(--space-md);
		border-bottom: 1px solid var(--border);
	}

	.log-entry:hover {
		background: var(--surface-hover);
	}

	.log-entry.output {
		color: var(--text);
	}

	.log-entry.info {
		color: var(--accent);
	}

	.log-entry.warning {
		color: var(--warning);
		background: var(--warning-bg);
	}

	.log-entry.error {
		color: var(--error);
		background: var(--error-bg);
	}

	.log-message {
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
