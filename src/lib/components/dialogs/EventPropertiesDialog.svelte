<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { get } from 'svelte/store';
	import { eventStore } from '$lib/stores/events';
	import { eventDialogStore, closeEventDialog } from '$lib/stores/eventDialog';
	import { eventRegistry } from '$lib/events/registry';
	import { graphStore } from '$lib/stores/graph';
	import type { EventInstance } from '$lib/events/types';
	import { generateSingleEventCode, sanitizeName } from '$lib/pyodide/pathsimRunner';
	import { codeContextStore } from '$lib/stores/codeContext';
	import { generateEventCodeHeader } from '$lib/utils/codePreviewHeader';
	import { tooltip } from '$lib/components/Tooltip.svelte';
	import { paramInput } from '$lib/actions/paramInput';
	import ColorPicker from './shared/ColorPicker.svelte';
	import DocumentationSection from './shared/DocumentationSection.svelte';
	import CodePreviewDialog from './CodePreviewDialog.svelte';
	import Icon from '$lib/components/icons/Icon.svelte';
	import { DEFAULT_NODE_COLOR } from '$lib/utils/colors';

	// Get the event from store
	let eventId = $state<string | null>(null);
	let event = $state<EventInstance | null>(null);

	eventDialogStore.subscribe((id) => {
		eventId = id;
		if (id) {
			event = eventStore.getEvent(id) || null;
		} else {
			event = null;
		}
	});

	// Keep event updated when params change
	eventStore.eventsArray.subscribe((events) => {
		if (eventId) {
			event = events.find(e => e.id === eventId) || null;
		}
	});

	// Get type definition
	const typeDef = $derived(event ? eventRegistry.get(event.type) : null);

	// Get current color for display
	const currentColor = $derived(event?.color || DEFAULT_NODE_COLOR);

	// Handle color selection
	function handleColorSelect(color: string | undefined) {
		if (!event) return;
		eventStore.updateEventColor(event.id, color);
	}

	// Code preview state
	let showCodePreview = $state(false);
	let previewCode = $state('');

	// Show event code in preview dialog
	function showEventCode() {
		if (!event) return;
		const codeContext = codeContextStore.getCode();
		const header = generateEventCodeHeader(event, codeContext);
		const eventCode = generateSingleEventCode(event);
		previewCode = header + eventCode;
		showCodePreview = true;
	}

	// Get available block variable names for reference pills
	// Shows the sanitized Python variable names that will be used in code generation
	const blockVarNames = $derived(() => {
		const nodes = get(graphStore.nodesArray);
		const varNames: string[] = [];
		const usedNames = new Set<string>();

		for (const node of nodes) {
			let varName = sanitizeName(node.name);
			if (!varName || usedNames.has(varName)) {
				varName = `block_${varNames.length}`;
			}
			usedNames.add(varName);
			varNames.push(varName);
		}
		return varNames.sort();
	});

	// Handle parameter change
	function handleParamChange(paramName: string, value: string) {
		if (!event) return;
		eventStore.updateEventParams(event.id, { [paramName]: value });
	}

	// Handle name change
	function handleNameChange(name: string) {
		if (!event) return;
		eventStore.updateEventName(event.id, name);
	}

	// Format value for display
	function formatValue(value: unknown): string {
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

	// Handle backdrop click
	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			closeEventDialog();
		}
	}

	// Handle escape key
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeEventDialog();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if eventId && event && typeDef}
	<div class="dialog-backdrop" onclick={handleBackdropClick} transition:fade={{ duration: 150 }} role="presentation">
		<div class="properties-dialog glass-panel" style="--node-color: {currentColor}" transition:scale={{ start: 0.95, duration: 150, easing: cubicOut }} role="dialog" tabindex="-1" aria-labelledby="dialog-title">
			<div class="dialog-header">
				<div class="node-info">
					<input
						id="dialog-title"
						class="node-name-input"
						type="text"
						value={event.name}
						oninput={(e) => handleNameChange(e.currentTarget.value)}
						use:paramInput
					/>
					<span class="node-type">{typeDef.name}</span>
				</div>
				<div class="header-actions">
					<!-- Color picker -->
					<ColorPicker
						currentColor={currentColor}
						defaultColor={DEFAULT_NODE_COLOR}
						onSelect={handleColorSelect}
					/>
					<!-- Show code button -->
					<button
						class="icon-btn"
						onclick={showEventCode}
						use:tooltip={"View Python Code"}
						aria-label="View Python Code"
					>
						<Icon name="braces" size={16} />
					</button>
					<button class="icon-btn" onclick={closeEventDialog} aria-label="Close">
						<Icon name="x" size={16} />
					</button>
				</div>
			</div>

			<div class="dialog-body">
				<!-- Block References -->
				{#if blockVarNames().length > 0}
					<div class="section">
						<div class="section-title">Block References</div>
						<div class="block-pills">
							{#each blockVarNames() as varName}
								<span class="block-pill">{varName}</span>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Parameters -->
				{#if typeDef.params.length > 0}
					<div class="section" class:with-separator={blockVarNames().length > 0}>
						<div class="section-title">Parameters</div>
						<div class="params-grid">
							{#each typeDef.params as param}
								{@const value = event.params[param.name]}
								{@const tooltipText = param.type === 'callable'
									? (param.description ? param.description + '. Define functions in Code Editor (E)' : 'Define functions in Code Editor (E)')
									: param.description}
								<div class="param-item">
									<label for="param-{param.name}">
										<span>{param.name}</span>
										{#if tooltipText}
											<span class="help-icon" use:tooltip={tooltipText}>?</span>
										{/if}
									</label>
									<input
										id="param-{param.name}"
										type="text"
										value={formatValue(value)}
										placeholder={formatDefault(param.default)}
										oninput={(e) => handleParamChange(param.name, e.currentTarget.value)}
										use:paramInput
									/>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="no-params">No configurable parameters</div>
				{/if}

				<!-- Documentation section -->
				<DocumentationSection docstringHtml={typeDef.docstringHtml} />
			</div>

			<div class="dialog-footer">
				<span class="hint">Events trigger actions during simulation</span>
			</div>
		</div>
	</div>
{/if}

<CodePreviewDialog
	open={showCodePreview}
	code={previewCode}
	title="Event Python Code"
	onClose={() => showCodePreview = false}
/>

<style>
	/* Uses global .properties-dialog styles from app.css */

	/* Event-specific: section separator */
	.section.with-separator {
		border-top: 1px solid var(--border);
		padding-top: var(--space-md);
		margin-left: calc(-1 * var(--space-md));
		margin-right: calc(-1 * var(--space-md));
		padding-left: var(--space-md);
		padding-right: var(--space-md);
	}

	/* Event-specific: block reference pills */
	.block-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: var(--space-xs);
	}

	.block-pill {
		padding: 4px 10px;
		font-size: 11px;
		font-family: var(--font-mono);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text-muted);
	}
</style>
