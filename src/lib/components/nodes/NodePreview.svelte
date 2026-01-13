<script lang="ts">
	import type { NodeTypeDefinition } from '$lib/nodes/types';
	import { getShapeCssClass } from '$lib/nodes/shapes';

	interface Props {
		node: NodeTypeDefinition;
	}

	let { node }: Props = $props();

	const isSubsystemType = $derived(node.category === 'Subsystem');

	// Get shape class from unified shapes utility
	const shapeClass = $derived(() => getShapeCssClass(node));
</script>

<div class="node-preview {shapeClass()}" class:subsystem-type={isSubsystemType}>
	<span class="node-name">{node.name}</span>
</div>

<style>
	.node-preview {
		min-width: 90px;
		min-height: 36px;
		background: var(--surface-raised);
		border: 1px solid var(--edge);
		padding: 8px 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}

	.shape-pill {
		border-radius: 20px;
	}

	.shape-rect {
		border-radius: 4px;
	}

	.shape-circle {
		border-radius: 16px;
	}

	.shape-diamond {
		border-radius: 4px;
		transform: rotate(45deg);
	}

	.shape-diamond .node-name {
		transform: rotate(-45deg);
	}

	.shape-mixed {
		border-radius: 12px 4px 12px 4px;
	}

	.shape-default {
		border-radius: 8px;
	}

	.subsystem-type {
		border-style: dashed;
	}

	.node-name {
		font-weight: 600;
		font-size: 11px;
		color: var(--accent);
		white-space: nowrap;
		letter-spacing: -0.2px;
	}
</style>
