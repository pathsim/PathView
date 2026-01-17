<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from '$lib/components/icons/Icon.svelte';
	import {
		plotSettingsStore,
		type LineStyle,
		type MarkerStyle,
		type AxisScale
	} from '$lib/stores/plotSettings';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	// Local state bound to store
	let lineStyle = $state<LineStyle>('solid');
	let showMarkers = $state(false);
	let markerStyle = $state<MarkerStyle>('circle');
	let xAxisScale = $state<AxisScale>('linear');
	let yAxisScale = $state<AxisScale>('linear');
	let showLegend = $state(false);

	// Sync from store
	const unsubscribe = plotSettingsStore.subscribe((s) => {
		lineStyle = s.lineStyle;
		showMarkers = s.showMarkers;
		markerStyle = s.markerStyle;
		xAxisScale = s.xAxisScale;
		yAxisScale = s.yAxisScale;
		showLegend = s.showLegend;
	});

	// Update store when values change
	function updateLineStyle(value: LineStyle) {
		plotSettingsStore.setLineStyle(value);
	}

	function updateShowMarkers(value: boolean) {
		plotSettingsStore.setShowMarkers(value);
	}

	function updateMarkerStyle(value: MarkerStyle) {
		plotSettingsStore.setMarkerStyle(value);
	}

	function updateXAxisScale(value: AxisScale) {
		plotSettingsStore.setXAxisScale(value);
	}

	function updateYAxisScale(value: AxisScale) {
		plotSettingsStore.setYAxisScale(value);
	}

	function updateShowLegend(value: boolean) {
		plotSettingsStore.setShowLegend(value);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	const lineStyles: { value: LineStyle; label: string; preview: string }[] = [
		{ value: 'none', label: 'None', preview: '—' },
		{ value: 'solid', label: 'Solid', preview: '━━━' },
		{ value: 'dash', label: 'Dashed', preview: '─ ─' },
		{ value: 'dot', label: 'Dotted', preview: '···' },
		{ value: 'dashdot', label: 'Dash-dot', preview: '─·─' }
	];

	const markerStyles: { value: MarkerStyle; label: string }[] = [
		{ value: 'circle', label: 'Circle' },
		{ value: 'square', label: 'Square' },
		{ value: 'diamond', label: 'Diamond' },
		{ value: 'triangle-up', label: 'Triangle' },
		{ value: 'cross', label: 'Cross' },
		{ value: 'x', label: 'X' }
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
			aria-labelledby="plot-options-title"
		>
			<div class="dialog-header">
				<span id="plot-options-title">Plot Options</span>
				<button class="icon-btn ghost" onclick={onClose} aria-label="Close">
					<Icon name="x" size={16} />
				</button>
			</div>

			<div class="dialog-body">
				<!-- Line Style Section -->
				<div class="setting-item">
					<span class="setting-label">Line Style</span>
					<div class="pill-group">
						{#each lineStyles as style}
							<button
								class="style-pill"
								class:active={lineStyle === style.value}
								onclick={() => updateLineStyle(style.value)}
								title={style.label}
							>
								<span class="preview">{style.preview}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Markers Section -->
				<div class="setting-item">
					<span class="setting-label">Markers</span>
					<div class="pill-group">
						<button
							class="style-pill"
							class:active={!showMarkers}
							onclick={() => updateShowMarkers(false)}
						>
							None
						</button>
						{#each markerStyles as style}
							<button
								class="style-pill marker-pill"
								class:active={showMarkers && markerStyle === style.value}
								onclick={() => { updateShowMarkers(true); updateMarkerStyle(style.value); }}
								title={style.label}
							>
								<svg width="12" height="12" viewBox="0 0 14 14">
									{#if style.value === 'circle'}
										<circle cx="7" cy="7" r="4" fill="currentColor" />
									{:else if style.value === 'square'}
										<rect x="3" y="3" width="8" height="8" fill="currentColor" />
									{:else if style.value === 'diamond'}
										<polygon points="7,2 12,7 7,12 2,7" fill="currentColor" />
									{:else if style.value === 'triangle-up'}
										<polygon points="7,2 12,11 2,11" fill="currentColor" />
									{:else if style.value === 'cross'}
										<path d="M5,2 h4 v3 h3 v4 h-3 v3 h-4 v-3 h-3 v-4 h3 z" fill="currentColor" />
									{:else if style.value === 'x'}
										<path d="M2,2 L12,12 M12,2 L2,12" stroke="currentColor" stroke-width="2.5" fill="none" />
									{/if}
								</svg>
							</button>
						{/each}
					</div>
				</div>

				<!-- X-Axis Scale Section -->
				<div class="setting-item">
					<span class="setting-label">X-Axis Scale</span>
					<div class="pill-group">
						<button
							class="style-pill"
							class:active={xAxisScale === 'linear'}
							onclick={() => updateXAxisScale('linear')}
						>
							Linear
						</button>
						<button
							class="style-pill"
							class:active={xAxisScale === 'log'}
							onclick={() => updateXAxisScale('log')}
						>
							Log
						</button>
					</div>
				</div>

				<!-- Y-Axis Scale Section -->
				<div class="setting-item">
					<span class="setting-label">Y-Axis Scale</span>
					<div class="pill-group">
						<button
							class="style-pill"
							class:active={yAxisScale === 'linear'}
							onclick={() => updateYAxisScale('linear')}
						>
							Linear
						</button>
						<button
							class="style-pill"
							class:active={yAxisScale === 'log'}
							onclick={() => updateYAxisScale('log')}
						>
							Log
						</button>
					</div>
				</div>

				<!-- Display Section -->
				<div class="setting-item">
					<span class="setting-label">Legend</span>
					<div class="pill-group">
						<button
							class="style-pill"
							class:active={!showLegend}
							onclick={() => updateShowLegend(false)}
						>
							Hide
						</button>
						<button
							class="style-pill"
							class:active={showLegend}
							onclick={() => updateShowLegend(true)}
						>
							Show
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.dialog {
		width: 280px;
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

	.setting-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.setting-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}

	.pill-group {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.style-pill {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px 8px;
		min-width: 40px;
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

	.style-pill .preview {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: -0.5px;
	}

	.marker-pill {
		padding: 4px 6px;
		min-width: 28px;
	}
</style>
