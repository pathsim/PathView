/**
 * Node type registry
 * Manages all registered node types and provides lookup functionality
 */

import type { NodeTypeDefinition, NodeCategory, ParamDefinition, ParamType } from './types';
import { defineNode } from './defineNode';
import { extractedBlocks, blockConfig, type ExtractedBlock } from './generated/blocks';

class NodeRegistry {
	private nodes: Map<string, NodeTypeDefinition> = new Map();
	private byCategory: Map<NodeCategory, NodeTypeDefinition[]> = new Map();

	/**
	 * Register a new node type
	 */
	register(definition: NodeTypeDefinition): void {
		this.nodes.set(definition.type, definition);

		const categoryNodes = this.byCategory.get(definition.category) || [];
		categoryNodes.push(definition);
		this.byCategory.set(definition.category, categoryNodes);
	}

	/**
	 * Get a node type by its type ID
	 */
	get(type: string): NodeTypeDefinition | undefined {
		return this.nodes.get(type);
	}

	/**
	 * Get all node types in a category
	 */
	getByCategory(category: NodeCategory): NodeTypeDefinition[] {
		return this.byCategory.get(category) || [];
	}

	/**
	 * Get all registered categories
	 */
	getAllCategories(): NodeCategory[] {
		return Array.from(this.byCategory.keys());
	}

	/**
	 * Get all registered node types
	 */
	getAll(): NodeTypeDefinition[] {
		return Array.from(this.nodes.values());
	}

	/**
	 * Check if a node type is registered
	 */
	has(type: string): boolean {
		return this.nodes.has(type);
	}

	/**
	 * Get the count of registered nodes
	 */
	get size(): number {
		return this.nodes.size;
	}
}

// Export singleton instance
export const nodeRegistry = new NodeRegistry();

/**
 * Convert extracted block to node definition
 *
 * Port semantics from Block.info():
 * - null: Variable/unlimited ports (UI allows add/remove)
 * - []: No ports of this type
 * - ["in", "out"]: Fixed labeled ports (locked count)
 */
function createNodeFromExtracted(
	name: string,
	category: NodeCategory,
	extracted: ExtractedBlock
): void {
	// Build params from extracted data
	const params: Record<
		string,
		{
			type: ParamType;
			default: unknown;
			description?: string;
			min?: number;
			max?: number;
			options?: string[];
		}
	> = {};

	for (const [paramName, paramInfo] of Object.entries(extracted.params)) {
		params[paramName] = {
			type: paramInfo.type as ParamType,
			default: paramInfo.default,
			description: paramInfo.description,
			min: paramInfo.min,
			max: paramInfo.max,
			options: paramInfo.options
		};
	}

	// Determine inputs from extracted data
	let inputs: string[] | undefined;
	let maxInputs: number | null;

	if (extracted.inputs === null) {
		// Variable ports - use default, UI will allow add/remove
		inputs = undefined; // defineNode will use ['in 0']
		maxInputs = null; // unlimited
	} else if (extracted.inputs.length > 0) {
		// Fixed labeled ports
		inputs = extracted.inputs;
		maxInputs = extracted.inputs.length;
	} else {
		// Empty array means no inputs
		inputs = [];
		maxInputs = 0;
	}

	// Determine outputs from extracted data
	let outputs: string[] | undefined;
	let maxOutputs: number | null;

	if (extracted.outputs === null) {
		// Variable ports - use default, UI will allow add/remove
		outputs = undefined; // defineNode will use ['out 0']
		maxOutputs = null; // unlimited
	} else if (extracted.outputs.length > 0) {
		// Fixed labeled ports
		outputs = extracted.outputs;
		maxOutputs = extracted.outputs.length;
	} else {
		// Empty array means no outputs
		outputs = [];
		maxOutputs = 0;
	}

	const definition = defineNode({
		name,
		category,
		blockClass: extracted.blockClass,
		description: extracted.description,
		inputs,
		outputs,
		maxInputs,
		maxOutputs,
		params
	});

	// Add docstringHtml from extracted data
	if (extracted.docstringHtml) {
		definition.docstring = extracted.docstringHtml;
	}

	nodeRegistry.register(definition);
}

/**
 * Initialize registry with all blocks from generated data
 */
function initializeRegistry(): void {
	for (const [category, blockNames] of Object.entries(blockConfig)) {
		for (const blockName of blockNames) {
			const extracted = extractedBlocks[blockName as keyof typeof extractedBlocks];

			if (extracted) {
				createNodeFromExtracted(blockName, category as NodeCategory, extracted);
			} else {
				console.warn(`Block "${blockName}" not found in extracted blocks`);
			}
		}
	}
}

// Initialize on module load
initializeRegistry();
