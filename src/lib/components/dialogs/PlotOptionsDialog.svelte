<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from '$lib/components/icons/Icon.svelte';
	import {
		plotSettingsStore,
		createTraceId,
		DEFAULT_TRACE_SETTINGS,
		DEFAULT_BLOCK_SETTINGS,
		type LineStyle,
		type MarkerStyle,
		type PlotSettings
	} from '$lib/stores/plotSettings';
	import { getTraceColor, getAccentColor, LINE_DASH_SVG } from '$lib/plotting/core/constants';

	interface TraceInfo {
		nodeId: string;
		nodeType: 'scope' | 'spectrum';
		nodeName: string;
		signalIndex: number;
		signalLabel: string;
	}

	interface Props {
		open: boolean;
		onClose: () => void;
		traces?: TraceInfo[];
	}

	let { open, onClose, traces = [] }: Props = $props();

	// Store the entire settings for reactivity
	let settings = $state<PlotSettings>({ traces: {}, blocks: {} });

	// Sync from store - update entire settings object for reactivity
	const unsubscribe = plotSettingsStore.subscribe((s) => {
		settings = s;
	});

	onDestroy(() => {
		unsubscribe();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	// Get trace settings reactively from local state
	function getTraceSettings(traceId: string) {
		return settings.traces[traceId] ?? { ...DEFAULT_TRACE_SETTINGS };
	}

	// Get block settings reactively from local state
	function getBlockSettings(nodeId: string) {
		return settings.blocks[nodeId] ?? { ...DEFAULT_BLOCK_SETTINGS };
	}

	// Line style options
	const lineStyles: { value: LineStyle; label: string }[] = [
		{ value: 'solid', label: 'Solid' },
		{ value: 'dash', label: 'Dash' },
		{ value: 'dot', label: 'Dot' }
	];

	// Marker style options
	const markerStyles: { value: MarkerStyle; label: string }[] = [
		{ value: 'circle', label: 'Circle' },
		{ value: 'square', label: 'Square' },
		{ value: 'triangle-up', label: 'Triangle' }
	];

	// Toggle line style for a trace (clicking same = deselect)
	function toggleLineStyle(traceId: string, style: LineStyle) {
		const current = getTraceSettings(traceId);
		if (current.lineStyle === style) {
			plotSettingsStore.setTraceLineStyle(traceId, null);
		} else {
			plotSettingsStore.setTraceLineStyle(traceId, style);
		}
	}

	// Toggle marker style for a trace (clicking same = deselect)
	function toggleMarkerStyle(traceId: string, style: MarkerStyle) {
		const current = getTraceSettings(traceId);
		if (current.markerStyle === style) {
			plotSettingsStore.setTraceMarkerStyle(traceId, null);
		} else {
			plotSettingsStore.setTraceMarkerStyle(traceId, style);
		}
	}

	// Block axis scale handlers
	function toggleBlockXAxisScale(nodeId: string) {
		const current = getBlockSettings(nodeId);
		plotSettingsStore.setBlockXAxisScale(nodeId, current.xAxisScale === 'linear' ? 'log' : 'linear');
	}

	function toggleBlockYAxisScale(nodeId: string) {
		const current = getBlockSettings(nodeId);
		plotSettingsStore.setBlockYAxisScale(nodeId, current.yAxisScale === 'linear' ? 'log' : 'linear');
	}

	function toggleBlockShowLegend(nodeId: string) {
		const current = getBlockSettings(nodeId);
		plotSettingsStore.setBlockShowLegend(nodeId, !current.showLegend);
	}

	// Group traces by node for display
	const tracesByNode = $derived(() => {
		const grouped = new Map<string, TraceInfo[]>();
		for (const trace of traces) {
			const key = trace.nodeId;
			if (!grouped.has(key)) {
				grouped.set(key, []);
			}
			grouped.get(key)!.push(trace);
		}
		return grouped;
	});

	// Get dash pattern for SVG line
	function getLineDash(style: LineStyle | null): string {
		return style ? LINE_DASH_SVG[style] : '';
	}
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
			aria-labelledby="plot-options-title"
		>
			<div class="dialog-header">
				<span id="plot-options-title">Plot Options</span>
				<button class="icon-btn ghost" onclick={onClose} aria-label="Close">
					<Icon name="x" size={16} />
				</button>
			</div>

			<div class="dialog-body">
				{#if traces.length === 0}
					<div class="empty-state">
						<p>Run simulation to see trace options</p>
					</div>
				{:else}
					<!-- Blocks -->
					{#each [...tracesByNode()] as [nodeId, nodeTraces]}
						{@const firstTrace = nodeTraces[0]}
						{@const blockSettings = getBlockSettings(nodeId)}
						<div class="block-card">
							<!-- Block header -->
							<div class="block-header">
								<div class="block-title">
									<Icon name={firstTrace.nodeType === 'scope' ? 'activity' : 'bar-chart-2'} size={14} />
									<span>{firstTrace.nodeName}</span>
								</div>
								<div class="block-controls">
									<button
										class="scale-btn"
										class:active={blockSettings.showLegend}
										onclick={() => toggleBlockShowLegend(nodeId)}
										title="Show legend"
									>
										Legend
									</button>
									<button
										class="scale-btn"
										class:log={blockSettings.xAxisScale === 'log'}
										onclick={() => toggleBlockXAxisScale(nodeId)}
										title="X-Axis: {blockSettings.xAxisScale}"
									>
										X:{blockSettings.xAxisScale === 'log' ? 'log' : 'lin'}
									</button>
									<button
										class="scale-btn"
										class:log={blockSettings.yAxisScale === 'log'}
										onclick={() => toggleBlockYAxisScale(nodeId)}
										title="Y-Axis: {blockSettings.yAxisScale}"
									>
										Y:{blockSettings.yAxisScale === 'log' ? 'log' : 'lin'}
									</button>
								</div>
							</div>

							<!-- Traces table -->
							<div class="traces-table">
								<div class="table-header">
									<div class="col-preview">Preview</div>
									<div class="col-name"></div>
									<div class="col-line">Line</div>
									<div></div>
									<div class="col-marker">Marker</div>
								</div>

								{#each nodeTraces as trace}
									{@const traceId = createTraceId(trace.nodeId, trace.signalIndex)}
									{@const settings = getTraceSettings(traceId)}
									{@const color = getTraceColor(trace.signalIndex, getAccentColor())}
									<div class="trace-row">
										<div class="col-preview">
											<!-- SVG preview of line + marker -->
											<svg width="32" height="16" viewBox="0 0 32 16">
												{#if settings.lineStyle}
													<line
														x1="2" y1="8" x2="30" y2="8"
														stroke={color}
														stroke-width="2"
														stroke-dasharray={getLineDash(settings.lineStyle)}
													/>
												{/if}
												{#if settings.markerStyle}
													{#if settings.markerStyle === 'circle'}
														<circle cx="16" cy="8" r="3" fill={color} />
													{:else if settings.markerStyle === 'square'}
														<rect x="13" y="5" width="6" height="6" fill={color} />
													{:else if settings.markerStyle === 'triangle-up'}
														<polygon points="16,3 20,11 12,11" fill={color} />
													{/if}
												{/if}
												{#if !settings.lineStyle && !settings.markerStyle}
													<line x1="2" y1="8" x2="30" y2="8" stroke="var(--text-disabled)" stroke-width="1" stroke-dasharray="2,2" />
												{/if}
											</svg>
										</div>
										<div class="col-name">
											<span class="signal-label">{trace.signalLabel}</span>
										</div>
										<div class="col-line">
											{#each lineStyles as style}
												<button
													class="style-pill"
													class:active={settings.lineStyle === style.value}
													onclick={() => toggleLineStyle(traceId, style.value)}
													title={style.label}
												>
													<svg width="20" height="10" viewBox="0 0 20 10">
														<line
															x1="2" y1="5" x2="18" y2="5"
															stroke="currentColor"
															stroke-width="2"
															stroke-dasharray={getLineDash(style.value)}
														/>
													</svg>
												</button>
											{/each}
										</div>
										<div></div>
										<div class="col-marker">
											{#each markerStyles as style}
												<button
													class="style-pill marker-pill"
													class:active={settings.markerStyle === style.value}
													onclick={() => toggleMarkerStyle(traceId, style.value)}
													title={style.label}
												>
													<svg width="10" height="10" viewBox="0 0 14 14">
														{#if style.value === 'circle'}
															<circle cx="7" cy="7" r="4" fill="currentColor" />
														{:else if style.value === 'square'}
															<rect x="3" y="3" width="8" height="8" fill="currentColor" />
														{:else if style.value === 'triangle-up'}
															<polygon points="7,2 12,11 2,11" fill="currentColor" />
														{/if}
													</svg>
												</button>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.dialog {
		width: 480px;
		max-width: 90vw;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.dialog-body {
		padding: var(--space-md);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-xl);
		color: var(--text-disabled);
		font-size: 12px;
	}

	/* Block card */
	.block-card {
		flex-shrink: 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.block-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-raised);
		border-bottom: 1px solid var(--border);
	}

	.block-title {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: 12px;
		font-weight: 500;
		color: var(--text-muted);
	}

	.block-controls {
		display: flex;
		gap: 4px;
	}

	.scale-btn {
		padding: 4px 8px;
		font-size: 10px;
		font-weight: 500;
		font-family: var(--font-mono);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.scale-btn:hover {
		background: var(--surface-hover);
		color: var(--text);
	}

	.scale-btn.log,
	.scale-btn.active {
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		color: var(--accent);
	}

	.scale-btn.log:hover,
	.scale-btn.active:hover {
		background: color-mix(in srgb, var(--accent) 25%, transparent);
	}

	/* Traces table */
	.traces-table {
		display: flex;
		flex-direction: column;
	}

	.table-header {
		display: grid;
		grid-template-columns: auto 1fr 90px 24px 78px;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-disabled);
		border-bottom: 1px solid var(--border-subtle);
	}

	.trace-row {
		display: grid;
		grid-template-columns: auto 1fr 90px 24px 78px;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		align-items: center;
	}

	.trace-row:not(:last-child) {
		border-bottom: 1px solid var(--border-subtle);
	}

	.col-preview {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.col-name {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.signal-label {
		font-size: 11px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.col-line {
		display: flex;
		gap: var(--space-xs);
	}

	.col-marker {
		display: flex;
		gap: var(--space-xs);
	}

	/* Pills */
	.style-pill {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px 6px;
		min-width: 28px;
		height: 24px;
		font-size: 10px;
		font-weight: 500;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.style-pill:hover {
		background: var(--surface-hover);
		border-color: var(--border-focus);
		color: var(--text);
	}

	.style-pill.active {
		background: color-mix(in srgb, var(--accent) 15%, var(--surface-raised));
		border-color: var(--accent);
		color: var(--accent);
	}

	.marker-pill {
		min-width: 24px;
	}
</style>
