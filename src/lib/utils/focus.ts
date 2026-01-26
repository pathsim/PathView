/**
 * Check if the event target is a text input, textarea, or code editor.
 * Used to prevent keyboard shortcuts from firing during text editing.
 */
export function isInputFocused(event: KeyboardEvent): boolean {
	return (
		event.target instanceof HTMLInputElement ||
		event.target instanceof HTMLTextAreaElement ||
		!!(event.target as HTMLElement)?.closest?.('.cm-editor')
	);
}
