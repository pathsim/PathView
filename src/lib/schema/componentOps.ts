/**
 * Component export operations for blocks and subsystems
 *
 * Note: Import operations have been consolidated into fileOps.ts
 * Use openImportDialog() or importFile() from fileOps.ts for imports.
 */

import type { NodeInstance } from '$lib/nodes/types';
import type { ComponentFile, ComponentType, BlockContent, SubsystemContent } from '$lib/types/component';
import { COMPONENT_VERSION } from '$lib/types/component';
import { graphStore } from '$lib/stores/graph';
import { NODE_TYPES } from '$lib/constants/nodeTypes';
import { downloadJson } from '$lib/utils/download';
import { cleanNodeForExport } from './cleanParams';
import { hasFileSystemAccess } from './fileOps';

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
 * Download component file (fallback for browsers without File System Access API)
 */
function downloadComponent(file: ComponentFile, filename: string): void {
	downloadJson(file, filename);
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
