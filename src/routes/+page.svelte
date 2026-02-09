<script lang="ts">
	import { onMount } from 'svelte';
    import { base } from '$app/paths';
	import { fly, fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import FlowCanvas from '$lib/components/FlowCanvas.svelte';
	import SimulationPanel from '$lib/components/panels/SimulationPanel.svelte';
	import BlockPropertiesDialog from '$lib/components/dialogs/BlockPropertiesDialog.svelte';
	import EventPropertiesDialog from '$lib/components/dialogs/EventPropertiesDialog.svelte';
	import CodePreviewDialog from '$lib/components/dialogs/CodePreviewDialog.svelte';
	import { codePreviewStore } from '$lib/stores/codePreview';
	import PlotPanel from '$lib/components/panels/PlotPanel.svelte';
	import ConsolePanel from '$lib/components/panels/ConsolePanel.svelte';
	import CodeEditor from '$lib/components/panels/CodeEditor.svelte';
	import NodeLibrary from '$lib/components/panels/NodeLibrary.svelte';
	import EventsPanel from '$lib/components/panels/EventsPanel.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import { buildContextMenuItems, type ContextMenuCallbacks } from '$lib/components/contextMenuBuilders';
	import ExportDialog from '$lib/components/dialogs/ExportDialog.svelte';
	import KeyboardShortcutsDialog from '$lib/components/dialogs/KeyboardShortcutsDialog.svelte';
	import PlotOptionsDialog from '$lib/components/dialogs/PlotOptionsDialog.svelte';
	import SearchDialog from '$lib/components/dialogs/SearchDialog.svelte';
	import ResizablePanel from '$lib/components/ResizablePanel.svelte';
	import WelcomeModal from '$lib/components/WelcomeModal.svelte';
	import SubsystemBreadcrumb from '$lib/components/SubsystemBreadcrumb.svelte';
	import Icon from '$lib/components/icons/Icon.svelte';
	import { nodeRegistry } from '$lib/nodes';
	import { NODE_TYPES } from '$lib/constants/nodeTypes';
	import { PANEL_GAP, PANEL_TOGGLES_WIDTH, MIN_BOTTOM_PANEL_WIDTH, PANEL_DEFAULTS, NAV_HEIGHT } from '$lib/constants/layout';
	import { GRID_SIZE } from '$lib/constants/grid';
	import { DEFAULT_SIMULATION_SETTINGS } from '$lib/nodes/types';
	import { graphStore } from '$lib/stores/graph';
	import { eventStore } from '$lib/stores/events';
	import { historyStore } from '$lib/stores/history';
	import { settingsStore } from '$lib/stores/settings';
	import { codeContextStore } from '$lib/stores/codeContext';
	import { themeStore, type Theme } from '$lib/stores/theme';
	import { contextMenuStore, type ContextMenuTarget } from '$lib/stores/contextMenu';
	import { openNodeDialog } from '$lib/stores/nodeDialog';
	import { openEventDialog } from '$lib/stores/eventDialog';
	import type { MenuItemType } from '$lib/components/ContextMenu.svelte';
	import { pyodideState, simulationState, initPyodide, stopSimulation, continueStreamingSimulation } from '$lib/pyodide/bridge';
	import { runGraphStreamingSimulation, validateGraphSimulation } from '$lib/pyodide/pathsimRunner';
	import { consoleStore } from '$lib/stores/console';
	import { newGraph, saveFile, saveAsFile, setupAutoSave, clearAutoSave, debouncedAutoSave, openImportDialog, importFromUrl, currentFileName } from '$lib/schema/fileOps';
	import { confirmationStore } from '$lib/stores/confirmation';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import { triggerFitView, triggerZoomIn, triggerZoomOut, triggerPan, getViewportCenter, screenToFlow, triggerClearSelection, triggerNudge, hasAnySelection, setFitViewPadding, triggerFlyInAnimation } from '$lib/stores/viewActions';
	import { nodeUpdatesStore } from '$lib/stores/nodeUpdates';
	import { pinnedPreviewsStore } from '$lib/stores/pinnedPreviews';
	import { portLabelsStore } from '$lib/stores/portLabels';
	import { clipboardStore } from '$lib/stores/clipboard';
	import Tooltip, { tooltip } from '$lib/components/Tooltip.svelte';
	import { isInputFocused } from '$lib/utils/focus';

	// Track mouse position for paste operations
	let mousePosition = $state({ x: 0, y: 0 });

	// Save feedback animation state
	let saveFlash = $state<'save' | 'save-as' | null>(null);
	let saveFlashTimeout: ReturnType<typeof setTimeout> | undefined;

	function flashSaveButton(which: 'save' | 'save-as') {
		clearTimeout(saveFlashTimeout);
		saveFlash = which;
		saveFlashTimeout = setTimeout(() => { saveFlash = null; }, 1500);
	}

	async function handleSave() {
		const success = await saveFile();
		if (success) flashSaveButton('save');
	}

	async function handleSaveAs() {
		const success = await saveAsFile();
		if (success) flashSaveButton('save-as');
	}

	// Panel visibility state
	let showProperties = $state(false);
	let showNodeLibrary = $state(false);
	let showEventsPanel = $state(false);
	let showCodeEditor = $state(false);
	let showPlot = $state(false);
	let showConsole = $state(false);
	let plotPanelHeight = $state(280);
	let consolePanelHeight = $state(280);
	let bottomPanelSplit = $state(0.5); // 0-1, ratio of console width to total
	let showPinnedPreviews = $state(false);
	let hasAutoOpenedPlot = $state(false); // Only auto-open once
	let hasAutoOpenedConsole = $state(false); // Only auto-open once

	// Parse URL model params once at init
	function getUrlModelConfig(): { url: string; isGitHub: boolean } | null {
		if (typeof window === 'undefined') return null;
		const params = new URLSearchParams(window.location.search);
		const model = params.get('model');
		const modelgh = params.get('modelgh');
		if (model) return { url: model, isGitHub: false };
		if (modelgh) return { url: modelgh, isGitHub: true };
		return null;
	}
	const urlModelConfig = getUrlModelConfig();
	let showWelcomeModal = $state(!urlModelConfig); // Hide if loading from URL

	// Track widths directly - initialized on first dual-panel open
	let consolePanelWidth = $state<number | undefined>(undefined);
	let plotPanelWidth = $state<number | undefined>(undefined);

	// Track side panel widths for fitView padding calculation
	let nodeLibraryWidth = $state(320);
	let eventsPanelWidth = $state(280);
	let codeEditorWidth = $state(400);
	const propertiesPanelWidth = 310; // Fixed width, not resizable

	// Track window size for fitView padding calculation
	let windowWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1920);
	let windowHeight = $state(typeof window !== 'undefined' ? window.innerHeight : 1080);

	function getBottomPanelTotalWidth() {
		if (typeof window === 'undefined') return 800;
		// Layout: [toggles + gap][panel1][gap][panel2][gap]
		return window.innerWidth - PANEL_TOGGLES_WIDTH - PANEL_GAP * 3;
	}

	// Max width for bottom panels when both are open (total - min for the other panel)
	const bottomPanelMaxWidth = $derived(
		showPlot && showConsole ? getBottomPanelTotalWidth() - MIN_BOTTOM_PANEL_WIDTH : undefined
	);

	// Initialize widths when both panels become visible
	$effect(() => {
		if (showPlot && showConsole) {
			if (consolePanelWidth === undefined || plotPanelWidth === undefined) {
				const total = getBottomPanelTotalWidth();
				const consoleW = Math.floor(total * bottomPanelSplit);
				consolePanelWidth = consoleW;
				plotPanelWidth = total - consoleW;
			}
		} else {
			// Reset when not both open
			consolePanelWidth = undefined;
			plotPanelWidth = undefined;
		}
	});

	// Handle width changes from ResizablePanel - use a single derived to avoid circular updates
	function handleConsoleWidthChange(newWidth: number) {
		if (!showPlot || !showConsole) return;
		const total = getBottomPanelTotalWidth();
		const clampedWidth = Math.max(MIN_BOTTOM_PANEL_WIDTH, Math.min(total - MIN_BOTTOM_PANEL_WIDTH, newWidth));
		consolePanelWidth = clampedWidth;
		plotPanelWidth = total - clampedWidth;
		bottomPanelSplit = clampedWidth / total;
	}

	function handlePlotWidthChange(newWidth: number) {
		if (!showPlot || !showConsole) return;
		const total = getBottomPanelTotalWidth();
		const clampedWidth = Math.max(MIN_BOTTOM_PANEL_WIDTH, Math.min(total - MIN_BOTTOM_PANEL_WIDTH, newWidth));
		plotPanelWidth = clampedWidth;
		consolePanelWidth = total - clampedWidth;
		bottomPanelSplit = (total - clampedWidth) / total;
	}

	// Handle window resize - recalculate panel widths maintaining split ratio
	function handleWindowResize() {
		// Update window dimensions for fitView padding calculation
		windowWidth = window.innerWidth;
		windowHeight = window.innerHeight;

		if (showPlot && showConsole && consolePanelWidth !== undefined && plotPanelWidth !== undefined) {
			const total = getBottomPanelTotalWidth();
			const consoleW = Math.max(MIN_BOTTOM_PANEL_WIDTH, Math.min(total - MIN_BOTTOM_PANEL_WIDTH, Math.floor(total * bottomPanelSplit)));
			consolePanelWidth = consoleW;
			plotPanelWidth = total - consoleW;
		}
	}

	// Panel layout constant - matches --panel-gap (12px) adjusted for max-height formula
	// Side panels use max-height: calc(100vh - 80px - offset), this constant ensures
	// the gap between side panels and bottom panels equals --panel-gap
	const PANEL_OFFSET_ADJUSTMENT = 12;

	// Node placement grid - used when adding multiple nodes to prevent stacking
	const NODE_PLACEMENT_COLS = 5;
	const NODE_PLACEMENT_GAP_X = 40;
	const NODE_PLACEMENT_GAP_Y = 50;

	// Compute bottom offset for left side panels (avoids console when both shown)
	const leftPanelBottomOffset = $derived(() => {
		if (!showPlot && !showConsole) return 0;
		if (showPlot && showConsole) return consolePanelHeight + PANEL_OFFSET_ADJUSTMENT;
		// Only one shown - it takes full width
		return (showPlot ? plotPanelHeight : consolePanelHeight) + PANEL_OFFSET_ADJUSTMENT;
	});

	// Toggle node library (closes other left panels if open)
	function toggleNodeLibrary() {
		if (showNodeLibrary) {
			showNodeLibrary = false;
		} else {
			showEventsPanel = false;
			showNodeLibrary = true;
			setTimeout(() => nodeLibraryRef?.focus(), 50);
		}
	}

	// Toggle events panel (closes other left panels if open)
	function toggleEventsPanel() {
		if (showEventsPanel) {
			showEventsPanel = false;
		} else {
			showNodeLibrary = false;
			showEventsPanel = true;
		}
	}

	// Toggle simulation settings (closes other right panels if open)
	function toggleProperties() {
		if (showProperties) {
			showProperties = false;
		} else {
			showCodeEditor = false;
			showProperties = true;
		}
	}

	// Toggle code editor (closes other right panels if open)
	function toggleCodeEditor() {
		if (showCodeEditor) {
			showCodeEditor = false;
		} else {
			showProperties = false;
			showCodeEditor = true;
			// Focus editor after it mounts
			setTimeout(() => codeEditorRef?.focus(), 50);
		}
	}

	// Compute bottom offset for right side panel (avoids plot when both shown)
	const rightPanelBottomOffset = $derived(() => {
		if (!showPlot && !showConsole) return 0;
		if (showPlot && showConsole) return plotPanelHeight + PANEL_OFFSET_ADJUSTMENT;
		// Only one shown - it takes full width
		return (showPlot ? plotPanelHeight : consolePanelHeight) + PANEL_OFFSET_ADJUSTMENT;
	});

	// Update fitView padding when panel state changes (in pixels)
	$effect(() => {
		if (typeof window === 'undefined') return;

		// Dependencies: panel visibility, widths, heights, and window size
		// These variable reads ensure the effect reruns when values change
		const _w = windowWidth;
		const _h = windowHeight;
		const _nlw = nodeLibraryWidth;
		const _epw = eventsPanelWidth;
		const _cew = codeEditorWidth;

		// Calculate pixel offsets for each side
		// Left panels: Block Library or Events (only one can be open at a time)
		const leftPanelWidth = showNodeLibrary ? nodeLibraryWidth : showEventsPanel ? eventsPanelWidth : 0;
		const leftPx = PANEL_TOGGLES_WIDTH + PANEL_GAP + (leftPanelWidth > 0 ? leftPanelWidth + PANEL_GAP : 0);

		// Right panels: Code Editor or Simulation (Properties)
		const rightPanelWidth = showCodeEditor ? codeEditorWidth : showProperties ? propertiesPanelWidth : 0;
		const rightPx = (rightPanelWidth > 0 ? rightPanelWidth + PANEL_GAP : 0) + 20; // 20px extra buffer

		// Bottom panels: Plot and Console - only use heights of panels that are actually open
		let bottomPx = 20;
		if (showPlot && showConsole) {
			bottomPx = Math.max(plotPanelHeight, consolePanelHeight) + PANEL_GAP + 20;
		} else if (showPlot) {
			bottomPx = plotPanelHeight + PANEL_GAP + 20;
		} else if (showConsole) {
			bottomPx = consolePanelHeight + PANEL_GAP + 20;
		}

		// Top: Navigation bar
		const topPx = NAV_HEIGHT + 20; // 20px extra buffer

		setFitViewPadding({
			top: topPx,
			right: rightPx,
			bottom: bottomPx,
			left: leftPx
		});
	});

	// References for focus management
	let nodeLibraryRef = $state<NodeLibrary | undefined>(undefined);
	let codeEditorRef = $state<CodeEditor | undefined>(undefined);

	let exportDialogOpen = $state(false);
	let showKeyboardShortcuts = $state(false);
	let showSearchDialog = $state(false);
	let showPlotOptionsDialog = $state(false);

	// Context menu state
	let contextMenuOpen = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });
	let contextMenuTarget = $state<ContextMenuTarget | null>(null);

	// Context menu callbacks
	const contextMenuCallbacks: ContextMenuCallbacks = {
		toggleNodeLibrary,
		toggleEventsPanel,
		deleteNodes
	};

	// Build context menu items based on target
	function getContextMenuItems(): MenuItemType[] {
		return buildContextMenuItems(contextMenuTarget, contextMenuPosition, contextMenuCallbacks);
	}

	// Helper to rotate a node (single node)
	function rotateNode(nodeId: string) {
		const node = graphStore.getNode(nodeId);
		if (node) {
			historyStore.mutate(() => {
				const currentRotation = (node.params?.['_rotation'] as number) || 0;
				const newRotation = (currentRotation + 1) % 4;
				graphStore.updateNodeParams(nodeId, { '_rotation': newRotation });
			});
			// Queue update to re-render handles
			nodeUpdatesStore.queueUpdate([nodeId]);
		}
	}

	// Helper to rotate multiple nodes as a single undoable action
	function rotateNodes(nodeIds: string[]) {
		const nodesToUpdate = historyStore.mutate(() => {
			const updated: string[] = [];
			for (const nodeId of nodeIds) {
				const node = graphStore.getNode(nodeId);
				if (node) {
					const currentRotation = (node.params?.['_rotation'] as number) || 0;
					const newRotation = (currentRotation + 1) % 4;
					graphStore.updateNodeParams(nodeId, { '_rotation': newRotation });
					updated.push(nodeId);
				}
			}
			return updated;
		});

		// Queue updates to re-render handles
		if (nodesToUpdate.length > 0) {
			nodeUpdatesStore.queueUpdate(nodesToUpdate);
		}
	}

	// Helper to delete multiple nodes as a single undoable action
	function deleteNodes(nodeIds: string[]) {
		if (nodeIds.length === 0) return;

		historyStore.mutate(() => {
			for (const nodeId of nodeIds) {
				graphStore.removeNode(nodeId);
			}
		});
	}

	// App state
	let nodeCount = $state(0);
	let pyodideReady = $state(false);
	let pyodideLoading = $state(false);
	let simRunning = $state(false);
	let isRunStarting = false; // Synchronous flag to prevent race conditions
	let isContinuing = false; // Synchronous flag to prevent rapid continue calls
	let hasRunSimulation = $state(false);
	let statusText = $state('Ready');
	let currentTheme = $state<Theme>('dark');
	let consoleLogCount = $state(0);
	let plotActiveTab = $state(0);
	let plotViewMode = $state<'tabs' | 'tiles'>('tabs');
	let resultPlots = $state<{ id: string; type: 'scope' | 'spectrum'; title: string }[]>([]);
	let resultTraces = $state<{ nodeId: string; nodeType: 'scope' | 'spectrum'; nodeName: string; signalIndex: number; signalLabel: string }[]>([]);

	// Tooltip for continue button - simple, disabled state shows availability
	const continueTooltip = { text: "Continue", shortcut: "Shift+Enter" };

	onMount(() => {
		// Subscribe to stores (with cleanup)
		const unsubPinnedPreviews = pinnedPreviewsStore.subscribe((pinned) => {
			showPinnedPreviews = pinned;
		});

		const unsubContextMenu = contextMenuStore.subscribe((state) => {
			contextMenuOpen = state.open;
			contextMenuPosition = state.position;
			contextMenuTarget = state.target;
		});

		const unsubTheme = themeStore.subscribe((theme) => {
			currentTheme = theme;
		});

		const unsubNodeCount = graphStore.nodesArray.subscribe((nodes) => {
			nodeCount = nodes.length;
		});

		const unsubPyodide = pyodideState.subscribe((s) => {
			pyodideReady = s.initialized;
			pyodideLoading = s.loading;
			if (s.loading) {
				statusText = s.progress || 'Loading...';
			} else if (s.error) {
				statusText = `Error: ${s.error}`;
			} else if (s.initialized) {
				statusText = 'Ready';
			}
		});

		const unsubSimulation = simulationState.subscribe((s) => {
			simRunning = s.phase === 'running';
			// Sync hasRunSimulation with whether we have results
			hasRunSimulation = s.result !== null;
			if (s.phase === 'running') {
				statusText = s.progress || 'Simulating...';
			} else if (s.error) {
				statusText = `Error: ${s.error}`;
			} else if (pyodideReady) {
				statusText = 'Ready';
			}

			// Derive plots and traces from result (use nodeNames from simulation result for subsystem support)
			const plots: { id: string; type: 'scope' | 'spectrum'; title: string }[] = [];
			const traces: typeof resultTraces = [];
			if (s.result?.scopeData) {
				Object.entries(s.result.scopeData).forEach(([id, data], index) => {
					const title = s.result?.nodeNames?.[id] || `Scope ${index + 1}`;
					plots.push({ id, type: 'scope', title });
					// Add traces for each signal in this scope
					for (let i = 0; i < data.signals.length; i++) {
						traces.push({
							nodeId: id,
							nodeType: 'scope',
							nodeName: title,
							signalIndex: i,
							signalLabel: data.labels?.[i] || `port ${i}`
						});
					}
				});
			}
			if (s.result?.spectrumData) {
				Object.entries(s.result.spectrumData).forEach(([id, data], index) => {
					const title = s.result?.nodeNames?.[id] || `Spectrum ${index + 1}`;
					plots.push({ id, type: 'spectrum', title });
					// Add traces for each signal in this spectrum
					for (let i = 0; i < data.magnitude.length; i++) {
						traces.push({
							nodeId: id,
							nodeType: 'spectrum',
							nodeName: title,
							signalIndex: i,
							signalLabel: data.labels?.[i] || `port ${i}`
						});
					}
				});
			}
			resultPlots = plots;
			resultTraces = traces;

			// Reset tab if out of bounds
			if (plotActiveTab >= plots.length && plots.length > 0) {
				plotActiveTab = 0;
			}
		});

		const unsubConsole = consoleStore.subscribe((logs) => {
			consoleLogCount = logs.length;
		});

		// Always start with clean slate
		clearAutoSave();

		// Setup periodic autosave (backup)
		const cleanupAutoSave = setupAutoSave(30000);

		// Setup immediate autosave on graph changes
		const unsubNodes = graphStore.nodesArray.subscribe(() => {
			debouncedAutoSave();
		});
		const unsubConnections = graphStore.connections.subscribe(() => {
			debouncedAutoSave();
		});

		// Listen for simulation events from code editor
		const handleRunSimulation = () => handleRun();
		const handleContinueSimulation = () => {
			if (hasRunSimulation && pyodideReady && !simRunning && !isContinuing) {
				handleContinue();
			}
		};
		window.addEventListener('run-simulation', handleRunSimulation);
		window.addEventListener('continue-simulation', handleContinueSimulation);

		// Check for URL parameters to load model
		loadFromUrlParam();

		return () => {
			// Cleanup store subscriptions
			unsubPinnedPreviews();
			unsubContextMenu();
			unsubTheme();
			unsubNodeCount();
			unsubPyodide();
			unsubSimulation();
			unsubConsole();
			// Cleanup autosave subscriptions
			cleanupAutoSave();
			unsubNodes();
			unsubConnections();
			window.removeEventListener('run-simulation', handleRunSimulation);
			window.removeEventListener('continue-simulation', handleContinueSimulation);
		};
	});

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		const inputFocused = isInputFocused(event);

		// Shift+Enter for continue simulation
		if (event.shiftKey && event.key === 'Enter') {
			event.preventDefault();
			if (hasRunSimulation && pyodideReady && !simRunning && !isContinuing) {
				handleContinue();
			}
			return;
		}

		// Cmd/Ctrl shortcuts (work even in inputs, except select all)
		if (event.metaKey || event.ctrlKey) {
			switch (event.key.toLowerCase()) {
				case 's':
					event.preventDefault();
					if (event.shiftKey) {
						handleSaveAs();
					} else {
						handleSave();
					}
					return;
				case 'o':
					event.preventDefault();
					handleOpen();
					return;
				case 'e':
					event.preventDefault();
					exportDialogOpen = true;
					return;
				case 'f':
					event.preventDefault();
					showSearchDialog = true;
					return;
				case 'd':
					event.preventDefault();
					historyStore.mutate(() => graphStore.duplicateSelected());
					return;
				case 'c':
					if (!inputFocused) {
						event.preventDefault();
						clipboardStore.copy();
					}
					return;
				case 'x':
					if (!inputFocused) {
						event.preventDefault();
						clipboardStore.cut();
					}
					return;
				case 'v':
					if (!inputFocused) {
						event.preventDefault();
						const flowPosition = screenToFlow(mousePosition);
						clipboardStore.paste(flowPosition);
					}
					return;
				case 'a':
					if (!inputFocused) {
						event.preventDefault();
						graphStore.selectAll();
					}
					return;
				case 'z':
					event.preventDefault();
					if (event.shiftKey) {
						historyStore.redo();
					} else {
						historyStore.undo();
					}
					return;
				case 'y':
					event.preventDefault();
					historyStore.redo();
					return;
				case 'enter':
					event.preventDefault();
					handleRun();
					return;
			}
		}

		// Non-modifier shortcuts (only when not typing)
		if (!inputFocused) {
			switch (event.key) {
				case 'Escape':
					// Progressive close - one thing at a time
					if (contextMenuOpen) {
						contextMenuStore.close();
					} else if (exportDialogOpen) {
						exportDialogOpen = false;
					} else if (showKeyboardShortcuts) {
						showKeyboardShortcuts = false;
					} else if (hasAnySelection()) {
						triggerClearSelection();
					} else if (simRunning) {
						stopSimulation();
					} else if (showConsole) {
						showConsole = false;
					} else if (showPlot) {
						showPlot = false;
					} else if (showCodeEditor) {
						showCodeEditor = false;
					} else if (showNodeLibrary) {
						showNodeLibrary = false;
					} else if (showEventsPanel) {
						showEventsPanel = false;
					} else if (showProperties) {
						showProperties = false;
					}
					return;
				case 'f':
					event.preventDefault();
					triggerFitView();
					return;
				case 's':
					event.preventDefault();
					toggleProperties();
					return;
				case 'e':
					event.preventDefault();
					toggleCodeEditor();
					return;
				case 'v':
					event.preventDefault();
					showPlot = !showPlot;
					return;
				case 'c':
					event.preventDefault();
					showConsole = !showConsole;
					return;
				case 'p':
					event.preventDefault();
					pinnedPreviewsStore.toggle();
					return;
				case 'l':
					event.preventDefault();
					portLabelsStore.toggle();
					return;
				case 'b':
					event.preventDefault();
					toggleNodeLibrary();
					return;
				case 'n':
					event.preventDefault();
					toggleEventsPanel();
					return;
				case 'h':
					event.preventDefault();
					if (!graphStore.isAtRoot()) {
						graphStore.navigateTo(0);
					}
					return;
				case 't':
					event.preventDefault();
					themeStore.toggle();
					return;
				case '+':
				case '=':
					if (!event.ctrlKey && !event.metaKey) {
						event.preventDefault();
						triggerZoomIn();
					}
					return;
				case '-':
					if (!event.ctrlKey && !event.metaKey) {
						event.preventDefault();
						triggerZoomOut();
					}
					return;
				case '?':
					event.preventDefault();
					showKeyboardShortcuts = !showKeyboardShortcuts;
					return;
				case 'ArrowUp':
				case 'ArrowDown':
				case 'ArrowLeft':
				case 'ArrowRight':
					event.preventDefault();
					handleArrowKey(event.key, event.shiftKey);
					return;
			}
		}
	}

	// Handle arrow keys - nudge selected nodes or pan canvas
	function handleArrowKey(direction: string, largeStep: boolean) {
		const hasSelection = hasAnySelection();
		const panStep = largeStep ? GRID_SIZE * 5 : GRID_SIZE * 2;
		const nudgeStep = largeStep ? GRID_SIZE * 2 : GRID_SIZE;

		const delta = { x: 0, y: 0 };

		switch (direction) {
			case 'ArrowUp': delta.y = hasSelection ? -nudgeStep : panStep; break;
			case 'ArrowDown': delta.y = hasSelection ? nudgeStep : -panStep; break;
			case 'ArrowLeft': delta.x = hasSelection ? -nudgeStep : panStep; break;
			case 'ArrowRight': delta.x = hasSelection ? nudgeStep : -panStep; break;
		}

		if (hasSelection) {
			triggerNudge(delta);
		} else {
			triggerPan(delta);
		}
	}

	// Run simulation (auto-initializes if needed)
	async function handleRun() {
		// Prevent concurrent simulation runs (synchronous check for rapid key presses)
		if (simRunning || isRunStarting || pyodideLoading) return;

		// Set flag before any async operations to prevent race conditions
		isRunStarting = true;

		// Auto-initialize if not ready
		if (!pyodideReady) {
			try {
				await initPyodide();
			} catch (error) {
				console.error('Failed to initialize Pyodide:', error);
				isRunStarting = false;
				return;
			}
		}

		try {
			// Run simulation
			const { nodes, connections } = graphStore.toJSON();
			if (nodes.length === 0) {
				statusText = 'Add nodes first';
				return;
			}

			// Auto-open console on first run to show progress
			if (!hasAutoOpenedConsole) {
				showConsole = true;
				hasAutoOpenedConsole = true;
			}

			const codeContext = codeContextStore.getCode();

			// Validate before running
			try {
				statusText = 'Validating...';
				const validation = await validateGraphSimulation(nodes, codeContext);

				if (!validation.valid) {
					// Show validation errors
					showConsole = true;
					consoleStore.error('Validation failed:');
					for (const err of validation.errors) {
						if (err.nodeId === '__code_context__') {
							consoleStore.error(`  Code context: ${err.error}`);
						} else {
							const node = nodes.find((n) => n.id === err.nodeId);
							const nodeName = node?.name || err.nodeId;
							consoleStore.error(`  ${nodeName}.${err.param}: ${err.error}`);
						}
					}
					statusText = 'Validation failed';
					return;
				}
			} catch (error) {
				showConsole = true;
				consoleStore.error(`Validation error: ${error}`);
				statusText = 'Validation error';
				return;
			}

			// Run streaming simulation
			try {
				const events = eventStore.toJSON();
				await runGraphStreamingSimulation(
					nodes,
					connections,
					settingsStore.get(),
					codeContext,
					events
				);
				// Auto-open results panel only on first run
				if (!hasAutoOpenedPlot) {
					showPlot = true;
					hasAutoOpenedPlot = true;
				}
			} catch (error) {
				// Auto-open console panel to show error details
				showConsole = true;
				console.error('Simulation failed:', error);
			}
		} finally {
			isRunStarting = false;
		}
	}

	// Continue simulation from where it left off (streaming)
	async function handleContinue() {
		// Prevent concurrent continue calls (synchronous check for rapid key presses)
		if (!pyodideReady || !hasRunSimulation || simRunning || isContinuing) return;

		isContinuing = true;
		try {
			const settingsDuration = settingsStore.get().duration;
			// Use default if duration is empty (same logic as initial run)
			const duration = settingsDuration?.trim() ? String(settingsDuration) : String(DEFAULT_SIMULATION_SETTINGS.duration);
			await continueStreamingSimulation(duration);
		} catch (error) {
			showConsole = true;
			console.error('Continue simulation failed:', error);
		} finally {
			isContinuing = false;
		}
	}

	// File operations
	async function handleNew() {
		if (nodeCount > 0) {
			const confirmed = await confirmationStore.show({
				title: 'Unsaved Changes',
				message: 'Creating a new file will discard your current work. Continue?',
				confirmText: 'Discard & Create New',
				cancelText: 'Cancel'
			});
			if (!confirmed) return;
		}
		newGraph();
		// Clear ?model= URL param so the URL reflects a blank canvas
		if (window.location.search) {
			window.history.replaceState({}, '', window.location.pathname);
		}
	}

	async function handleOpen() {
		// Uses unified import system with built-in confirmation
		const result = await openImportDialog();
		if (result.success && result.type === 'model') {
			// Trigger fit view after a brief delay to let nodes render
			setTimeout(() => triggerFitView(), 100);
		}
	}

	/**
	 * Expand GitHub shorthand to raw.githubusercontent.com URL
	 * Format: owner/repo/path/to/file.pvm
	 * Expands to: https://raw.githubusercontent.com/owner/repo/main/path/to/file.pvm
	 */
	function expandGitHubShorthand(shorthand: string): string {
		const parts = shorthand.split('/');
		if (parts.length < 3) {
			throw new Error('Invalid GitHub shorthand. Use: owner/repo/path/to/file.pvm');
		}
		const owner = parts[0];
		const repo = parts[1];
		const pathParts = parts.slice(2);
		// Default to 'main' branch
		const branch = 'main';
		const filePath = pathParts.join('/');
		return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
	}

	/**
	 * Load model from URL parameter on page load
	 */
	async function loadFromUrlParam(): Promise<void> {
		if (!urlModelConfig) return;

		let url: string;
		try {
			url = urlModelConfig.isGitHub
				? expandGitHubShorthand(urlModelConfig.url)
				: urlModelConfig.url;
		} catch (e) {
			consoleStore.error(`Invalid GitHub shorthand: ${urlModelConfig.url}`);
			consoleStore.error('Expected format: owner/repo/path/to/file.pvm');
			showConsole = true;
			return;
		}

		const result = await importFromUrl(url);
		if (result.success) {
			setTimeout(() => triggerFitView(), 100);
		} else if (result.error) {
			consoleStore.error(`Failed to load model from URL: ${url}`);
			consoleStore.error(result.error);
			showConsole = true;
		}
	}

	// Track placement offset for stacking prevention
	let placementOffset = 0;
	let lastPlacementTime = 0;

	// Add node from node library sidebar
	function handleAddNode(type: string) {
		// Get viewport center and add offset to prevent stacking
		let position = getViewportCenter();
		const now = Date.now();

		// Reset offset if more than 2 seconds since last placement
		if (now - lastPlacementTime > 2000) {
			placementOffset = 0;
		}
		// Apply spiral-like offset pattern
		const offsetX = (placementOffset % NODE_PLACEMENT_COLS) * NODE_PLACEMENT_GAP_X;
		const offsetY = Math.floor(placementOffset / NODE_PLACEMENT_COLS) * NODE_PLACEMENT_GAP_Y;
		position = {
			x: position.x + offsetX - NODE_PLACEMENT_GAP_X * 2,  // Center the spiral
			y: position.y + offsetY - NODE_PLACEMENT_GAP_Y
		};
		placementOffset++;
		lastPlacementTime = now;

		// addNode uses current navigation context automatically
		// Subsystem creation auto-creates Interface block inside
		const newNode = historyStore.mutate(() => graphStore.addNode(type, position));

		// Trigger fly-in animation for the new node (from cursor position)
		if (newNode) {
			triggerFlyInAnimation(newNode.id, position, mousePosition);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} onresize={handleWindowResize} onmousemove={(e) => mousePosition = { x: e.clientX, y: e.clientY }} />

<svelte:head>
	<title>PathView</title>
	<link rel="icon" type="image/png" href="{base}/favicon.png">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</svelte:head>

<div class="app">
	<!-- Logo overlay in top left -->
	<button class="logo-overlay" onclick={() => showWelcomeModal = true} use:tooltip={"Welcome"} aria-label="Welcome">
		<img src="{base}/pathview_logo.png" alt="PathView" />
	</button>

	<!-- Canvas takes full screen -->
	<div class="canvas-layer">
		<FlowCanvas />
	</div>

	<!-- Subsystem navigation breadcrumb -->
	<div class="subsystem-breadcrumb">
		<SubsystemBreadcrumb />
	</div>

	<!-- Floating toolbar -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="toolbar-container" transition:fly={{ y: -20, duration: 200 }} onmousedown={() => triggerClearSelection()}>
		<!-- Simulation controls -->
		<div class="toolbar-group">
			{#if simRunning}
				<button class="toolbar-btn stop" onclick={stopSimulation} use:tooltip={{ text: "Stop", shortcut: "Esc" }} aria-label="Stop">
					<Icon name="stop-filled" size={16} />
				</button>
			{:else}
				<div class="run-btn-wrapper" class:loading={pyodideLoading}>
					<button
						class="toolbar-btn run-btn"
						class:active={!pyodideLoading}
						class:loading={pyodideLoading}
						onclick={handleRun}
						disabled={pyodideLoading}
						use:tooltip={{ text: pyodideReady ? "Run" : "Initialize & Run", shortcut: "Ctrl+Enter" }}
						aria-label="Run"
					>
						{#if pyodideLoading}
							<span class="loading-status">{statusText}</span>
							<span class="spinner"><Icon name="loader" size={16} /></span>
						{:else}
							<Icon name="play-filled" size={16} />
						{/if}
					</button>
				</div>
			{/if}
			<button
				class="toolbar-btn"
				class:active={hasRunSimulation && pyodideReady && !simRunning}
				onclick={handleContinue}
				disabled={!hasRunSimulation || !pyodideReady || simRunning}
				use:tooltip={continueTooltip}
				aria-label="Continue"
			>
				<Icon name="skip-forward-filled" size={16} />
			</button>
		</div>

		<!-- File operations -->
		<div class="toolbar-group">
			<button class="toolbar-btn" onclick={handleNew} use:tooltip={"New"} aria-label="New">
				<Icon name="new-canvas" size={16} />
			</button>
			<button class="toolbar-btn" onclick={handleOpen} use:tooltip={{ text: "Open/Import", shortcut: "Ctrl+O" }} aria-label="Open/Import">
				<Icon name="download" size={16} />
			</button>
			<button
				class="toolbar-btn"
				onclick={() => handleSave()}
				use:tooltip={{ text: $currentFileName ? `Save '${$currentFileName}'` : "Save", shortcut: "Ctrl+S" }}
				aria-label="Save"
			>
				<span class="icon-crossfade">
					{#if saveFlash === 'save'}
						<span class="icon-crossfade-item" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
							<Icon name="check" size={16} />
						</span>
					{:else}
						<span class="icon-crossfade-item" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
							<Icon name="upload" size={16} />
						</span>
					{/if}
				</span>
			</button>
			<button
				class="toolbar-btn"
				onclick={() => handleSaveAs()}
				use:tooltip={{ text: "Save As", shortcut: "Ctrl+Shift+S" }}
				aria-label="Save As"
			>
				<span class="icon-crossfade">
					{#if saveFlash === 'save-as'}
						<span class="icon-crossfade-item" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
							<Icon name="check" size={16} />
						</span>
					{:else}
						<span class="icon-crossfade-item" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
							<Icon name="upload-plus" size={16} />
						</span>
					{/if}
				</span>
			</button>
			<button class="toolbar-btn" onclick={() => exportDialogOpen = true} use:tooltip={{ text: "Python Code", shortcut: "Ctrl+E" }} aria-label="View Python Code">
				<Icon name="braces" size={16} />
			</button>
		</div>

		<!-- Help -->
		<div class="toolbar-group">
			<button class="toolbar-btn" onclick={() => showKeyboardShortcuts = true} use:tooltip={{ text: "Shortcuts", shortcut: "?" }} aria-label="Keyboard shortcuts">
				<Icon name="keyboard" size={16} />
			</button>
		</div>
	</div>

	<!-- Panel toggles (left edge) -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="panel-toggles" onmousedown={() => triggerClearSelection()}>
		<!-- Panel controls - left panels first, then right panels -->
		<!-- Building tools -->
		<div class="toggle-group">
			<button
				class="toggle-btn"
				class:active={showNodeLibrary}
				onclick={toggleNodeLibrary}
				use:tooltip={{ text: "Blocks", shortcut: "B", position: "right" }}
				aria-label="Blocks"
			>
				<Icon name="grid" size={18} />
			</button>
			<button
				class="toggle-btn"
				class:active={showEventsPanel}
				onclick={toggleEventsPanel}
				use:tooltip={{ text: "Events", shortcut: "N", position: "right" }}
				aria-label="Events"
			>
				<Icon name="zap" size={18} />
			</button>
			<button
				class="toggle-btn"
				class:active={showCodeEditor}
				onclick={toggleCodeEditor}
				use:tooltip={{ text: "Editor", shortcut: "E", position: "right" }}
				aria-label="Editor"
			>
				<Icon name="code" size={18} />
			</button>
		</div>

		<!-- Output panels -->
		<div class="toggle-group">
			<button
				class="toggle-btn"
				class:active={showPlot}
				onclick={() => showPlot = !showPlot}
				use:tooltip={{ text: "Results", shortcut: "V", position: "right" }}
				aria-label="Results"
			>
				<Icon name="bar-chart" size={18} />
			</button>
			<button
				class="toggle-btn"
				class:active={showConsole}
				onclick={() => showConsole = !showConsole}
				use:tooltip={{ text: "Console", shortcut: "C", position: "right" }}
				aria-label="Console"
			>
				<Icon name="terminal" size={18} />
			</button>
		</div>

		<!-- Simulation settings -->
		<div class="toggle-group">
			<button
				class="toggle-btn"
				class:active={showProperties}
				onclick={toggleProperties}
				use:tooltip={{ text: "Simulation", shortcut: "S", position: "right" }}
				aria-label="Simulation"
			>
				<Icon name="settings" size={18} />
			</button>
		</div>

		<!-- UI preferences -->
		<div class="toggle-group">
			<button
				class="toggle-btn"
				class:active={showPinnedPreviews}
				onclick={() => pinnedPreviewsStore.toggle()}
				use:tooltip={{ text: "Pin Previews", shortcut: "P", position: "right" }}
				aria-label="Pin Previews"
			>
				<Icon name={showPinnedPreviews ? "pin-filled" : "pin"} size={18} />
			</button>
			<button
				class="toggle-btn"
				onclick={() => themeStore.toggle()}
				use:tooltip={{ text: currentTheme === 'dark' ? 'Light mode' : 'Dark mode', shortcut: "T", position: "right" }}
				aria-label="Toggle theme"
			>
				<Icon name={currentTheme === 'dark' ? 'sun' : 'moon'} size={18} />
			</button>
		</div>
	</div>

	<!-- Simulation Settings Panel (floating right) -->
	{#if showProperties}
		<ResizablePanel
			position="right"
			title="Simulation"
			initialWidth={310}
			minWidth={310}
			maxWidth={310}
			bottomOffset={rightPanelBottomOffset()}
			onClose={() => showProperties = false}
		>
			<div class="panel-padding">
				<SimulationPanel />
			</div>
		</ResizablePanel>
	{/if}

	<!-- Block Library Panel (left) -->
	{#if showNodeLibrary}
		<ResizablePanel
			position="left"
			width={nodeLibraryWidth}
			minWidth={280}
			maxWidth={500}
			bottomOffset={leftPanelBottomOffset()}
			title="Blocks"
			onClose={() => showNodeLibrary = false}
			onWidthChange={(w) => nodeLibraryWidth = Math.min(500, Math.max(280, w))}
		>
			<NodeLibrary
				bind:this={nodeLibraryRef}
				onAddNode={handleAddNode}
				focusSearch={true}
			/>
		</ResizablePanel>
	{/if}

	<!-- Events Panel (left) -->
	{#if showEventsPanel}
		<ResizablePanel
			position="left"
			width={eventsPanelWidth}
			minWidth={200}
			maxWidth={400}
			bottomOffset={leftPanelBottomOffset()}
			title="Events"
			onClose={() => showEventsPanel = false}
			onWidthChange={(w) => eventsPanelWidth = Math.min(400, Math.max(200, w))}
		>
			<EventsPanel />
		</ResizablePanel>
	{/if}

	<!-- Code Editor Panel (right) -->
	{#if showCodeEditor}
		<ResizablePanel
			position="right"
			width={codeEditorWidth}
			minWidth={300}
			maxWidth={700}
			bottomOffset={rightPanelBottomOffset()}
			title="Editor"
			onClose={() => showCodeEditor = false}
			onWidthChange={(w) => codeEditorWidth = Math.min(700, Math.max(300, w))}
		>
			<CodeEditor bind:this={codeEditorRef} />
		</ResizablePanel>
	{/if}

	<!-- Plot Panel (floating bottom) -->
	{#if showPlot}
		<ResizablePanel
			position={showConsole ? 'bottom-right' : 'bottom'}
			initialHeight={280}
			minHeight={150}
			minWidth={MIN_BOTTOM_PANEL_WIDTH}
			maxWidth={bottomPanelMaxWidth}
			bind:currentHeight={plotPanelHeight}
			width={plotPanelWidth}
			onWidthChange={handlePlotWidthChange}
			onClose={() => showPlot = false}
		>
			{#snippet header()}
				<span>Results</span>
				{#if resultPlots.length > 0 && plotViewMode === 'tabs'}
					<div class="header-tabs">
						{#each resultPlots as plot, i}
							<button
								class="header-tab"
								class:active={plotActiveTab === i}
								onclick={() => plotActiveTab = i}
								title={plot.title}
							>
								{#if plot.type === 'scope'}
									<Icon name="activity" size={12} />
								{:else}
									<Icon name="bar-chart-2" size={12} />
								{/if}
								<span class="header-tab-title">{plot.title}</span>
							</button>
						{/each}
					</div>
				{/if}
			{/snippet}
			{#snippet actions()}
				{#if resultPlots.length > 1}
					<button
						class="icon-btn ghost"
						onclick={() => plotViewMode = plotViewMode === 'tabs' ? 'tiles' : 'tabs'}
						use:tooltip={{ text: plotViewMode === 'tabs' ? 'Show all plots' : 'Show single plot', position: 'bottom' }}
						aria-label={plotViewMode === 'tabs' ? 'Show all plots' : 'Show single plot'}
					>
						{#if plotViewMode === 'tabs'}
							<Icon name="grid" size={16} />
						{:else}
							<Icon name="square" size={16} />
						{/if}
					</button>
				{/if}
				<button
					class="icon-btn ghost"
					onclick={() => showPlotOptionsDialog = true}
					use:tooltip={{ text: 'Plot options', position: 'bottom' }}
					aria-label="Plot options"
				>
					<Icon name="settings" size={16} />
				</button>
			{/snippet}
			<PlotPanel collapsed={false} bind:activeTab={plotActiveTab} viewMode={plotViewMode} />
		</ResizablePanel>
	{/if}

	<!-- Console Panel (floating bottom-left) -->
	{#if showConsole}
		<ResizablePanel
			position={showPlot ? 'bottom-left' : 'bottom'}
			initialHeight={280}
			minHeight={150}
			minWidth={MIN_BOTTOM_PANEL_WIDTH}
			maxWidth={bottomPanelMaxWidth}
			bind:currentHeight={consolePanelHeight}
			width={consolePanelWidth}
			onWidthChange={handleConsoleWidthChange}
			onClose={() => showConsole = false}
		>
			{#snippet header()}
				<span>Console</span>
			{/snippet}
			{#snippet actions()}
				<button class="icon-btn ghost" onclick={() => consoleStore.clear()} use:tooltip={{ text: 'Clear console', position: 'bottom' }} aria-label="Clear console">
					<Icon name="trash" size={16} />
				</button>
			{/snippet}
			<ConsolePanel />
		</ResizablePanel>
	{/if}

	<!-- Context Menu -->
	{#if contextMenuOpen}
		<ContextMenu
			x={contextMenuPosition.x}
			y={contextMenuPosition.y}
			items={getContextMenuItems()}
			onClose={() => contextMenuStore.close()}
		/>
	{/if}

	<!-- Export Dialog -->
	<ExportDialog open={exportDialogOpen} onClose={() => exportDialogOpen = false} />

	<!-- Keyboard Shortcuts Dialog -->
	<KeyboardShortcutsDialog open={showKeyboardShortcuts} onClose={() => showKeyboardShortcuts = false} />
	<SearchDialog open={showSearchDialog} onClose={() => showSearchDialog = false} />
	<PlotOptionsDialog open={showPlotOptionsDialog} onClose={() => showPlotOptionsDialog = false} traces={resultTraces} />

	<!-- Block Properties Dialog -->
	<BlockPropertiesDialog />

	<!-- Event Properties Dialog -->
	<EventPropertiesDialog />

	<!-- Global Code Preview Dialog (for context menu) -->
	<CodePreviewDialog
		open={$codePreviewStore !== null}
		code={$codePreviewStore?.code ?? ''}
		title={$codePreviewStore?.title ?? ''}
		onClose={() => codePreviewStore.close()}
	/>

	<!-- Global Tooltip -->
	<Tooltip />

	<!-- Global Confirmation Modal -->
	<ConfirmationModal />

	<!-- Welcome Modal -->
	{#if showWelcomeModal}
		<WelcomeModal
			onNew={handleNew}
			onClose={() => showWelcomeModal = false}
		/>
	{/if}
</div>

<style>
	.app {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}

	.canvas-layer {
		position: absolute;
		inset: 0;
		z-index: 0;
	}

	/* Toolbar */
	.toolbar-container {
		position: fixed;
		top: var(--space-md);
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		display: flex;
		align-items: center;
		gap: var(--space-lg);
	}

	.toolbar-group {
		display: flex;
		gap: var(--space-xs);
	}

	.toolbar-btn {
		width: var(--header-height);
		height: var(--header-height);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-sm);
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.toolbar-btn:hover:not(:disabled) {
		color: var(--text);
		border-color: var(--border-focus);
	}

	.toolbar-btn:disabled {
		color: var(--text-muted);
		cursor: not-allowed;
		opacity: 1;
	}

	.toolbar-btn.active {
		color: var(--accent);
	}

	.toolbar-btn.stop {
		color: var(--error);
	}

	.toolbar-btn.stop:hover {
		color: var(--error);
		border-color: var(--error);
		background: color-mix(in srgb, var(--error) 15%, var(--surface-raised));
	}

	.icon-crossfade {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
	}

	.icon-crossfade-item {
		position: absolute;
		display: flex;
	}

	/* Logo overlay */
	.logo-overlay {
		position: fixed;
		top: var(--space-md);
		left: var(--space-md);
		z-index: 100;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.logo-overlay img {
		height: 44px;
		width: auto;
		transition: opacity var(--transition-fast);
	}

	.logo-overlay:hover img {
		opacity: 0.8;
	}

	/* Subsystem breadcrumb navigation */
	.subsystem-breadcrumb {
		position: fixed;
		top: var(--space-md);
		right: var(--space-md);
		z-index: 100;
	}

	.spinner {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Run button wrapper - maintains fixed width in layout, button expands left */
	.run-btn-wrapper {
		position: relative;
		width: var(--header-height);
		height: var(--header-height);
	}

	.run-btn-wrapper .run-btn {
		position: absolute;
		right: 0;
		top: 0;
	}

	/* Run button with loading expansion (expands left) */
	.run-btn {
		transition: width var(--transition-normal), padding var(--transition-normal), gap var(--transition-normal);
		overflow: hidden;
	}

	.run-btn.loading {
		width: 180px;
		padding: 0 var(--space-sm);
		gap: var(--space-xs);
		justify-content: flex-end;
	}

	.loading-status {
		font-size: 11px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		text-align: left;
	}

	/* Panel toggles */
	.panel-toggles {
		position: fixed;
		left: var(--space-md);
		top: 50%;
		transform: translateY(-50%);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.toggle-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.toggle-btn {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-sm);
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.toggle-btn:hover {
		color: var(--text);
		border-color: var(--border-focus);
	}

	.toggle-btn.active {
		background: color-mix(in srgb, var(--accent) 15%, var(--surface-raised));
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Panel content padding */
	.panel-padding {
		padding: var(--space-md);
	}

	/* Header tabs for results panel - pill style matching breadcrumb */
	.header-tabs {
		display: flex;
		gap: var(--space-xs);
		margin-left: var(--space-sm);
		margin-right: auto;
		overflow-x: auto;
	}

	.header-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 24px;
		padding: 0 10px;
		font-size: 10px;
		font-weight: 500;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--transition-fast);
		text-transform: none;
	}

	.header-tab:hover {
		background: var(--surface-hover);
		border-color: var(--border-focus);
		color: var(--text);
	}

	.header-tab.active {
		background: color-mix(in srgb, var(--accent) 15%, var(--surface));
		border-color: var(--accent);
		color: var(--accent);
	}

	.header-tab-title {
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
