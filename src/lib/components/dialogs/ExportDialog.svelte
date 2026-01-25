<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { graphStore } from '$lib/stores/graph';
	import { eventStore } from '$lib/stores/events';
	import { settingsStore } from '$lib/stores/settings';
	import { codeContextStore } from '$lib/stores/codeContext';
	import { exportToPython } from '$lib/pyodide/pathsimRunner';
	import { themeStore, type Theme } from '$lib/stores/theme';
	import { tooltip } from '$lib/components/Tooltip.svelte';
	import Icon from '$lib/components/icons/Icon.svelte';
	import { loadCodeMirrorModules, createEditorExtensions, type CodeMirrorModules } from '$lib/utils/codemirror';
	import { downloadPython } from '$lib/utils/download';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = false, onClose }: Props = $props();

	let editorContainer = $state<HTMLDivElement | undefined>(undefined);
	let editorView: import('@codemirror/view').EditorView | null = null;
	let cmModules: CodeMirrorModules | null = null;
	let editorLoading = $state(true);
	let currentTheme = $state<Theme>('dark');

	// Subscribe to theme changes
	const unsubscribeTheme = themeStore.subscribe((theme) => {
		currentTheme = theme;
		if (editorView && cmModules && editorContainer) {
			recreateEditor();
		}
	});

	// Generated code
	let pythonCode = $state('');
	let copied = $state(false);

	// Line count for dynamic height
	const MAX_LINES = 35;
	const LINE_HEIGHT_PX = 18.2; // CodeMirror default with 14px font
	const HEADER_HEIGHT_PX = 41; // Dialog header
	const CM_PADDING_PX = 16; // .cm-content padding (8px top + 8px bottom)

	let lineCount = $derived(pythonCode.split('\n').length);
	let dialogHeight = $derived(() => {
		const lines = Math.min(lineCount, MAX_LINES);
		return Math.ceil(lines * LINE_HEIGHT_PX + CM_PADDING_PX + HEADER_HEIGHT_PX);
	});

	// Handle dialog open/close
	$effect(() => {
		if (open) {
			pythonCode = generateCode();
			copied = false;
			editorLoading = true;
			setTimeout(() => initEditor(), 0);
		} else {
			destroyEditor();
		}
	});

	function getExtensions() {
		if (!cmModules) return [];

		return createEditorExtensions(cmModules, currentTheme === 'dark', {
			readOnly: true
		});
	}

	function destroyEditor() {
		if (editorView) {
			editorView.destroy();
			editorView = null;
		}
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

	async function initEditor() {
		if (!editorContainer) return;

		destroyEditor();

		// Load CodeMirror modules (cached after first load)
		cmModules = await loadCodeMirrorModules();

		editorView = new cmModules.EditorView({
			doc: pythonCode,
			extensions: getExtensions(),
			parent: editorContainer
		});

		editorLoading = false;
	}

	function generateCode(): string {
		const { nodes, connections } = graphStore.toJSON();
		const settings = settingsStore.get();
		const codeContext = codeContextStore.getCode();
		const events = eventStore.toJSON();

		return exportToPython(nodes, connections, settings, codeContext, events);
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(pythonCode);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function downloadFile() {
		downloadPython(pythonCode, 'pathview_simulation.py');
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	onDestroy(() => {
		unsubscribeTheme();
		destroyEditor();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="dialog-backdrop" transition:fade={{ duration: 150 }} onclick={handleBackdropClick} role="presentation">
		<div class="dialog glass-panel" style="height: {dialogHeight()}px" transition:scale={{ start: 0.95, duration: 150, easing: cubicOut }} role="dialog" tabindex="-1" aria-labelledby="dialog-title">
			<div class="dialog-header">
				<span id="dialog-title">Export Python Code</span>
				<div class="header-actions">
					<button
						class="icon-btn"
						class:success={copied}
						onclick={copyToClipboard}
						use:tooltip={copied ? "Copied!" : "Copy to Clipboard"}
						aria-label="Copy to Clipboard"
					>
						{#if copied}
							<Icon name="check" size={16} />
						{:else}
							<Icon name="copy" size={16} />
						{/if}
					</button>
					<button
						class="icon-btn"
						onclick={downloadFile}
						use:tooltip={"Download .py"}
						aria-label="Download Python file"
					>
						<Icon name="download" size={16} />
					</button>
					<button
						class="icon-btn"
						onclick={onClose}
						use:tooltip={{ text: "Close", shortcut: "Esc" }}
						aria-label="Close"
					>
						<Icon name="x" size={16} />
					</button>
				</div>
			</div>

			<div class="dialog-body">
				<div class="code-preview" bind:this={editorContainer}>
					{#if editorLoading}
						<div class="loading">Loading syntax highlighting...</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Uses global .dialog-backdrop, .dialog-header, .icon-btn from app.css */

	.dialog {
		width: 90%;
		max-width: 800px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.dialog-body {
		flex: 1;
		overflow: hidden;
	}

	.code-preview {
		height: 100%;
		overflow: hidden;
	}

	.code-preview :global(.cm-editor) {
		height: 100%;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted);
		font-size: 12px;
	}
</style>
