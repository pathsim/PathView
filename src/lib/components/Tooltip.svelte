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
			let x: number, y: number;

			switch (position) {
				case 'left':
					x = rect.left - 8;
					y = rect.top + rect.height / 2;
					break;
				case 'right':
					x = rect.right + 8;
					y = rect.top + rect.height / 2;
					break;
				case 'top':
					x = rect.left + rect.width / 2;
					y = rect.top - 8;
					break;
				case 'bottom':
				default:
					x = rect.left + rect.width / 2;
					y = rect.bottom + 8;
					break;
			}

			tooltipStore.set({ text, shortcut, maxWidth, x, y, visible: true, position });
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
		z-index: 10000;
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
