<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Handle, Position, useUpdateNodeInternals } from '@xyflow/svelte';
	import { nodeRegistry, type NodeInstance } from '$lib/nodes';
	import { getShapeCssClass, isSubsystem } from '$lib/nodes/shapes/index';
	import { NODE_TYPES } from '$lib/constants/nodeTypes';
	import { openNodeDialog } from '$lib/stores/nodeDialog';
	import { graphStore } from '$lib/stores/graph';
	import { historyStore } from '$lib/stores/history';
	import { pinnedPreviewsStore } from '$lib/stores/pinnedPreviews';
	import { hoveredHandle, selectedNodeHighlight } from '$lib/stores/hoveredHandle';
	import { showTooltip, hideTooltip } from '$lib/components/Tooltip.svelte';
	import { paramInput } from '$lib/actions/paramInput';
	import { plotDataStore } from '$lib/plotting/processing/plotDataStore';
	import { NODE, getPortPositionCalc, calculateNodeDimensions, snapTo2G } from '$lib/constants/dimensions';
	import { containsMath, renderInlineMath, renderInlineMathSync, measureRenderedMath, getBaselineTextHeight } from '$lib/utils/inlineMathRenderer';
	import { getKatexCssUrl } from '$lib/utils/katexLoader';
	import PlotPreview from './PlotPreview.svelte';

	interface Props {
		id: string;
		data: NodeInstance;
		selected?: boolean;
	}

	let { id, data, selected = false }: Props = $props();

	// Get SvelteFlow hook to trigger re-measurement when node size changes
	const updateNodeInternals = useUpdateNodeInternals();

	// Get type definition
	const typeDef = $derived(nodeRegistry.get(data.type));
	const category = $derived(typeDef?.category || 'Algebraic');

	// Get valid pinned params (filter out any that no longer exist in the type definition)
	// Defined early since it's needed for dimension calculations
	const validPinnedParams = $derived(() => {
		if (!data.pinnedParams?.length || !typeDef) return [];
		const paramNames = new Set(typeDef.params.map(p => p.name));
		return data.pinnedParams.filter(name => paramNames.has(name));
	});

	// Recording node hover preview
	const isRecordingNode = $derived(category === 'Recording');
	let isHovered = $state(false);
	let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
	let hasPreloaded = $state(false); // Keep mounted once preloaded
	let showPreview = $state(false); // Control visibility
	let previewsPinned = $state(false);
	let hasPlotData = $state(false);

	const unsubscribePinned = pinnedPreviewsStore.subscribe((pinned) => {
		previewsPinned = pinned;
	});

	// Check if this node has plot data (from centralized store)
	const unsubscribePlotData = plotDataStore.subscribe((state) => {
		hasPlotData = state.plots.has(id);
	});

	onDestroy(() => {
		unsubscribePinned();
		unsubscribePlotData();
		if (hoverTimeout) clearTimeout(hoverTimeout);
	});

	// Sync hasPreloaded when pinned (so unpinning keeps cache)
	$effect(() => {
		if (previewsPinned && hasPlotData) {
			hasPreloaded = true;
		}
	});

	function handleMouseEnter() {
		if (!isRecordingNode) return;
		isHovered = true;
		// Simple delay before showing preview
		hoverTimeout = setTimeout(() => {
			if (isHovered) {
				hasPreloaded = true;
				showPreview = true;
			}
		}, 300);
	}

	function handleMouseLeave() {
		isHovered = false;
		showPreview = false;
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
	}

	// Math rendering for node names with $...$ LaTeX
	const nameHasMath = $derived(containsMath(data.name));
	let renderedNameHtml = $state<string | null>(null);
	let measuredNameWidth = $state<number | null>(null);
	let measuredNameHeight = $state<number | null>(null);

	// Render math when name contains $...$
	$effect(() => {
		if (nameHasMath) {
			// Try sync first (cached)
			const cached = renderInlineMathSync(data.name);
			if (cached) {
				renderedNameHtml = cached.html;
				const dims = measureRenderedMath(cached.html);
				measuredNameWidth = dims.width;
				measuredNameHeight = dims.height;
				// Tell SvelteFlow to re-measure node from DOM
				updateNodeInternals(id);
			} else {
				// Render async
				renderInlineMath(data.name).then((result) => {
					renderedNameHtml = result.html;
					const dims = measureRenderedMath(result.html);
					measuredNameWidth = dims.width;
					measuredNameHeight = dims.height;
					// Tell SvelteFlow to re-measure node from DOM
					updateNodeInternals(id);
				});
			}
		} else {
			renderedNameHtml = null;
			measuredNameWidth = null;
			measuredNameHeight = null;
		}
	});

	// Check if this node allows dynamic ports
	const allowsDynamicInputs = $derived(typeDef?.ports.maxInputs === null);
	const allowsDynamicOutputs = $derived(typeDef?.ports.maxOutputs === null);
	const syncPorts = $derived(typeDef?.ports.syncPorts ?? false);

	// Rotation state (0, 1, 2, 3 = 0°, 90°, 180°, 270°) - stored in node params
	const rotation = $derived((data.params?.['_rotation'] as number) || 0);

	// Calculate actual port positions based on rotation
	// 0: inputs left, outputs right (default)
	// 1: inputs top, outputs bottom
	// 2: inputs right, outputs left
	// 3: inputs bottom, outputs top
	const inputPosition = $derived(() => {
		switch (rotation) {
			case 1: return Position.Top;
			case 2: return Position.Right;
			case 3: return Position.Bottom;
			default: return Position.Left;
		}
	});

	const outputPosition = $derived(() => {
		switch (rotation) {
			case 1: return Position.Bottom;
			case 2: return Position.Left;
			case 3: return Position.Top;
			default: return Position.Right;
		}
	});

	// Port is horizontal (left/right) or vertical (top/bottom)
	const isVertical = $derived(rotation === 1 || rotation === 3);

	// Preview position: opposite side of inputs
	// rotation 0: inputs left → preview right
	// rotation 1: inputs top → preview bottom
	// rotation 2: inputs right → preview left
	// rotation 3: inputs bottom → preview top
	const previewPosition = $derived(() => {
		switch (rotation) {
			case 1: return 'bottom';
			case 2: return 'left';
			case 3: return 'top';
			default: return 'right';
		}
	});

	const maxPortsOnSide = $derived(Math.max(data.inputs.length, data.outputs.length));
	const pinnedCount = $derived(validPinnedParams().length);

	// Node dimensions - calculated from shared utility (same as SvelteFlow bounds)
	const nodeDimensions = $derived(calculateNodeDimensions(
		data.name,
		data.inputs.length,
		data.outputs.length,
		pinnedCount,
		rotation,
		typeDef?.name
	));
	// Use measured width if math is rendered and measured, otherwise use calculated
	const nodeWidth = $derived(() => {
		if (measuredNameWidth !== null && nameHasMath) {
			// For math names, use measured width instead of string-length estimate
			// But still respect minimum width needed for ports, pinned params, type label
			const isVertical = rotation === 1 || rotation === 3;
			const maxPortsOnSide = Math.max(data.inputs.length, data.outputs.length);
			const minPortDimension = Math.max(1, maxPortsOnSide) * NODE.portSpacing;
			const typeWidth = typeDef ? typeDef.name.length * 5 + 20 : 0;
			const pinnedParamsWidth = pinnedCount > 0 ? 160 : 0;

			// Minimum width for layout (without name string-length estimate)
			const minLayoutWidth = snapTo2G(Math.max(
				NODE.baseWidth,
				typeWidth,
				pinnedParamsWidth,
				isVertical ? minPortDimension : 0
			));

			// Add horizontal padding from .node-content (12px each side = 24px)
			const measuredMathWidth = snapTo2G(measuredNameWidth + 24);
			return Math.max(minLayoutWidth, measuredMathWidth);
		}
		return nodeDimensions.width;
	});

	// Height calculation - only override for tall math (like \displaystyle)
	// Compare measured math height to baseline text height for robustness
	const nodeHeight = $derived(() => {
		if (measuredNameHeight !== null && nameHasMath) {
			// Get baseline height of standard text - only grow if math is significantly taller
			const baselineHeight = getBaselineTextHeight();
			if (measuredNameHeight > baselineHeight * 1.2) {
				const isVertical = rotation === 1 || rotation === 3;
				const maxPortsOnSide = Math.max(data.inputs.length, data.outputs.length);
				const minPortDimension = Math.max(1, maxPortsOnSide) * NODE.portSpacing;

				// Pinned params height: border(1) + padding(10) + rows(24 each)
				const pinnedParamsHeight = pinnedCount > 0 ? 7 + 24 * pinnedCount : 0;

				// Content height: math height + type label (12px) + padding (12px)
				const contentHeight = measuredNameHeight + 24 + pinnedParamsHeight;

				return isVertical
					? snapTo2G(contentHeight)
					: snapTo2G(Math.max(contentHeight, minPortDimension));
			}
		}
		return nodeDimensions.height;
	});

	// Check if this is a Subsystem or Interface node (using shapes utility)
	const isSubsystemNode = $derived(isSubsystem(data));
	const isInterfaceNode = $derived(data.type === NODE_TYPES.INTERFACE);
	const isSubsystemType = $derived(isSubsystemNode || isInterfaceNode);

	// Handle double-click to open properties dialog or drill into subsystem
	function handleDoubleClick(event: MouseEvent) {
		event.stopPropagation();
		if (isSubsystemNode) {
			// Drill down into subsystem
			graphStore.drillDown(id);
		} else {
			openNodeDialog(id);
		}
	}

	// Add input port
	function handleAddInput(event: MouseEvent) {
		event.stopPropagation();
		historyStore.mutate(() => graphStore.addInputPort(id));
	}

	// Get min ports from type definition
	const minInputs = $derived(typeDef?.ports.minInputs ?? 1);
	const minOutputs = $derived(typeDef?.ports.minOutputs ?? 1);

	// Remove input port (respects minInputs)
	function handleRemoveInput(event: MouseEvent) {
		event.stopPropagation();
		if (data.inputs.length > minInputs) {
			historyStore.mutate(() => graphStore.removeInputPort(id));
		}
	}

	// Add output port
	function handleAddOutput(event: MouseEvent) {
		event.stopPropagation();
		historyStore.mutate(() => graphStore.addOutputPort(id));
	}

	// Remove output port (respects minOutputs)
	function handleRemoveOutput(event: MouseEvent) {
		event.stopPropagation();
		if (data.outputs.length > minOutputs) {
			historyStore.mutate(() => graphStore.removeOutputPort(id));
		}
	}

	// Get shape class from unified shapes utility
	const shapeClass = $derived(() => typeDef ? getShapeCssClass(typeDef) : 'shape-default');

	// Custom node color (defaults to pathsim-blue)
	const nodeColor = $derived(data.color || 'var(--accent)');

	// Handle pinned param change
	function handlePinnedParamChange(paramName: string, value: string) {
		historyStore.mutate(() => graphStore.updateNodeParams(id, { [paramName]: value }));
	}

	// Format value for display
	function formatParamValue(value: unknown): string {
		if (value === null || value === undefined) return '';
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}

	// Format default value for placeholder (Python style)
	function formatDefault(value: unknown): string {
		if (value === null || value === undefined) return 'None';
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}

	// Tooltip position for input handles (show tooltip away from node)
	function getInputTooltipPosition(): 'bottom' | 'left' | 'right' | 'top' {
		switch (rotation) {
			case 1: return 'top';    // inputs on top → tooltip above
			case 2: return 'right';  // inputs on right → tooltip to right
			case 3: return 'bottom'; // inputs on bottom → tooltip below
			default: return 'left';  // inputs on left → tooltip to left
		}
	}

	// Tooltip position for output handles (show tooltip away from node)
	function getOutputTooltipPosition(): 'bottom' | 'left' | 'right' | 'top' {
		switch (rotation) {
			case 1: return 'bottom'; // outputs on bottom → tooltip below
			case 2: return 'left';   // outputs on left → tooltip to left
			case 3: return 'top';    // outputs on top → tooltip above
			default: return 'right'; // outputs on right → tooltip to right
		}
	}

	// Handle mouse events for input handles
	function handleInputMouseEnter(event: MouseEvent, port: { id: string; name: string }) {
		hoveredHandle.set({ nodeId: id, handleId: port.id, color: nodeColor });
		showTooltip(port.name, event.currentTarget as HTMLElement, getInputTooltipPosition());
	}

	function handleInputMouseLeave(port: { id: string }) {
		hoveredHandle.set(null);
		hideTooltip();
	}

	// Handle mouse events for output handles
	function handleOutputMouseEnter(event: MouseEvent, port: { id: string; name: string }) {
		hoveredHandle.set({ nodeId: id, handleId: port.id, color: nodeColor });
		showTooltip(port.name, event.currentTarget as HTMLElement, getOutputTooltipPosition());
	}

	function handleOutputMouseLeave(port: { id: string }) {
		hoveredHandle.set(null);
		hideTooltip();
	}

	// Highlight connected edges when node is selected
	$effect(() => {
		if (selected) {
			selectedNodeHighlight.set({ nodeId: id, color: nodeColor });
		} else {
			selectedNodeHighlight.update((current) => {
				if (current?.nodeId === id) return null;
				return current;
			});
		}
	});
</script>

<!-- Load KaTeX CSS for math rendering in node names -->
<svelte:head>
	<link rel="stylesheet" href={getKatexCssUrl()} />
</svelte:head>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="node {shapeClass()}"
	class:selected
	class:vertical={isVertical}
	class:preview-hovered={showPreview}
	class:subsystem-type={isSubsystemType}
	data-rotation={rotation}
	style="width: {nodeWidth()}px; height: {nodeHeight()}px; --node-color: {nodeColor};"
	ondblclick={handleDoubleClick}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
>
	<!-- Plot preview for recording nodes -->
	{#if (hasPreloaded || previewsPinned) && hasPlotData}
		<div
			class="plot-preview-popup preview-{previewPosition()}"
			class:visible={showPreview || previewsPinned}
		>
			<PlotPreview nodeId={id} />
		</div>
	{/if}

	<!-- Glow effect for selected state -->
	{#if selected}
		<div class="selection-glow"></div>
	{/if}

	<!-- Inner wrapper for content clipping -->
	<div class="node-inner">
		<!-- Node content -->
		<div class="node-content">
			{#if renderedNameHtml}
				<span class="node-name">{@html renderedNameHtml}</span>
			{:else}
				<span class="node-name">{data.name}</span>
			{/if}
			{#if typeDef}
				<span class="node-type">{typeDef.name}</span>
			{/if}
		</div>

		<!-- Pinned parameters -->
		{#if validPinnedParams().length > 0 && typeDef}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="pinned-params" onclick={(e) => e.stopPropagation()} ondblclick={(e) => e.stopPropagation()}>
				{#each validPinnedParams() as paramName}
					{@const paramDef = typeDef.params.find(p => p.name === paramName)}
					{#if paramDef}
						<div class="pinned-param">
							<label for="pinned-{id}-{paramName}">{paramName}</label>
							<input
								id="pinned-{id}-{paramName}"
								type="text"
								value={formatParamValue(data.params[paramName])}
								placeholder={formatDefault(paramDef.default)}
								oninput={(e) => handlePinnedParamChange(paramName, e.currentTarget.value)}
								onmousedown={(e) => e.stopPropagation()}
								onfocus={(e) => e.stopPropagation()}
								use:paramInput
							/>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<!-- Port controls for dynamic inputs (only show when selected) -->
	{#if allowsDynamicInputs && selected}
		<div class="port-controls port-controls-input" class:port-controls-left={rotation === 0} class:port-controls-top={rotation === 1} class:port-controls-right={rotation === 2} class:port-controls-bottom={rotation === 3}>
			<button class="port-btn" onclick={handleAddInput} ondblclick={(e) => e.stopPropagation()} title="Add input">+</button>
			<button class="port-btn" onclick={handleRemoveInput} ondblclick={(e) => e.stopPropagation()} disabled={data.inputs.length <= minInputs} title="Remove input">-</button>
		</div>
	{/if}

	<!-- Port controls for dynamic outputs (only show when selected, hide for syncPorts blocks) -->
	{#if allowsDynamicOutputs && selected && !syncPorts}
		<div class="port-controls port-controls-output" class:port-controls-right={rotation === 0} class:port-controls-bottom={rotation === 1} class:port-controls-left={rotation === 2} class:port-controls-top={rotation === 3}>
			<button class="port-btn" onclick={handleAddOutput} ondblclick={(e) => e.stopPropagation()} title="Add output">+</button>
			<button class="port-btn" onclick={handleRemoveOutput} ondblclick={(e) => e.stopPropagation()} disabled={data.outputs.length <= minOutputs} title="Remove output">-</button>
		</div>
	{/if}

	<!-- Input handles -->
	{#key `${rotation}-${data.inputs.length}`}
		{#each data.inputs as port, i}
			<Handle
				type="target"
				position={inputPosition()}
				id={port.id}
				style={isVertical ? `left: ${getPortPositionCalc(i, data.inputs.length)};` : `top: ${getPortPositionCalc(i, data.inputs.length)};`}
				class="handle handle-input"
				onmouseenter={(e) => handleInputMouseEnter(e, port)}
				onmouseleave={() => handleInputMouseLeave(port)}
			/>
		{/each}
	{/key}

	<!-- Output handles -->
	{#key `${rotation}-${data.outputs.length}`}
		{#each data.outputs as port, i}
			<Handle
				type="source"
				position={outputPosition()}
				id={port.id}
				style={isVertical ? `left: ${getPortPositionCalc(i, data.outputs.length)};` : `top: ${getPortPositionCalc(i, data.outputs.length)};`}
				class="handle handle-output"
				onmouseenter={(e) => handleOutputMouseEnter(e, port)}
				onmouseleave={() => handleOutputMouseLeave(port)}
			/>
		{/each}
	{/key}
</div>

<style>
	.node {
		position: relative;
		/* Dimensions set via inline style using grid constants */
		/* Note: center-origin handled by SvelteFlow's nodeOrigin={[0.5, 0.5]} */
		display: flex;
		flex-direction: column;
		background: var(--surface-raised);
		border: 1px solid var(--edge);
		font-size: 10px;
		overflow: visible;
	}

	/* Shape variants */
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

	.shape-diamond .node-content {
		transform: rotate(-45deg);
	}

	.shape-mixed {
		border-radius: 12px 4px 12px 4px;
	}

	.shape-default {
		border-radius: 8px;
	}

	/* Subsystem/Interface dashed border */
	.node.subsystem-type {
		border-style: dashed;
	}

	/* Selection state */
	.node.selected {
		border-color: var(--node-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--node-color) 25%, transparent);
	}

	.selection-glow {
		display: none;
	}

	/* Bring node to front when preview is hovered */
	:global(.svelte-flow__node:has(.preview-hovered)) {
		z-index: 1000 !important;
	}

	/* Inner wrapper for content - fills node, clips to rounded corners */
	.node-inner {
		flex: 1;
		display: flex;
		flex-direction: column;
		border-radius: inherit;
		overflow: hidden;
		min-height: 0;
	}

	/* Content - centered in available space */
	.node-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 6px 12px;
		text-align: center;
		line-height: 1.2;
		min-width: 0;
		overflow: hidden;
	}

	.node-name {
		display: block;
		font-weight: 600;
		font-size: 10px;
		color: var(--node-color);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: -0.2px;
	}

	/* KaTeX math rendering in node names */
	.node-name:has(:global(.katex)) {
		overflow: visible;
		text-overflow: clip;
	}

	.node-name :global(.katex) {
		font-size: 1em;
		font-weight: 600;
		color: inherit;
	}

	.node-name :global(.katex-html) {
		white-space: nowrap;
	}

	.node-name :global(.math-error) {
		color: var(--error);
		font-family: var(--font-mono);
		font-size: 0.9em;
	}

	.node-type {
		display: block;
		font-size: 8px;
		color: var(--text-muted);
		margin-top: 2px;
	}

	/* Pinned parameters */
	.pinned-params {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 4px 10px 6px;
		border-top: 1px solid var(--border);
		background: var(--surface);
	}

	.pinned-param {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.pinned-param label {
		flex-shrink: 0;
		font-size: 8px;
		color: var(--text-disabled);
		max-width: 50px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pinned-param input {
		flex: 1;
		min-width: 0;
		height: 20px;
		padding: 2px 8px;
		font-size: 8px;
		font-family: var(--font-mono);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text);
		transition: all var(--transition-fast);
	}

	.pinned-param input:hover {
		border-color: var(--border-focus);
	}

	.pinned-param input:focus {
		outline: none;
		border-color: var(--node-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--node-color) 20%, transparent);
	}

	.pinned-param input::placeholder {
		color: var(--text-muted);
	}

	/* Port controls (+/- buttons) */
	.port-controls {
		position: absolute;
		display: flex;
		gap: 2px;
		z-index: 10;
	}

	.port-controls-left {
		left: -24px;
		top: 50%;
		transform: translateY(-50%);
		flex-direction: column;
	}

	.port-controls-right {
		right: -24px;
		top: 50%;
		transform: translateY(-50%);
		flex-direction: column;
	}

	.port-controls-top {
		top: -24px;
		left: 50%;
		transform: translateX(-50%);
		flex-direction: row;
	}

	.port-controls-bottom {
		bottom: -24px;
		left: 50%;
		transform: translateX(-50%);
		flex-direction: row;
	}

	.port-btn {
		width: 16px;
		height: 16px;
		padding: 0;
		border: 1px solid var(--node-color);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--node-color);
		font-size: 12px;
		font-weight: 600;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.port-btn:hover:not(:disabled) {
		background: var(--node-color);
		color: var(--surface-raised);
	}

	.port-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* Handles - Hollow arrow/pentagon shape with rounded corners */
	:global(.node .svelte-flow__handle) {
		width: 10px;
		height: 8px;
		background: transparent;
		border: none;
		border-radius: 0;
	}

	/* Outer shape (the border) - rounded pentagon */
	:global(.node .svelte-flow__handle::before) {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--edge);
		clip-path: path('M 1.00 0.00 L 5.00 0.00 Q 6.00 0.00 6.71 0.71 L 9.29 3.29 Q 10.00 4.00 9.29 4.71 L 6.71 7.29 Q 6.00 8.00 5.00 8.00 L 1.00 8.00 Q 0.00 8.00 0.00 7.00 L 0.00 1.00 Q 0.00 0.00 1.00 0.00 Z');
		transition: background 0.15s ease, filter 0.15s ease;
	}

	/* Inner cutout (makes it hollow) - generated by scripts/generate-handle-paths.js */
	:global(.node .svelte-flow__handle::after) {
		content: '';
		position: absolute;
		inset: 1px;
		background: var(--surface-raised);
		clip-path: path('M 0.80 0.00 L 3.79 0.00 Q 4.59 0.00 5.15 0.57 L 7.02 2.43 Q 7.59 3.00 7.02 3.57 L 5.15 5.43 Q 4.59 6.00 3.79 6.00 L 0.80 6.00 Q 0.00 6.00 0.00 5.20 L 0.00 0.80 Q 0.00 0.00 0.80 0.00 Z');
	}

	:global(.node .svelte-flow__handle:hover::before),
	:global(.node.selected .svelte-flow__handle::before) {
		background: var(--node-color);
		filter: drop-shadow(0 0 2px var(--node-color));
	}

	:global(.node .svelte-flow__handle:hover::after),
	:global(.node.selected .svelte-flow__handle::after) {
		display: none;
	}

	:global(.node .svelte-flow__handle.connecting::before) {
		background: var(--accent);
		filter: drop-shadow(0 0 3px var(--accent));
	}

	:global(.node .svelte-flow__handle.connecting::after) {
		display: none;
	}

	/* Arrow pointing right (rotation 0 - default) */
	:global(.node[data-rotation="0"] .svelte-flow__handle::before) {
		clip-path: path('M 1.00 0.00 L 5.00 0.00 Q 6.00 0.00 6.71 0.71 L 9.29 3.29 Q 10.00 4.00 9.29 4.71 L 6.71 7.29 Q 6.00 8.00 5.00 8.00 L 1.00 8.00 Q 0.00 8.00 0.00 7.00 L 0.00 1.00 Q 0.00 0.00 1.00 0.00 Z');
	}
	:global(.node[data-rotation="0"] .svelte-flow__handle::after) {
		clip-path: path('M 0.80 0.00 L 3.79 0.00 Q 4.59 0.00 5.15 0.57 L 7.02 2.43 Q 7.59 3.00 7.02 3.57 L 5.15 5.43 Q 4.59 6.00 3.79 6.00 L 0.80 6.00 Q 0.00 6.00 0.00 5.20 L 0.00 0.80 Q 0.00 0.00 0.80 0.00 Z');
	}

	/* Arrow pointing down (rotation 1) */
	:global(.node[data-rotation="1"] .svelte-flow__handle) {
		width: 8px;
		height: 10px;
	}
	:global(.node[data-rotation="1"] .svelte-flow__handle::before) {
		clip-path: path('M 1.00 0.00 L 7.00 0.00 Q 8.00 0.00 8.00 1.00 L 8.00 5.00 Q 8.00 6.00 7.29 6.71 L 4.71 9.29 Q 4.00 10.00 3.29 9.29 L 0.71 6.71 Q 0.00 6.00 0.00 5.00 L 0.00 1.00 Q 0.00 0.00 1.00 0.00 Z');
	}
	:global(.node[data-rotation="1"] .svelte-flow__handle::after) {
		clip-path: path('M 0.80 0.00 L 5.20 0.00 Q 6.00 0.00 6.00 0.80 L 6.00 3.79 Q 6.00 4.59 5.43 5.15 L 3.57 7.02 Q 3.00 7.59 2.43 7.02 L 0.57 5.15 Q 0.00 4.59 0.00 3.79 L 0.00 0.80 Q 0.00 0.00 0.80 0.00 Z');
	}

	/* Arrow pointing left (rotation 2) */
	:global(.node[data-rotation="2"] .svelte-flow__handle::before) {
		clip-path: path('M 5.00 0.00 L 9.00 0.00 Q 10.00 0.00 10.00 1.00 L 10.00 7.00 Q 10.00 8.00 9.00 8.00 L 5.00 8.00 Q 4.00 8.00 3.29 7.29 L 0.71 4.71 Q 0.00 4.00 0.71 3.29 L 3.29 0.71 Q 4.00 0.00 5.00 0.00 Z');
	}
	:global(.node[data-rotation="2"] .svelte-flow__handle::after) {
		clip-path: path('M 4.21 0.00 L 7.20 0.00 Q 8.00 0.00 8.00 0.80 L 8.00 5.20 Q 8.00 6.00 7.20 6.00 L 4.21 6.00 Q 3.41 6.00 2.85 5.43 L 0.98 3.57 Q 0.41 3.00 0.98 2.43 L 2.85 0.57 Q 3.41 0.00 4.21 0.00 Z');
	}

	/* Arrow pointing up (rotation 3) */
	:global(.node[data-rotation="3"] .svelte-flow__handle) {
		width: 8px;
		height: 10px;
	}
	:global(.node[data-rotation="3"] .svelte-flow__handle::before) {
		clip-path: path('M 4.71 0.71 L 7.29 3.29 Q 8.00 4.00 8.00 5.00 L 8.00 9.00 Q 8.00 10.00 7.00 10.00 L 1.00 10.00 Q 0.00 10.00 0.00 9.00 L 0.00 5.00 Q 0.00 4.00 0.71 3.29 L 3.29 0.71 Q 4.00 0.00 4.71 0.71 Z');
	}
	:global(.node[data-rotation="3"] .svelte-flow__handle::after) {
		clip-path: path('M 3.57 0.98 L 5.43 2.85 Q 6.00 3.41 6.00 4.21 L 6.00 7.20 Q 6.00 8.00 5.20 8.00 L 0.80 8.00 Q 0.00 8.00 0.00 7.20 L 0.00 4.21 Q 0.00 3.41 0.57 2.85 L 2.43 0.98 Q 3.00 0.41 3.57 0.98 Z');
	}

	/* Plot preview popup - base styles */
	.plot-preview-popup {
		position: absolute;
		z-index: 1000;
		pointer-events: none;
		opacity: 0;
		visibility: hidden;
	}

	.plot-preview-popup.visible {
		opacity: 1;
		visibility: visible;
		animation: fadeIn 0.15s ease-out;
	}

	/* Preview position: right (default, inputs on left) */
	.plot-preview-popup.preview-right {
		left: calc(100% + 12px);
		top: 50%;
		transform: translateY(-50%);
	}

	/* Preview position: left (inputs on right) */
	.plot-preview-popup.preview-left {
		right: calc(100% + 12px);
		top: 50%;
		transform: translateY(-50%);
	}

	/* Preview position: top (inputs on bottom) */
	.plot-preview-popup.preview-top {
		bottom: calc(100% + 12px);
		left: 50%;
		transform: translateX(-50%);
	}

	/* Preview position: bottom (inputs on top) */
	.plot-preview-popup.preview-bottom {
		top: calc(100% + 12px);
		left: 50%;
		transform: translateX(-50%);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
