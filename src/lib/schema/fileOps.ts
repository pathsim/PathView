/**
 * File operations for saving and loading graph files
 */

import { tick } from 'svelte';
import { writable } from 'svelte/store';
import type { NodeInstance, Connection, SimulationSettings, GraphFile, SolverType } from '$lib/nodes/types';
import { GRAPH_FILE_VERSION, INITIAL_SIMULATION_SETTINGS } from '$lib/nodes/types';
import { cleanNodeForExport } from './cleanParams';
import { graphStore } from '$lib/stores/graph';
import { eventStore } from '$lib/stores/events';
import { settingsStore } from '$lib/stores/settings';
import { codeContextStore } from '$lib/stores/codeContext';
import { consoleStore } from '$lib/stores/console';
import { historyStore } from '$lib/stores/history';
import { simulationState, resetSimulation } from '$lib/pyodide/bridge';
import { requestAssemblyAnimation } from '$lib/animation/assemblyAnimation';
import { downloadJson } from '$lib/utils/download';

const STORAGE_KEY = 'pathview_autosave';
const FILE_EXTENSION = '.pvm';
const LEGACY_EXTENSION = '.json';

// Debounce timer for immediate autosave
let autosaveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Current file handle for Save functionality (File System Access API)
let currentFileHandle: FileSystemFileHandle | null = null;

// Current file name as a reactive store
const currentFileNameStore = writable<string | null>(null);

/**
 * Check if File System Access API is available
 */
function hasFileSystemAccess(): boolean {
	return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
}

/**
 * Current file name store (for reactive UI updates)
 */
export const currentFileName = { subscribe: currentFileNameStore.subscribe };

/**
 * Get current file name (for display purposes)
 */
export function getCurrentFileName(): string | null {
	let name: string | null = null;
	currentFileNameStore.subscribe(n => name = n)();
	return name;
}

/**
 * Clear current file (e.g., when creating new graph)
 */
export function clearCurrentFile(): void {
	currentFileHandle = null;
	currentFileNameStore.set(null);
}

/**
 * Create a GraphFile object from current state
 */
export function createGraphFile(name?: string): GraphFile {
	const { nodes, connections, annotations } = graphStore.toJSON();
	const events = eventStore.toJSON();
	const settings = settingsStore.get();
	const code = codeContextStore.getCode();

	// Clean params from all nodes (remove internal UI params, empty values, dead params)
	const cleanedNodes = nodes.map(n => cleanNodeForExport(n));

	return {
		version: GRAPH_FILE_VERSION,
		metadata: {
			created: new Date().toISOString(),
			modified: new Date().toISOString(),
			name: name || 'Untitled'
		},
		graph: {
			nodes: cleanedNodes,
			connections,
			annotations
		},
		events,
		codeContext: {
			code
		},
		simulationSettings: settings
	};
}

/**
 * Migrate old node type format to new format
 * Old: 'pathsim.sources.StepSource' -> New: 'StepSource'
 */
function migrateNodeType(type: string): string {
	if (type.startsWith('pathsim.')) {
		// Extract the last part after the final dot
		const parts = type.split('.');
		return parts[parts.length - 1];
	}
	return type;
}

/**
 * Migrate a GraphFile from old format to new format
 */
function migrateGraphFile(file: GraphFile): GraphFile {
	const migrateNodes = (nodes: NodeInstance[]): NodeInstance[] => {
		return nodes.map(node => {
			const migratedNode = { ...node, type: migrateNodeType(node.type) };
			// Recursively migrate subsystem graphs (preserving connections, annotations, and events)
			if (migratedNode.graph) {
				migratedNode.graph = {
					nodes: migrateNodes(migratedNode.graph.nodes || []),
					connections: migratedNode.graph.connections || [],
					annotations: migratedNode.graph.annotations,
					events: migratedNode.graph.events
				};
			}
			return migratedNode;
		});
	};

	return {
		...file,
		graph: file.graph ? {
			...file.graph,
			nodes: migrateNodes(file.graph.nodes || [])
		} : file.graph
	};
}

/**
 * Load a GraphFile into the application state
 */
export async function loadGraphFile(file: GraphFile): Promise<void> {
	// Migrate old format if needed
	file = migrateGraphFile(file);
	// Validate version
	if (!file.version) {
		throw new Error('Invalid file: missing version');
	}

	// Reset simulation state (stops running simulation, clears results and Python state)
	resetSimulation(); // Fire and forget - synchronous part stops immediately

	// Clear previous state and wait for UI to update
	// This ensures FlowCanvas sees empty state before new data arrives
	graphStore.clear();
	eventStore.clear();
	consoleStore.clear();
	await tick();

	// Load graph (including annotations)
	graphStore.fromJSON(
		file.graph?.nodes || [],
		file.graph?.connections || [],
		file.graph?.annotations || []
	);

	// Load events
	if (file.events && file.events.length > 0) {
		eventStore.fromJSON(file.events);
	}

	// Load code context
	if (file.codeContext?.code) {
		codeContextStore.setCode(file.codeContext.code);
	} else {
		codeContextStore.clear();
	}

	// Load settings (use initial empty values for missing fields)
	if (file.simulationSettings) {
		const s = file.simulationSettings as unknown as Record<string, unknown>;
		// Use initial empty values as base, preserve what's in the file
		const mergedSettings: SimulationSettings = {
			...INITIAL_SIMULATION_SETTINGS,
			solver: (s.solver as SolverType) ?? INITIAL_SIMULATION_SETTINGS.solver,
			ghostTraces: (s.ghostTraces as number) ?? INITIAL_SIMULATION_SETTINGS.ghostTraces,
			plotResults: (s.plotResults as boolean) ?? INITIAL_SIMULATION_SETTINGS.plotResults,
			adaptive: (s.adaptive as boolean) ?? INITIAL_SIMULATION_SETTINGS.adaptive,
			// Preserve string values as-is (empty strings show placeholders)
			duration: s.duration != null ? String(s.duration) : INITIAL_SIMULATION_SETTINGS.duration,
			dt: s.dt != null ? String(s.dt) : INITIAL_SIMULATION_SETTINGS.dt,
			rtol: s.rtol != null ? String(s.rtol) : INITIAL_SIMULATION_SETTINGS.rtol,
			atol: s.atol != null ? String(s.atol) : INITIAL_SIMULATION_SETTINGS.atol,
			ftol: s.ftol != null ? String(s.ftol) : INITIAL_SIMULATION_SETTINGS.ftol,
			dt_min: s.dt_min != null ? String(s.dt_min) : INITIAL_SIMULATION_SETTINGS.dt_min,
			dt_max: s.dt_max != null ? String(s.dt_max) : INITIAL_SIMULATION_SETTINGS.dt_max
		};
		settingsStore.set(mergedSettings);
	} else {
		settingsStore.reset();
	}

	// Clear undo/redo history - fresh file = fresh history
	historyStore.clear();

	// Trigger assembly animation for loaded graph
	requestAssemblyAnimation();
}

/**
 * Save to localStorage (autosave)
 */
export function autoSave(): void {
	try {
		const file = createGraphFile('Autosave');
		localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
	} catch (error) {
		console.warn('Autosave failed:', error);
	}
}

/**
 * Debounced autosave - saves after a short delay to batch rapid changes
 */
export function debouncedAutoSave(delayMs: number = 500): void {
	if (autosaveDebounceTimer) {
		clearTimeout(autosaveDebounceTimer);
	}
	autosaveDebounceTimer = setTimeout(() => {
		autoSave();
		autosaveDebounceTimer = null;
	}, delayMs);
}

/**
 * Load from localStorage (restore autosave)
 */
export async function loadAutoSave(): Promise<boolean> {
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (!data) return false;

		const file = JSON.parse(data) as GraphFile;

		// Validate the file has proper structure
		if (!file.version || !file.graph) {
			clearAutoSave();
			return false;
		}

		await loadGraphFile(file);
		return true;
	} catch (error) {
		console.warn('Failed to restore autosave, clearing:', error);
		clearAutoSave();
		return false;
	}
}

/**
 * Clear autosave
 */
export function clearAutoSave(): void {
	localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if autosave exists
 */
export function hasAutoSave(): boolean {
	return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Save graph to current file, or prompt if no current file
 */
export async function saveFile(): Promise<boolean> {
	// If we have a file handle, save directly to it
	if (currentFileHandle && hasFileSystemAccess()) {
		try {
			const file = createGraphFile(getCurrentFileName() || undefined);
			const json = JSON.stringify(file, null, 2);
			const writable = await currentFileHandle.createWritable();
			await writable.write(json);
			await writable.close();
			return true;
		} catch (error) {
			// User may have revoked permission, fall through to Save As
			console.warn('Failed to save to current file:', error);
		}
	}

	// No current file or save failed, prompt for new file
	return saveAsFile();
}

/**
 * Save graph to a new file (always prompts)
 */
export async function saveAsFile(): Promise<boolean> {
	const suggestedName = (getCurrentFileName() || 'pathview_graph') + FILE_EXTENSION;

	if (hasFileSystemAccess()) {
		try {
			const handle = await (window as any).showSaveFilePicker({
				suggestedName,
				types: [{
					description: 'PathView Model',
					accept: { 'application/json': ['.pvm', '.json'] }
				}]
			});

			const name = handle.name.replace(/\.(pvm|json)$/, '');
			const file = createGraphFile(name);
			const json = JSON.stringify(file, null, 2);

			const writable = await handle.createWritable();
			await writable.write(json);
			await writable.close();

			// Update current file reference
			currentFileHandle = handle;
			currentFileNameStore.set(name);
			return true;
		} catch (error: any) {
			if (error.name === 'AbortError') {
				return false; // User cancelled
			}
			console.error('Failed to save file:', error);
			// Fall back to download
		}
	}

	// Fallback: download file
	downloadGraphFile(suggestedName);
	return true;
}

/**
 * Legacy download-based save (fallback for browsers without File System Access API)
 */
function downloadGraphFile(filename: string): void {
	const name = filename.replace(/\.(pvm|json)$/, '');
	const file = createGraphFile(name);
	downloadJson(file, filename);

	// Set current file name for subsequent saves
	currentFileNameStore.set(name);
}

/**
 * Open file dialog and load graph
 */
export async function openFile(): Promise<GraphFile | null> {
	if (hasFileSystemAccess()) {
		try {
			const [handle] = await (window as any).showOpenFilePicker({
				types: [{
					description: 'PathView Model',
					accept: { 'application/json': ['.pvm', '.json'] }
				}],
				multiple: false
			});

			const file = await handle.getFile();
			const text = await file.text();
			const graphFile = JSON.parse(text) as GraphFile;
			await loadGraphFile(graphFile);

			// Track the file handle for future saves
			currentFileHandle = handle;
			currentFileNameStore.set(handle.name.replace(/\.(pvm|json)$/, ''));

			return graphFile;
		} catch (error: any) {
			if (error.name === 'AbortError') {
				return null; // User cancelled
			}
			console.error('Failed to open file:', error);
			alert('Failed to open file. Make sure it is a valid PathView JSON file.');
			return null;
		}
	}

	// Fallback for browsers without File System Access API
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.pvm,.json';

		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}

			try {
				const text = await file.text();
				const graphFile = JSON.parse(text) as GraphFile;
				await loadGraphFile(graphFile);

				// Track file name (but no handle in fallback mode)
				currentFileHandle = null;
				currentFileNameStore.set(file.name.replace(/\.(pvm|json)$/, ''));

				resolve(graphFile);
			} catch (error) {
				console.error('Failed to open file:', error);
				alert('Failed to open file. Make sure it is a valid PathView JSON file.');
				resolve(null);
			}
		};

		input.oncancel = () => resolve(null);
		input.click();
	});
}

/**
 * Load graph from URL (e.g., example files)
 */
export async function loadGraphFromUrl(url: string): Promise<GraphFile | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error('Failed to fetch file');
		const graphFile = JSON.parse(await res.text()) as GraphFile;
		await loadGraphFile(graphFile);

		// Extract name from URL
		const name = url.split('/').pop()?.replace(/\.(pvm|json)$/, '') || null;
		currentFileHandle = null;
		currentFileNameStore.set(name);

		return graphFile;
	} catch (error) {
		console.error('Failed to load file from URL:', error);
		return null;
	}
}

/**
 * Create new empty graph
 */
export function newGraph(): void {
	// Reset simulation state (stops running simulation, clears results and Python state)
	resetSimulation(); // Fire and forget - synchronous part stops immediately

	graphStore.clear();
	eventStore.clear();
	codeContextStore.clear();
	consoleStore.clear();
	settingsStore.reset();
	historyStore.clear();
	clearAutoSave();
	clearCurrentFile();
}

/**
 * Set up autosave interval
 * Returns cleanup function
 */
export function setupAutoSave(intervalMs: number = 30000): () => void {
	const timer = setInterval(autoSave, intervalMs);
	return () => clearInterval(timer);
}
