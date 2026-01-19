<script lang="ts">
	import type { EventInstance } from '$lib/events/types';
	import { eventRegistry } from '$lib/events/registry';
	import { openEventDialog } from '$lib/stores/eventDialog';

	interface Props {
		id: string;
		data: EventInstance;
		selected?: boolean;
	}

	let { id, data, selected = false }: Props = $props();

	// Get type definition
	const typeDef = $derived(eventRegistry.get(data.type));

	// Event color - use custom color or default PathSim blue
	const eventColor = $derived(data.color || 'var(--accent)');

	// Handle double-click to open event properties dialog
	function handleDoubleClick(event: MouseEvent) {
		event.stopPropagation();
		openEventDialog(id);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="event-node"
	class:selected
	style="--event-color: {eventColor};"
	ondblclick={handleDoubleClick}
>
	<!-- Diamond shape container -->
	<div class="diamond" ondblclick={handleDoubleClick}>
		<div class="diamond-inner">
			<span class="event-name">{data.name}</span>
			{#if typeDef}
				<span class="event-type">{typeDef.name}</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.event-node {
		position: relative;
		/* Center event on its position point (center = local origin) */
		transform: translate(-50%, -50%);
		cursor: pointer;
	}

	.diamond {
		width: 80px;
		height: 80px;
		background: var(--surface-raised);
		border: 1px solid var(--edge);
		transform: rotate(45deg);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.diamond-inner {
		transform: rotate(-45deg);
		text-align: center;
		padding: 8px;
		width: 70px;
		pointer-events: none;
	}

	.event-name {
		display: block;
		font-weight: 600;
		font-size: 10px;
		color: var(--event-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: -0.2px;
	}

	.event-type {
		display: block;
		font-size: 8px;
		color: var(--text-muted);
		margin-top: 2px;
	}

	/* Selection state */
	.event-node.selected .diamond {
		border-color: var(--event-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--event-color) 25%, transparent);
	}
</style>
