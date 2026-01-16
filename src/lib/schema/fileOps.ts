/**
 * File operations for saving and loading graph files
 *
 * This is the single source of truth for all file import/export operations.
 * Supports: .blk (block), .sub (subsystem), .pvm (model), .json (legacy model)
 */

import { tick } from 'svelte';
import { writable, get } from 'svelte/store';
import type { NodeInstance, Connection, SimulationSettings, GraphFile, SolverType } from '$lib/nodes/types';
import { GRAPH_FILE_VERSION, INITIAL_SIMULATION_SETTINGS } from '$lib/nodes/types';
import type { ComponentFile, ComponentType, BlockContent, SubsystemContent } from '$lib/types/component';
import type { Position } from '$lib/types';
import { ALL_COMPONENT_EXTENSIONS } from '$lib/types/component';
import { cleanNodeForExport } from './cleanParams';
import { graphStore, regenerateGraphIds } from '$lib/stores/graph';
import { eventStore } from '$lib/stores/events';
import { settingsStore } from '$lib/stores/settings';
import { codeContextStore } from '$lib/stores/codeContext';
import { consoleStore } from '$lib/stores/console';
import { historyStore } from '$lib/stores/history';
import { simulationState, resetSimulation } from '$lib/pyodide/bridge';
import { requestAssemblyAnimation } from '$lib/animation/assemblyAnimation';
import { downloadJson } from '$lib/utils/download';
import { confirmationStore } from '$lib/stores/confirmation';
import { nodeRegistry } from '$lib/nodes';
import { NODE_TYPES } from '$lib/constants/nodeTypes';
import { generateId } from '$lib/stores/utils';

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

// =============================================================================
// UNIFIED IMPORT SYSTEM
// =============================================================================

const COMPONENT_VERSION = '1.0';

/** Import result type */
export interface ImportResult {
	success: boolean;
	type: ComponentType | 'legacy-model';
	nodeIds?: string[]; // IDs of imported nodes (for components)
	cancelled?: boolean;
	error?: string;
}

/** Import options */
export interface ImportOptions {
	position?: Position; // Where to place components (ignored for models)
	fileHandle?: FileSystemFileHandle; // For native file picker (enables Save)
	fileName?: string; // Display name (for URL imports or fallback)
}

/**
 * Detect file format from parsed JSON
 */
function detectFileFormat(json: unknown): 'component' | 'legacy-model' | 'unknown' {
	if (typeof json !== 'object' || json === null) {
		return 'unknown';
	}

	const obj = json as Record<string, unknown>;

	// New component format has explicit type field
	if ('type' in obj && ['block', 'subsystem', 'model'].includes(obj.type as string)) {
		return 'component';
	}

	// Legacy model format has graph and version but no type
	if ('graph' in obj && 'version' in obj) {
		return 'legacy-model';
	}

	return 'unknown';
}

/**
 * Parse file content and return normalized ComponentFile
 */
function parseFileContent(text: string, fileName: string): ComponentFile {
	const json = JSON.parse(text);
	const format = detectFileFormat(json);

	if (format === 'unknown') {
		throw new Error('Invalid file format');
	}

	if (format === 'legacy-model') {
		// Convert legacy model format to component format
		return {
			version: COMPONENT_VERSION,
			type: 'model',
			metadata: {
				name: json.metadata?.name || fileName.replace(/\.(json|pvm)$/, ''),
				created: json.metadata?.created || new Date().toISOString(),
				modified: json.metadata?.modified || new Date().toISOString()
			},
			content: {
				graph: json.graph,
				events: json.events,
				codeContext: json.codeContext,
				simulationSettings: json.simulationSettings
			}
		};
	}

	// Already in component format
	return json as ComponentFile;
}

/**
 * Validate that all node types in a graph are registered
 * @returns Array of invalid type names, empty if all valid
 */
function validateNodeTypes(nodes: NodeInstance[]): string[] {
	const invalidTypes: string[] = [];

	for (const node of nodes) {
		// Skip special types that are always valid
		if (node.type === NODE_TYPES.SUBSYSTEM || node.type === NODE_TYPES.INTERFACE) {
			// Recursively validate subsystem internal graphs
			if (node.graph?.nodes) {
				invalidTypes.push(...validateNodeTypes(node.graph.nodes));
			}
			continue;
		}

		if (!nodeRegistry.has(node.type)) {
			invalidTypes.push(node.type);
		}

		// Recursively validate subsystem internal graphs
		if (node.graph?.nodes) {
			invalidTypes.push(...validateNodeTypes(node.graph.nodes));
		}
	}

	return [...new Set(invalidTypes)]; // Remove duplicates
}

/**
 * Import a block at the given position
 */
function importBlock(content: BlockContent, position: Position): string[] {
	const node = content.node;

	// Validate node type is registered
	const invalidTypes = validateNodeTypes([node]);
	if (invalidTypes.length > 0) {
		throw new Error(`Unknown block type(s): ${invalidTypes.join(', ')}`);
	}

	// Generate new ID
	const newId = generateId();

	// Create new node with regenerated IDs
	const newNode: NodeInstance = {
		...node,
		id: newId,
		position: { ...position },
		inputs: node.inputs.map((port, index) => ({
			...port,
			id: `${newId}-input-${index}`,
			nodeId: newId
		})),
		outputs: node.outputs.map((port, index) => ({
			...port,
			id: `${newId}-output-${index}`,
			nodeId: newId
		}))
	};

	// Clear selection and add node
	historyStore.mutate(() => {
		graphStore.clearSelection();
		eventStore.clearSelection();
		graphStore.pasteNodes([newNode], []);
	});

	return [newId];
}

/**
 * Import a subsystem at the given position
 */
function importSubsystem(content: SubsystemContent, position: Position): string[] {
	const node = content.node;

	// Validate all node types in subsystem are registered
	const invalidTypes = validateNodeTypes([node]);
	if (invalidTypes.length > 0) {
		throw new Error(`Unknown block type(s): ${invalidTypes.join(', ')}`);
	}

	// Generate new ID for the subsystem node
	const newId = generateId();

	// Create new node with regenerated IDs
	const newNode: NodeInstance = {
		...node,
		id: newId,
		position: { ...position },
		inputs: node.inputs.map((port, index) => ({
			...port,
			id: `${newId}-input-${index}`,
			nodeId: newId
		})),
		outputs: node.outputs.map((port, index) => ({
			...port,
			id: `${newId}-output-${index}`,
			nodeId: newId
		}))
	};

	// Recursively regenerate IDs in the subsystem's internal graph
	if (newNode.graph) {
		newNode.graph = regenerateGraphIds(newNode.graph);
	}

	// Clear selection and add node
	historyStore.mutate(() => {
		graphStore.clearSelection();
		eventStore.clearSelection();
		graphStore.pasteNodes([newNode], []);
	});

	return [newId];
}

/**
 * Import a model (replaces entire graph)
 */
async function importModel(
	componentFile: ComponentFile,
	options: ImportOptions
): Promise<ImportResult> {
	// Check if we need to confirm with user
	const nodeCount = get(graphStore.nodesArray).length;

	if (nodeCount > 0) {
		const confirmed = await confirmationStore.show({
			title: 'Unsaved Changes',
			message: 'Opening this file will discard your current work. Continue?',
			confirmText: 'Discard & Open',
			cancelText: 'Cancel'
		});

		if (!confirmed) {
			return { success: false, type: 'model', cancelled: true };
		}
	}

	// Convert component format back to GraphFile for loading
	const content = componentFile.content as {
		graph?: GraphFile['graph'];
		events?: GraphFile['events'];
		codeContext?: GraphFile['codeContext'];
		simulationSettings?: GraphFile['simulationSettings'];
	};

	const graphFile: GraphFile = {
		version: componentFile.version,
		metadata: componentFile.metadata,
		graph: content.graph || { nodes: [], connections: [] },
		events: content.events,
		codeContext: content.codeContext || { code: '' },
		simulationSettings: content.simulationSettings || INITIAL_SIMULATION_SETTINGS
	};

	await loadGraphFile(graphFile);

	// Update current file tracking
	currentFileHandle = options.fileHandle || null;
	currentFileNameStore.set(
		options.fileName?.replace(/\.(pvm|json)$/, '') ||
		componentFile.metadata.name ||
		null
	);

	return { success: true, type: 'model' };
}

/**
 * Unified file import function
 * Handles all file types: .blk, .sub, .pvm, .json
 *
 * @param file - The file to import
 * @param options - Import options (position for components, file handle for models)
 * @returns Import result with success status and type
 */
export async function importFile(
	file: File,
	options: ImportOptions = {}
): Promise<ImportResult> {
	try {
		const text = await file.text();
		const componentFile = parseFileContent(text, file.name);

		switch (componentFile.type) {
			case 'block': {
				const position = options.position || { x: 100, y: 100 };
				const nodeIds = importBlock(componentFile.content as BlockContent, position);
				return { success: true, type: 'block', nodeIds };
			}

			case 'subsystem': {
				const position = options.position || { x: 100, y: 100 };
				const nodeIds = importSubsystem(componentFile.content as SubsystemContent, position);
				return { success: true, type: 'subsystem', nodeIds };
			}

			case 'model': {
				return importModel(componentFile, {
					...options,
					fileName: options.fileName || file.name
				});
			}

			default:
				return {
					success: false,
					type: componentFile.type,
					error: `Unknown component type: ${componentFile.type}`
				};
		}
	} catch (error) {
		return {
			success: false,
			type: 'model', // Default type for errors
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Import from URL (for examples and URL parameters)
 *
 * @param url - URL to fetch the file from
 * @param options - Import options
 * @returns Import result
 */
export async function importFromUrl(
	url: string,
	options: ImportOptions = {}
): Promise<ImportResult> {
	try {
		const res = await fetch(url);
		if (!res.ok) {
			throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
		}

		const text = await res.text();

		// Extract filename from URL if not provided
		const fileName = options.fileName || url.split('/').pop() || 'model.pvm';

		const componentFile = parseFileContent(text, fileName);

		switch (componentFile.type) {
			case 'block': {
				const position = options.position || { x: 100, y: 100 };
				const nodeIds = importBlock(componentFile.content as BlockContent, position);
				return { success: true, type: 'block', nodeIds };
			}

			case 'subsystem': {
				const position = options.position || { x: 100, y: 100 };
				const nodeIds = importSubsystem(componentFile.content as SubsystemContent, position);
				return { success: true, type: 'subsystem', nodeIds };
			}

			case 'model': {
				return importModel(componentFile, {
					...options,
					fileName
				});
			}

			default:
				return {
					success: false,
					type: componentFile.type,
					error: `Unknown component type: ${componentFile.type}`
				};
		}
	} catch (error) {
		return {
			success: false,
			type: 'model',
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Open unified import dialog
 * Supports all file types: .blk, .sub, .pvm, .json
 *
 * @param position - Position for component imports (optional)
 * @returns Import result
 */
export async function openImportDialog(
	position?: Position
): Promise<ImportResult> {
	if (hasFileSystemAccess()) {
		try {
			const [handle] = await (window as any).showOpenFilePicker({
				types: [{
					description: 'PathView Files',
					accept: { 'application/json': ALL_COMPONENT_EXTENSIONS }
				}],
				multiple: false
			});

			const file = await handle.getFile();
			return importFile(file, {
				position,
				fileHandle: handle,
				fileName: handle.name
			});
		} catch (error: any) {
			if (error.name === 'AbortError') {
				return { success: false, type: 'model', cancelled: true };
			}
			console.error('Failed to open file:', error);
			return {
				success: false,
				type: 'model',
				error: 'Failed to open file. Make sure it is a valid PathView file.'
			};
		}
	}

	// Fallback for browsers without File System Access API
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = ALL_COMPONENT_EXTENSIONS.join(',');

		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) {
				resolve({ success: false, type: 'model', cancelled: true });
				return;
			}

			const result = await importFile(file, {
				position,
				fileName: file.name
			});
			resolve(result);
		};

		input.oncancel = () => resolve({ success: false, type: 'model', cancelled: true });
		input.click();
	});
}
