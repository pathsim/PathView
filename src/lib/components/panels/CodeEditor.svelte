<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { codeContextStore } from '$lib/stores/codeContext';
	import { themeStore, type Theme } from '$lib/stores/theme';
	import { loadCodeMirrorModules, createEditorExtensions, type CodeMirrorModules } from '$lib/utils/codemirror';

	let editorContainer: HTMLDivElement;
	let editorView: import('@codemirror/view').EditorView | null = null;
	let cmModules: CodeMirrorModules | null = null;
	let isLoading = $state(true);
	let currentTheme = $state<Theme>('dark');

	// Store state
	let code = $state('');
	let error = $state<string | null>(null);

	// Cleanup functions for subscriptions
	let unsubscribers: (() => void)[] = [];

	function getExtensions() {
		if (!cmModules) return [];

		return createEditorExtensions(cmModules, currentTheme === 'dark', {
			keymaps: [
				{
					key: 'Mod-Enter',
					run: () => {
						window.dispatchEvent(new CustomEvent('run-simulation'));
						return true;
					}
				},
				{
					key: 'Shift-Enter',
					run: () => {
						window.dispatchEvent(new CustomEvent('continue-simulation'));
						return true;
					}
				},
				{
					key: 'Escape',
					run: (view) => {
						view.contentDOM.blur();
						return true;
					}
				}
			],
			onDocChange: (newCode) => {
				codeContextStore.setCode(newCode);
			}
		});
	}

	function recreateEditor() {
		if (!editorView || !editorContainer || !cmModules) return;

		const currentCode = editorView.state.doc.toString();
		editorView.destroy();

		editorView = new cmModules.EditorView({
			doc: currentCode,
			extensions: getExtensions(),
			parent: editorContainer
		});
	}

	// Focus the editor
	export function focus() {
		editorView?.focus();
	}

	onMount(async () => {
		// Subscribe to stores
		unsubscribers.push(
			codeContextStore.code.subscribe((c) => {
				code = c;
				// Update editor if it exists and differs
				if (editorView && editorView.state.doc.toString() !== c) {
					editorView.dispatch({
						changes: {
							from: 0,
							to: editorView.state.doc.length,
							insert: c
						}
					});
				}
			})
		);

		unsubscribers.push(
			codeContextStore.lastError.subscribe((e) => {
				error = e;
			})
		);

		unsubscribers.push(
			themeStore.subscribe((theme) => {
				currentTheme = theme;
				if (editorView && cmModules) {
					recreateEditor();
				}
			})
		);

		// Load CodeMirror modules
		cmModules = await loadCodeMirrorModules();

		// Create editor
		editorView = new cmModules.EditorView({
			doc: code,
			extensions: getExtensions(),
			parent: editorContainer
		});

		isLoading = false;
	});

	onDestroy(() => {
		unsubscribers.forEach(unsub => unsub());
		if (editorView) {
			editorView.destroy();
		}
	});
</script>

<div class="code-editor">
	<div class="editor-container" bind:this={editorContainer}>
		{#if isLoading}
			<div class="loading">Loading editor...</div>
		{/if}
	</div>

	{#if error}
		<div class="error-bar">{error}</div>
	{/if}

	<div class="footer">
		Define Python variables and functions to use in node parameters.
	</div>
</div>

<style>
	.code-editor {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.editor-container {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted);
		font-size: 12px;
	}

	.error-bar {
		padding: 6px 10px;
		background: color-mix(in srgb, var(--error-color) 20%, transparent);
		color: var(--error-color);
		font-size: 11px;
		border-top: 1px solid var(--error-color);
	}

	.footer {
		flex-shrink: 0;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-raised);
		border-top: 1px solid var(--border);
		font-size: 10px;
		color: var(--text-disabled);
	}
</style>
