/**
 * Node type registry
 * Manages all registered node types and provides lookup functionality
 */

import type { NodeTypeDefinition, NodeCategory, ParamDefinition, ParamType } from './types';
import { defineNode } from './defineNode';
import {
	extractedBlocks,
	blockConfig,
	uiOverrides,
	type ExtractedBlock,
	type UIOverride
} from './generated/blocks';

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
 * Convert extracted block to node definition options
 */
function createNodeFromExtracted(
	name: string,
	category: NodeCategory,
	extracted: ExtractedBlock,
	override: UIOverride = {}
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

	// Determine inputs - use override defaults, extracted ports, or let defineNode use its defaults
	let inputs: string[] | undefined;
	if (override.defaultInputs && override.defaultInputs.length > 0) {
		inputs = override.defaultInputs;
	} else if (extracted.inputs.length > 0) {
		inputs = extracted.inputs;
	} else if (override.maxInputs === 0) {
		inputs = [];
	}
	// else: undefined - let defineNode use its default ['in 0']

	// Determine outputs - use override defaults, extracted ports, or let defineNode use its defaults
	let outputs: string[] | undefined;
	if (override.defaultOutputs && override.defaultOutputs.length > 0) {
		outputs = override.defaultOutputs;
	} else if (extracted.outputs.length > 0) {
		outputs = extracted.outputs;
	} else if (override.maxOutputs === 0) {
		outputs = [];
	}
	// else: undefined - let defineNode use its default ['out 0']

	const definition = defineNode({
		name,
		category,
		blockClass: extracted.blockClass,
		description: extracted.description,
		inputs,
		outputs,
		maxInputs: override.maxInputs,
		maxOutputs: override.maxOutputs,
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
			const override = uiOverrides[blockName as keyof typeof uiOverrides] || {};

			if (extracted) {
				createNodeFromExtracted(blockName, category as NodeCategory, extracted, override);
			} else {
				console.warn(`Block "${blockName}" not found in extracted blocks`);
			}
		}
	}
}

// Initialize on module load
initializeRegistry();
