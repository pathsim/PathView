/**
 * Subsystem node definitions
 * Defines Subsystem and Interface blocks for hierarchical graph composition
 */

import { defineNode } from './defineNode';
import { nodeRegistry } from './registry';
import { extractedBlocks } from './generated/blocks';

/**
 * Subsystem block - container for nested blocks
 * Double-click to drill down into the subsystem's internal graph
 * Ports are defined by Interface blocks inside the subsystem
 */
export const SubsystemDefinition = defineNode({
	name: 'Subsystem',
	category: 'Subsystem',
	description: '', // Set from extractedBlocks in registerSubsystemNodes
	blockClass: 'Subsystem',
	inputs: [], // Ports populated dynamically from Interface blocks
	outputs: [],
	minInputs: 0, // Ports controlled by Interface
	minOutputs: 0,
	maxInputs: null, // Dynamic based on Interface
	maxOutputs: null,
	shape: 'rect',
	params: {}
});

/**
 * Interface block - defines subsystem ports
 * Only valid inside a Subsystem. Connects internal signals to external ports.
 * Interface inputs → signals coming INTO the subsystem (parent's outputs)
 * Interface outputs → signals going OUT of the subsystem (parent's inputs)
 *
 * NOTE: Interface is auto-created when a Subsystem is placed, not shown in library.
 */
export const InterfaceDefinition = defineNode({
	name: 'Interface',
	category: 'Subsystem',
	description: '', // Set from extractedBlocks in registerSubsystemNodes
	blockClass: 'Interface',
	inputs: [], // Start empty - user adds ports as needed
	outputs: [],
	minInputs: 0, // Interface can have zero ports
	minOutputs: 0,
	maxInputs: null,
	maxOutputs: null,
	shape: 'rect',
	params: {}
});

/**
 * Register subsystem nodes
 * Called after the main registry is initialized
 * Descriptions and docstrings are set here (not at module init time) to ensure extractedBlocks is loaded
 */
export function registerSubsystemNodes(): void {
	// Set descriptions and docstrings from extracted PathSim documentation
	const subsystemData = extractedBlocks['Subsystem'];
	const interfaceData = extractedBlocks['Interface'];

	if (subsystemData) {
		SubsystemDefinition.description = subsystemData.description;
		SubsystemDefinition.docstring = subsystemData.docstringHtml;
	}

	if (interfaceData) {
		InterfaceDefinition.description = interfaceData.description;
		InterfaceDefinition.docstring = interfaceData.docstringHtml;
	}

	nodeRegistry.register(SubsystemDefinition);
	nodeRegistry.register(InterfaceDefinition);
}
