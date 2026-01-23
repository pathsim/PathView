<script lang="ts" module>
	import { writable } from 'svelte/store';

	interface TooltipState {
		text: string;
		shortcut?: string;
		maxWidth?: number;
		x: number;
		y: number;
		visible: boolean;
		position: 'bottom' | 'left' | 'right' | 'top';
	}

	export const tooltipStore = writable<TooltipState>({
		text: '',
		x: 0,
		y: 0,
		visible: false,
		position: 'bottom'
	});

	let showTimeout: ReturnType<typeof setTimeout> | null = null;
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;

	export function showTooltip(
		text: string,
		element: HTMLElement,
		position: 'bottom' | 'left' | 'right' | 'top' = 'bottom',
		shortcut?: string,
		maxWidth?: number
	) {
		if (hideTimeout) {
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}

		showTimeout = setTimeout(() => {
			const rect = element.getBoundingClientRect();
			const tooltipMaxWidth = maxWidth ?? 240;
			const tooltipHeight = 28; // Estimated height for single-line tooltip
			const margin = 8; // Gap between element and tooltip
			const padding = 8; // Minimum distance from viewport edge

			// Calculate position and check viewport bounds
			let finalPosition = position;
			let x: number, y: number;

			// Check if preferred position would overflow, flip if needed
			if (position === 'bottom' && rect.bottom + margin + tooltipHeight > window.innerHeight - padding) {
				finalPosition = 'top';
			} else if (position === 'top' && rect.top - margin - tooltipHeight < padding) {
				finalPosition = 'bottom';
			} else if (position === 'right' && rect.right + margin + tooltipMaxWidth > window.innerWidth - padding) {
				finalPosition = 'left';
			} else if (position === 'left' && rect.left - margin - tooltipMaxWidth < padding) {
				finalPosition = 'right';
			}

			// Calculate coordinates based on final position
			switch (finalPosition) {
				case 'left':
					x = rect.left - margin;
					y = rect.top + rect.height / 2;
					break;
				case 'right':
					x = rect.right + margin;
					y = rect.top + rect.height / 2;
					break;
				case 'top':
					x = rect.left + rect.width / 2;
					y = rect.top - margin;
					break;
				case 'bottom':
				default:
					x = rect.left + rect.width / 2;
					y = rect.bottom + margin;
					break;
			}

			// Clamp horizontal position to keep tooltip within viewport
			if (finalPosition === 'bottom' || finalPosition === 'top') {
				const halfWidth = tooltipMaxWidth / 2;
				if (x - halfWidth < padding) {
					x = padding + halfWidth;
				} else if (x + halfWidth > window.innerWidth - padding) {
					x = window.innerWidth - padding - halfWidth;
				}
			}

			// Clamp vertical position for left/right tooltips
			if (finalPosition === 'left' || finalPosition === 'right') {
				const halfHeight = tooltipHeight / 2;
				if (y - halfHeight < padding) {
					y = padding + halfHeight;
				} else if (y + halfHeight > window.innerHeight - padding) {
					y = window.innerHeight - padding - halfHeight;
				}
			}

			tooltipStore.set({ text, shortcut, maxWidth, x, y, visible: true, position: finalPosition });
		}, 50);
	}

	export function hideTooltip() {
		if (showTimeout) {
			clearTimeout(showTimeout);
			showTimeout = null;
		}
		hideTimeout = setTimeout(() => {
			tooltipStore.update((s) => ({ ...s, visible: false }));
		}, 50);
	}

	type TooltipParams = string | { text: string; shortcut?: string; maxWidth?: number; position?: 'bottom' | 'left' | 'right' | 'top' };

	// Svelte action for easy tooltip usage
	export function tooltip(node: HTMLElement, params: TooltipParams) {
		// SSR guard - return no-op on server
		if (typeof window === 'undefined') return { destroy: () => {} };

		let text = typeof params === 'string' ? params : params.text;
		let shortcut = typeof params === 'string' ? undefined : params.shortcut;
		let maxWidth = typeof params === 'string' ? undefined : params.maxWidth;
		let position = typeof params === 'string' ? 'bottom' : (params.position ?? 'bottom');

		function handleMouseEnter() {
			if (text) showTooltip(text, node, position, shortcut, maxWidth);
		}

		function handleMouseLeave() {
			hideTooltip();
		}

		node.addEventListener('mouseenter', handleMouseEnter);
		node.addEventListener('mouseleave', handleMouseLeave);

		return {
			update(newParams: TooltipParams) {
				// Just update the captured variables - handlers reference them via closure
				text = typeof newParams === 'string' ? newParams : newParams.text;
				shortcut = typeof newParams === 'string' ? undefined : newParams.shortcut;
				maxWidth = typeof newParams === 'string' ? undefined : newParams.maxWidth;
				position = typeof newParams === 'string' ? 'bottom' : (newParams.position ?? 'bottom');
			},
			destroy() {
				node.removeEventListener('mouseenter', handleMouseEnter);
				node.removeEventListener('mouseleave', handleMouseLeave);
				hideTooltip();
			}
		};
	}
</script>

<script lang="ts">
	let state = $state<TooltipState>({ text: '', x: 0, y: 0, visible: false, position: 'bottom' });

	tooltipStore.subscribe((s) => {
		state = s;
	});
</script>

{#if state.visible}
	<div
		class="tooltip tooltip-{state.position}"
		style="left: {state.x}px; top: {state.y}px;{state.maxWidth ? ` max-width: ${state.maxWidth}px;` : ''}"
	>
		<span class="text">{state.text}</span>
		{#if state.shortcut}
			<span class="shortcut">{state.shortcut}</span>
		{/if}
	</div>
{/if}

<style>
	.tooltip {
		position: fixed;
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 4px 8px;
		max-width: 240px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		font-size: 11px;
		color: var(--text-muted);
		pointer-events: none;
		z-index: var(--z-tooltip);
		box-shadow: var(--shadow-lg);
		animation: fadeIn var(--transition-fast) ease-out;
	}

	.shortcut {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-disabled);
		white-space: nowrap;
	}

	.tooltip-bottom {
		transform: translateX(-50%);
	}

	.tooltip-top {
		transform: translateX(-50%) translateY(-100%);
	}

	.tooltip-left {
		transform: translateX(-100%) translateY(-50%);
	}

	.tooltip-right {
		transform: translateY(-50%);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
