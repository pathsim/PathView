<script lang="ts">
	import { tooltip } from '$lib/components/Tooltip.svelte';
	import { DIALOG_COLOR_PALETTE, DEFAULT_NODE_COLOR } from '$lib/utils/colors';

	interface Props {
		currentColor: string;
		defaultColor?: string;
		onSelect: (color: string | undefined) => void;
		popupPosition?: 'bottom' | 'top';
		iconColor?: string;
		iconSize?: number;
		variant?: 'default' | 'ghost';
	}

	let { currentColor, defaultColor = DEFAULT_NODE_COLOR, onSelect, popupPosition = 'bottom', iconColor, iconSize = 16, variant = 'default' }: Props = $props();

	let isOpen = $state(false);

	function toggle() {
		isOpen = !isOpen;
	}

	function handleSelect(color: string) {
		// If selecting default color, pass undefined to reset
		if (color === defaultColor) {
			onSelect(undefined);
		} else {
			onSelect(color);
		}
		isOpen = false;
	}

	function handleCustomColor(event: Event) {
		const input = event.target as HTMLInputElement;
		onSelect(input.value);
	}

	// Close when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.color-picker-wrapper')) {
			isOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="color-picker-wrapper">
	<button class="picker-btn" class:ghost={variant === 'ghost'} onclick={toggle} aria-label="Change color" use:tooltip={"Color"}>
		<svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor || 'currentColor'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="12" cy="12" r="10"/>
			<circle cx="8" cy="10" r="1.5" fill={iconColor || 'currentColor'}/>
			<circle cx="12" cy="7" r="1.5" fill={iconColor || 'currentColor'}/>
			<circle cx="16" cy="10" r="1.5" fill={iconColor || 'currentColor'}/>
			<circle cx="15" cy="15" r="2" fill={iconColor || 'currentColor'}/>
		</svg>
	</button>
	{#if isOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="color-picker-popup popup-{popupPosition}" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<div class="color-grid">
				{#each DIALOG_COLOR_PALETTE as color}
					<button
						class="color-option"
						class:selected={currentColor === color}
						style="background: {color};"
						onclick={() => handleSelect(color)}
						title={color === defaultColor ? 'Default' : color}
					>
						{#if currentColor === color}
							<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={color === '#FFFFFF' || color === '#FFF176' ? '#333' : '#fff'} stroke-width="4">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
						{/if}
					</button>
				{/each}
			</div>
			<div class="color-custom">
				<label for="custom-color">CUSTOM:</label>
				<input
					id="custom-color"
					type="color"
					class="custom-color-input"
					value={currentColor}
					oninput={handleCustomColor}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	.color-picker-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	/* Match global button.icon-btn styling */
	.picker-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: var(--space-sm);
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.picker-btn:hover {
		background: var(--surface-hover);
		color: var(--text);
	}

	/* Ghost variant for annotation nodes - minimal styling */
	.picker-btn.ghost {
		width: auto;
		height: auto;
		padding: 2px;
	}

	.picker-btn.ghost:hover {
		background: transparent;
		color: inherit;
		opacity: 0.7;
	}

	.color-picker-popup {
		position: absolute;
		background: var(--surface-raised);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 6px;
		box-shadow: var(--shadow-lg);
		z-index: 100;
	}

	.color-picker-popup.popup-bottom {
		top: 100%;
		right: 0;
		margin-top: 4px;
	}

	.color-picker-popup.popup-top {
		bottom: 100%;
		left: 0;
		margin-bottom: 4px;
	}

	.color-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 3px;
		margin-bottom: 6px;
	}

	.color-option {
		width: 16px;
		height: 16px;
		border-radius: 2px;
		border: 1px solid transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
	}

	.color-option:hover {
		transform: scale(1.1);
		border-color: var(--border-focus);
	}

	.color-option.selected {
		border-color: white;
		box-shadow: 0 0 0 2px var(--surface-raised);
	}

	.color-custom {
		display: flex;
		align-items: center;
		gap: 4px;
		padding-top: 4px;
		border-top: 1px solid var(--border);
	}

	.color-custom label {
		font-size: 9px;
		color: var(--text-muted);
	}

	.custom-color-input {
		width: 20px;
		height: 16px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 2px;
		cursor: pointer;
		background: transparent;
	}

	.custom-color-input::-webkit-color-swatch-wrapper {
		padding: 2px;
	}

	.custom-color-input::-webkit-color-swatch {
		border-radius: 2px;
		border: none;
	}
</style>
