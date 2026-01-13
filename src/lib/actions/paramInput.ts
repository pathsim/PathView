/**
 * Svelte action for consistent keyboard handling on parameter inputs.
 *
 * Features:
 * - Escape: unfocus (blur) the input, stops propagation
 * - Enter: optionally blur (for single-line inputs, not textareas)
 *
 * Usage:
 *   <input use:paramInput />
 *   <input use:paramInput={{ blurOnEnter: true }} />
 *   <textarea use:paramInput />
 */

export interface ParamInputOptions {
	/** Blur input on Escape key (default: true) */
	blurOnEscape?: boolean;
	/** Blur input on Enter key - ignored for textareas (default: false) */
	blurOnEnter?: boolean;
}

const defaultOptions: ParamInputOptions = {
	blurOnEscape: true,
	blurOnEnter: false
};

export function paramInput(
	node: HTMLInputElement | HTMLTextAreaElement,
	options: ParamInputOptions = {}
) {
	const opts = { ...defaultOptions, ...options };

	function handleKeydown(e: Event) {
		const event = e as KeyboardEvent;
		if (event.key === 'Escape' && opts.blurOnEscape) {
			event.stopPropagation();
			node.blur();
		}

		// Enter to blur - only for inputs, not textareas (which need Enter for newlines)
		if (event.key === 'Enter' && opts.blurOnEnter && !(node instanceof HTMLTextAreaElement)) {
			event.stopPropagation();
			node.blur();
		}
	}

	node.addEventListener('keydown', handleKeydown);
	node.setAttribute('autocomplete', 'off');

	return {
		update(newOptions: ParamInputOptions) {
			Object.assign(opts, defaultOptions, newOptions);
		},
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
		}
	};
}
