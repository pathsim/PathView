<script lang="ts">
	import type { EventTypeDefinition } from '$lib/events/types';

	interface Props {
		event: EventTypeDefinition;
	}

	let { event }: Props = $props();
</script>

<div class="event-preview-wrapper">
	<div class="event-preview">
		<span class="event-name">{event.name}</span>
	</div>
</div>

<style>
	.event-preview-wrapper {
		/* Account for rotated content */
		padding: 12px;
	}

	.event-preview {
		width: 64px;
		height: 64px;
		background: var(--surface-raised);
		border: 1px solid var(--edge);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transform: rotate(45deg);
		transition: all 0.15s ease;
	}

	.event-name {
		font-weight: 600;
		font-size: 10px;
		color: var(--accent);
		white-space: nowrap;
		letter-spacing: -0.2px;
		transform: rotate(-45deg);
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
