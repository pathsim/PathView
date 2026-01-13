/**
 * Component operations for exporting and importing blocks, subsystems, and models
 */

import type { NodeInstance, Connection } from '$lib/nodes/types';
import type { EventInstance } from '$lib/events/types';
import type { Position } from '$lib/types';
import type {
	ComponentFile,
	ComponentType,
	BlockContent,
	SubsystemContent,
	COMPONENT_EXTENSIONS
} from '$lib/types/component';
import { graphStore, regenerateGraphIds } from '$lib/stores/graph';
import { eventStore } from '$lib/stores/events';
import { historyStore } from '$lib/stores/history';
import { generateId } from '$lib/stores/utils';
import { NODE_TYPES } from '$lib/constants/nodeTypes';
import { nodeRegistry } from '$lib/nodes';
import { downloadJson } from '$lib/utils/download';
import { cleanNodeForExport } from './cleanParams';

const COMPONENT_VERSION = '1.0';

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
 * Check if File System Access API is available
 */
function hasFileSystemAccess(): boolean {
	return 'showSaveFilePicker' in window;
}

/**
 * Create a block component file from a node
 */
export function createBlockFile(node: NodeInstance): ComponentFile {
	// Deep clone and clean params
	const clonedNode = JSON.parse(JSON.stringify(node));
	const cleanedNode = cleanNodeForExport(clonedNode);

	// Remove graph property for blocks (only subsystems have graphs)
	delete cleanedNode.graph;

	return {
		version: COMPONENT_VERSION,
		type: 'block',
		metadata: {
			name: node.name,
			created: new Date().toISOString(),
			modified: new Date().toISOString()
		},
		content: {
			node: cleanedNode
		} as BlockContent
	};
}

/**
 * Create a subsystem component file from a subsystem node
 */
export function createSubsystemFile(node: NodeInstance): ComponentFile {
	if (node.type !== NODE_TYPES.SUBSYSTEM) {
		throw new Error('Node is not a subsystem');
	}

	// Deep clone and clean params (recursively for nested subsystems)
	const clonedNode = JSON.parse(JSON.stringify(node));
	const cleanedNode = cleanNodeForExport(clonedNode);

	return {
		version: COMPONENT_VERSION,
		type: 'subsystem',
		metadata: {
			name: node.name,
			created: new Date().toISOString(),
			modified: new Date().toISOString()
		},
		content: {
			node: cleanedNode
		} as SubsystemContent
	};
}

/**
 * Get file extension for component type
 */
function getExtension(type: ComponentType): string {
	const extensions: Record<ComponentType, string> = {
		block: '.blk',
		subsystem: '.sub',
		model: '.pvm'
	};
	return extensions[type];
}

/**
 * Get file type description for dialogs
 */
function getFileTypeDescription(type: ComponentType): string {
	const descriptions: Record<ComponentType, string> = {
		block: 'PathView Block',
		subsystem: 'PathView Subsystem',
		model: 'PathView Model'
	};
	return descriptions[type];
}

/**
 * Export a component to file (opens save dialog)
 */
export async function exportComponent(type: ComponentType, nodeId: string): Promise<boolean> {
	const node = graphStore.getNode(nodeId);
	if (!node) {
		console.error('Node not found:', nodeId);
		return false;
	}

	// Validate type matches node
	if (type === 'subsystem' && node.type !== NODE_TYPES.SUBSYSTEM) {
		console.error('Cannot export non-subsystem as subsystem');
		return false;
	}

	// Create the component file
	const componentFile = type === 'subsystem' ? createSubsystemFile(node) : createBlockFile(node);

	const extension = getExtension(type);
	const suggestedName = `${node.name}${extension}`;

	if (hasFileSystemAccess()) {
		try {
			const handle = await (window as any).showSaveFilePicker({
				suggestedName,
				types: [
					{
						description: getFileTypeDescription(type),
						accept: { 'application/json': [extension] }
					}
				]
			});

			const json = JSON.stringify(componentFile, null, 2);
			const writable = await handle.createWritable();
			await writable.write(json);
			await writable.close();
			return true;
		} catch (error: any) {
			if (error.name === 'AbortError') {
				return false; // User cancelled
			}
			console.error('Failed to save component:', error);
			// Fall through to download fallback
		}
	}

	// Fallback: download file
	downloadComponent(componentFile, suggestedName);
	return true;
}

/**
 * Download component file (fallback for browsers without File System Access API)
 */
function downloadComponent(file: ComponentFile, filename: string): void {
	downloadJson(file, filename);
}

/**
 * Detect file format from parsed JSON
 */
function detectFileFormat(
	json: unknown
): 'component' | 'legacy-model' | 'unknown' {
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
 * Load and validate a component file
 */
export async function loadComponentFile(file: File): Promise<ComponentFile> {
	const text = await file.text();
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
				name: json.metadata?.name || file.name.replace(/\.(json|pvm)$/, ''),
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
 * Import component into current graph at position
 * @returns IDs of imported nodes
 */
export async function importComponent(
	file: File,
	position: Position
): Promise<string[]> {
	const componentFile = await loadComponentFile(file);

	switch (componentFile.type) {
		case 'block':
			return importBlock(componentFile.content as BlockContent, position);
		case 'subsystem':
			return importSubsystem(componentFile.content as SubsystemContent, position);
		case 'model':
			// For now, model import not supported via context menu
			// Full models should be opened via File > Open
			console.warn('Model import not supported. Use File > Open instead.');
			return [];
		default:
			throw new Error(`Unknown component type: ${componentFile.type}`);
	}
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
 * Open file picker and import component at position
 */
export async function openComponentImportDialog(
	position: Position
): Promise<string[]> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.blk,.sub,.pvm,.json';

		input.onchange = async () => {
			if (input.files?.[0]) {
				try {
					const ids = await importComponent(input.files[0], position);
					resolve(ids);
				} catch (error) {
					console.error('Failed to import component:', error);
					alert('Failed to import component. Make sure it is a valid PathView file.');
					resolve([]);
				}
			} else {
				resolve([]);
			}
		};

		input.oncancel = () => resolve([]);
		input.click();
	});
}
