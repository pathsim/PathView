/**
 * PathSim Runner
 * Converts graph state to Python code and runs simulations
 */

import type { NodeInstance, Connection, SimulationSettings } from '$lib/nodes/types';
import { DEFAULT_SIMULATION_SETTINGS } from '$lib/nodes/types';
import type { EventInstance } from '$lib/events/types';
import { nodeRegistry } from '$lib/nodes/registry';
import { eventRegistry } from '$lib/events/registry';
import { NODE_TYPES } from '$lib/constants/nodeTypes';
import { BLOCK_CATEGORY_ORDER } from '$lib/constants/python';
import { isSubsystem, isInterface } from '$lib/nodes/shapes';
import { blockImportPaths } from '$lib/nodes/generated/blocks';
import { graphStore, findParentSubsystem } from '$lib/stores/graph';
import {
	runStreamingSimulation,
	validateGraph as validateGraphBridge,
	type SimulationResult,
	type ValidationResult
} from './bridge';
import {
	generateParamString,
	generateConnectionLines,
	generateNamedConnections,
	generateListDefinition,
	sanitizeName
} from './codeBuilder';

// Re-export sanitizeName for external use
export { sanitizeName } from './codeBuilder';

/**
 * Get setting value or fall back to default
 */
function getSettingOrDefault<K extends keyof SimulationSettings>(
	settings: SimulationSettings,
	key: K
): SimulationSettings[K] {
	const value = settings[key];
	if (value === '' || value === null || value === undefined) {
		return DEFAULT_SIMULATION_SETTINGS[key];
	}
	return value;
}


/**
 * Generate block parameter string (skips internal params starting with _)
 */
function generateBlockParams(
	params: Record<string, unknown>,
	validParamNames: Set<string>,
	multiLine: boolean = false
): string {
	return generateParamString(params, validParamNames, {
		multiLine,
		skipInternal: true
	});
}

/**
 * Generate event parameter string
 */
function generateEventParams(
	params: Record<string, unknown>,
	validParamNames: Set<string>,
	multiLine: boolean = false
): string {
	return generateParamString(params, validParamNames, { multiLine });
}


/**
 * Generate event definitions and return event variable names
 */
function generateEventDefinitions(
	events: EventInstance[],
	existingVarNames: string[],
	lines: string[],
	multiLine: boolean = false
): string[] {
	const eventVarNames: string[] = [];

	for (const event of events) {
		const typeDef = eventRegistry.get(event.type);
		if (!typeDef) continue;

		let varName = sanitizeName(event.name);
		if (!varName || existingVarNames.includes(varName) || eventVarNames.includes(varName)) {
			varName = `event_${eventVarNames.length}`;
		}
		eventVarNames.push(varName);

		const validParamNames = new Set(typeDef.params.map(p => p.name));
		const params = generateEventParams(event.params, validParamNames, multiLine);

		if (params) {
			lines.push(`${varName} = ${typeDef.eventClass}(${params})`);
		} else {
			lines.push(`${varName} = ${typeDef.eventClass}()`);
		}
	}

	return eventVarNames;
}


/**
 * Generate the Simulation constructor
 */
function generateSimulationSetup(
	settings: SimulationSettings,
	hasEvents: boolean,
	lines: string[],
	indent: string = '    '
): void {
	lines.push('sim = Simulation(');
	lines.push(`${indent}blocks,`);
	lines.push(`${indent}connections,`);
	if (hasEvents) {
		lines.push(`${indent}events,`);
	}
	lines.push(`${indent}Solver=${getSettingOrDefault(settings, 'solver')},`);
	lines.push(`${indent}dt=${getSettingOrDefault(settings, 'dt')},`);
	lines.push(`${indent}dt_min=${getSettingOrDefault(settings, 'dt_min')},`);

	const dtMax = getSettingOrDefault(settings, 'dt_max');
	if (dtMax) {
		lines.push(`${indent}dt_max=${dtMax},`);
	}

	lines.push(`${indent}tolerance_lte_rel=${getSettingOrDefault(settings, 'rtol')},`);
	lines.push(`${indent}tolerance_lte_abs=${getSettingOrDefault(settings, 'atol')},`);
	lines.push(`${indent}tolerance_fpi=${getSettingOrDefault(settings, 'ftol')},`);
	lines.push(')');
}

/**
 * Recursively collect all nodes including those inside subsystems
 */
function getAllNodesRecursively(nodes: NodeInstance[]): NodeInstance[] {
	const allNodes: NodeInstance[] = [];
	for (const node of nodes) {
		allNodes.push(node);
		if (isSubsystem(node)) {
			allNodes.push(...getAllNodesRecursively(node.graph?.nodes ?? []));
		}
	}
	return allNodes;
}

/**
 * Collect block classes used across all nodes, grouped by Python import path.
 * Excludes Subsystem/Interface (imported from pathsim directly).
 */
function collectBlockImportGroups(nodes: NodeInstance[]): Map<string, Set<string>> {
	const allNodes = getAllNodesRecursively(nodes);
	const groups = new Map<string, Set<string>>();

	for (const node of allNodes) {
		if (isSubsystem(node) || isInterface(node)) continue;
		const typeDef = nodeRegistry.get(node.type);
		if (!typeDef) continue;

		const importPath = blockImportPaths[typeDef.blockClass] || 'pathsim.blocks';
		if (!groups.has(importPath)) groups.set(importPath, new Set());
		groups.get(importPath)!.add(typeDef.blockClass);
	}

	return groups;
}

/** Options for subsystem code generation */
interface SubsystemCodeOptions {
	/** Use multi-line formatting with keyword arguments (for export) */
	formatted?: boolean;
}

/**
 * Generate code for a subsystem and its contents
 * Returns the variable name for the subsystem
 */
function generateSubsystemCode(
	subsystemNode: NodeInstance,
	nodeVars: Map<string, string>,
	varNames: string[],
	lines: string[],
	prefix: string = '',
	options: SubsystemCodeOptions = {}
): string {
	const { formatted = false } = options;
	const childNodes = subsystemNode.graph?.nodes ?? [];
	const childConnections = subsystemNode.graph?.connections ?? [];
	const childEvents = subsystemNode.graph?.events ?? [];

	// Generate subsystem variable name
	let subsystemVarName = sanitizeName(subsystemNode.name);
	if (!subsystemVarName || varNames.includes(subsystemVarName)) {
		subsystemVarName = `subsystem_${varNames.length}`;
	}
	varNames.push(subsystemVarName);
	nodeVars.set(subsystemNode.id, subsystemVarName);

	const subPrefix = prefix + subsystemVarName + '_';

	// Find Interface block(s) inside this subsystem
	const interfaceNodes = childNodes.filter(isInterface);

	// Generate internal blocks (excluding Interface - it's handled separately)
	const internalBlocks = childNodes.filter((n) => !isInterface(n));
	const internalVarNames: string[] = [];
	const internalNodeVars = new Map<string, string>();

	// Add section comment for formatted output
	if (formatted) {
		lines.push('');
		lines.push(`# Subsystem: ${subsystemNode.name}`);
	}

	// First, generate Interface block
	for (const iface of interfaceNodes) {
		const ifaceVarName = subPrefix + 'interface';
		internalVarNames.push(ifaceVarName);
		internalNodeVars.set(iface.id, ifaceVarName);
		lines.push(`${ifaceVarName} = Interface()`);
	}

	// Generate internal blocks
	for (const node of internalBlocks) {
		// Check if this is a nested subsystem
		if (isSubsystem(node)) {
			// Recursively generate nested subsystem
			generateSubsystemCode(
				node,
				internalNodeVars,
				internalVarNames,
				lines,
				subPrefix,
				options
			);
		} else {
			const typeDef = nodeRegistry.get(node.type);
			if (!typeDef) continue;

			let varName = subPrefix + sanitizeName(node.name);
			if (!varName || internalVarNames.includes(varName)) {
				varName = `${subPrefix}block_${internalVarNames.length}`;
			}
			internalVarNames.push(varName);
			internalNodeVars.set(node.id, varName);

			const validParamNames = new Set(typeDef.params.map((p) => p.name));
			const params = generateBlockParams(node.params, validParamNames, formatted);

			if (params) {
				lines.push(`${varName} = ${typeDef.blockClass}(${params})`);
			} else {
				lines.push(`${varName} = ${typeDef.blockClass}()`);
			}
		}
	}

	// Propagate internal block IDs to parent nodeVars (for _node_id_map)
	for (const [nodeId, varName] of internalNodeVars) {
		nodeVars.set(nodeId, varName);
	}

	// Generate internal events (need to be defined before Subsystem constructor)
	const eventVarNames: string[] = [];
	if (childEvents.length > 0) {
		for (const event of childEvents) {
			const typeDef = eventRegistry.get(event.type);
			if (!typeDef) continue;

			let eventVarName = subPrefix + sanitizeName(event.name);
			if (!eventVarName || varNames.includes(eventVarName) || eventVarNames.includes(eventVarName)) {
				eventVarName = `${subPrefix}event_${eventVarNames.length}`;
			}
			eventVarNames.push(eventVarName);

			const validParamNames = new Set(typeDef.params.map(p => p.name));
			const params = generateEventParams(event.params, validParamNames, formatted);

			if (params) {
				lines.push(`${eventVarName} = ${typeDef.eventClass}(${params})`);
			} else {
				lines.push(`${eventVarName} = ${typeDef.eventClass}()`);
			}
		}
	}

	// Connection variables (named for mutation support)
	const subConnPrefix = `${subsystemVarName}_conn`;
	const subConnResult = generateNamedConnections(childConnections, internalNodeVars, subConnPrefix);
	for (const line of subConnResult.lines) {
		lines.push(line);
	}

	// Create Subsystem with inline blocks and connections using kwargs
	lines.push(`${subsystemVarName} = Subsystem(`);

	// Blocks list
	lines.push('    blocks=[');
	for (const varName of internalVarNames) {
		lines.push(`        ${varName},`);
	}
	lines.push('    ],');

	// Connections list (referencing named variables)
	lines.push('    connections=[');
	for (const connVarName of subConnResult.varNames) {
		lines.push(`        ${connVarName},`);
	}
	lines.push('    ],');

	// Events list (if any)
	if (childEvents.length > 0) {
		lines.push('    events=[');
		for (const eventVarName of eventVarNames) {
			lines.push(`        ${eventVarName},`);
		}
		lines.push('    ],');
	}

	lines.push(')');
	if (!formatted) {
		lines.push('');
	}

	return subsystemVarName;
}

/**
 * Group nodes by category
 */
function groupNodesByCategory(
	nodes: NodeInstance[]
): Map<string, { node: NodeInstance; typeDef: ReturnType<typeof nodeRegistry.get> }[]> {
	const groups = new Map<string, { node: NodeInstance; typeDef: ReturnType<typeof nodeRegistry.get> }[]>();

	for (const node of nodes) {
		const typeDef = nodeRegistry.get(node.type);
		if (!typeDef) continue;

		const category = typeDef.category || 'Other';
		if (!groups.has(category)) {
			groups.set(category, []);
		}
		groups.get(category)!.push({ node, typeDef });
	}

	return groups;
}

/**
 * Generate Python code from graph state
 * @param includeNodeIdMap - Include node ID mapping for web data extraction (default: true)
 * @param includeRun - Append sim.run() call (default: true, false for streaming)
 */
/** Result of Python code generation, includes variable mappings for mutation support */
export interface CodeGenResult {
	code: string;
	nodeVars: Map<string, string>;   // nodeId → Python variable name
	connVars: Map<string, string>;   // connectionId → Python variable name
}

export function generatePythonCode(
	nodes: NodeInstance[],
	connections: Connection[],
	settings: SimulationSettings,
	codeContext: string,
	includeNodeIdMap: boolean = true,
	events: EventInstance[] = [],
	includeRun: boolean = true
): CodeGenResult {
	const lines: string[] = [];

	// Check if we have any subsystems
	const hasSubsystems = nodes.some(isSubsystem);

	// Check if we have any events
	const hasEvents = events.length > 0;
	const eventClasses = new Set(
		events.map(e => eventRegistry.get(e.type)?.eventClass).filter(Boolean)
	);

	// Collect block import paths dynamically
	const importGroups = collectBlockImportGroups(nodes);

	// 1. Imports
	lines.push('# IMPORTS');
	lines.push('import numpy as np');
	if (hasSubsystems) {
		lines.push('from pathsim import Simulation, Connection, Subsystem, Interface');
	} else {
		lines.push('from pathsim import Simulation, Connection');
	}
	for (const [importPath] of importGroups) {
		lines.push(`from ${importPath} import *`);
	}
	// Ensure at least pathsim.blocks is imported even if no blocks
	if (!importGroups.has('pathsim.blocks')) {
		lines.push('from pathsim.blocks import *');
	}
	lines.push(`from pathsim.solvers import ${getSettingOrDefault(settings, 'solver')}`);
	if (hasEvents) {
		lines.push(`from pathsim.events import ${[...eventClasses].join(', ')}`);
	}
	lines.push('');

	// 2. Code context (user-defined variables/functions)
	if (codeContext.trim()) {
		lines.push('# CODE CONTEXT');
		lines.push(codeContext.trim());
		lines.push('');
	}

	// 3. Create blocks
	lines.push('# BLOCKS');
	const nodeVars = new Map<string, string>();
	const varNames: string[] = [];

	// First, generate subsystems (they need to be defined before being used)
	const subsystemNodes = nodes.filter(isSubsystem);
	for (const subsystemNode of subsystemNodes) {
		generateSubsystemCode(subsystemNode, nodeVars, varNames, lines);
	}

	// Then generate regular blocks (excluding subsystems and interfaces)
	const regularNodes = nodes.filter((n) => !isSubsystem(n) && !isInterface(n));

	regularNodes.forEach((node, index) => {
		const typeDef = nodeRegistry.get(node.type);
		if (!typeDef) {
			console.warn(`Unknown node type: ${node.type}`);
			return;
		}

		let varName = sanitizeName(node.name);
		if (!varName || varNames.includes(varName)) {
			varName = `block_${index}`;
		}
		varNames.push(varName);
		nodeVars.set(node.id, varName);

		const validParamNames = new Set(typeDef.params.map(p => p.name));
		const params = generateBlockParams(node.params, validParamNames);

		if (params) {
			lines.push(`${varName} = ${typeDef.blockClass}(${params})`);
		} else {
			lines.push(`${varName} = ${typeDef.blockClass}()`);
		}
	});

	lines.push('');
	lines.push(...generateListDefinition('blocks', varNames));
	lines.push('');

	// Create node ID mapping for data extraction (only for web simulation)
	if (includeNodeIdMap) {
		lines.push('# NODE ID MAPPING (for data extraction)');
		lines.push('_node_id_map = {');
		for (const [nodeId, varName] of nodeVars) {
			lines.push(`    id(${varName}): "${nodeId}",`);
		}
		lines.push('}');
		lines.push('');

		lines.push('# NODE NAME MAPPING');
		lines.push('_node_name_map = {');
		const allNodes = getAllNodesRecursively(nodes);
		for (const node of allNodes) {
			const escapedName = node.name.replace(/"/g, '\\"');
			lines.push(`    "${node.id}": "${escapedName}",`);
		}
		lines.push('}');
		lines.push('');
	}

	// 4. Connections (named variables for mutation support)
	lines.push('# CONNECTIONS');
	const connResult = generateNamedConnections(connections, nodeVars);
	for (const line of connResult.lines) {
		lines.push(line);
	}
	lines.push(...generateListDefinition('connections', connResult.varNames));
	lines.push('');

	// 5. Events (if any)
	if (hasEvents) {
		lines.push('# EVENTS');
		const eventVarNames = generateEventDefinitions(events, varNames, lines);
		lines.push('');
		lines.push(...generateListDefinition('events', eventVarNames));
		lines.push('');
	}

	// 6. Simulation setup
	lines.push('# SIMULATION');
	generateSimulationSetup(settings, hasEvents, lines);

	// 7. Run simulation (omitted for streaming mode)
	if (includeRun) {
		lines.push('');
		lines.push('# RUN');
		lines.push(`sim.run(duration=${getSettingOrDefault(settings, 'duration')}, reset=True)`);
	}

	return { code: lines.join('\n'), nodeVars, connVars: connResult.connVars };
}

/**
 * Generate well-formatted Python code for standalone export
 */
function generateFormattedPythonCode(
	nodes: NodeInstance[],
	connections: Connection[],
	settings: SimulationSettings,
	codeContext: string,
	events: EventInstance[] = []
): string {
	const lines: string[] = [];
	const divider = '# ' + '─'.repeat(76);
	const now = new Date();
	const timestamp = now.toISOString().replace('T', ' ').split('.')[0];

	// Header banner
	lines.push('#!/usr/bin/env python3');
	lines.push('# -*- coding: utf-8 -*-');
	lines.push('"""');
	lines.push('PathSim Simulation');
	lines.push('==================');
	lines.push('');
	lines.push(`Generated by PathView on ${timestamp}`);
	lines.push('https://view.pathsim.org');
	lines.push('');
	lines.push('PathSim documentation: https://docs.pathsim.org');
	lines.push('"""');
	lines.push('');

	// Check if we have subsystems
	const hasSubsystems = nodes.some(isSubsystem);

	// Check if we have events
	const hasEvents = events.length > 0;
	const eventClasses = new Set(
		events.map(e => eventRegistry.get(e.type)?.eventClass).filter(Boolean)
	);

	// Imports section
	lines.push(divider);
	lines.push('# IMPORTS');
	lines.push(divider);
	lines.push('');
	lines.push('import numpy as np');
	lines.push('import matplotlib.pyplot as plt');
	lines.push('');
	if (hasSubsystems) {
		lines.push('from pathsim import Simulation, Connection, Subsystem, Interface');
	} else {
		lines.push('from pathsim import Simulation, Connection');
	}

	// Collect block classes grouped by import path
	const importGroups = collectBlockImportGroups(nodes);

	// Generate explicit imports for each import path
	for (const [importPath, classes] of importGroups) {
		const sorted = [...classes].sort();
		if (sorted.length === 1) {
			lines.push(`from ${importPath} import ${sorted[0]}`);
		} else {
			lines.push(`from ${importPath} import (`);
			for (let i = 0; i < sorted.length; i++) {
				const comma = i < sorted.length - 1 ? ',' : '';
				lines.push(`    ${sorted[i]}${comma}`);
			}
			lines.push(')');
		}
	}

	lines.push(`from pathsim.solvers import ${getSettingOrDefault(settings, 'solver')}`);
	if (hasEvents) {
		lines.push(`from pathsim.events import ${[...eventClasses].join(', ')}`);
	}
	lines.push('');

	// Code context (user-defined variables/functions)
	if (codeContext.trim()) {
		lines.push(divider);
		lines.push('# USER-DEFINED CODE');
		lines.push(divider);
		lines.push('');
		lines.push(codeContext.trim());
		lines.push('');
	}

	// Blocks section - grouped by category
	lines.push(divider);
	lines.push('# BLOCKS');
	lines.push(divider);

	const nodeVars = new Map<string, string>();
	const varNames: string[] = [];
	let nodeIndex = 0;

	// With nested structure, input nodes are already root-level
	const rootNodes = nodes;

	// First, generate subsystems (they need to be defined before being used in connections)
	const subsystemNodes = rootNodes.filter(isSubsystem);
	for (const subsystemNode of subsystemNodes) {
		generateSubsystemCode(subsystemNode, nodeVars, varNames, lines, '', { formatted: true });
	}

	// Then generate regular blocks (excluding subsystems and interfaces)
	// Group only root-level, non-subsystem, non-interface nodes
	const regularRootNodes = rootNodes.filter((n) => !isSubsystem(n) && !isInterface(n));
	const regularBlocksByCategory = groupNodesByCategory(regularRootNodes);

	for (const category of BLOCK_CATEGORY_ORDER) {
		if (category === 'Subsystem') continue; // Already handled above
		const group = regularBlocksByCategory.get(category);
		if (!group || group.length === 0) continue;

		lines.push('');
		lines.push(`# ${category}`);

		for (const { node, typeDef } of group) {
			// Generate variable name
			let varName = sanitizeName(node.name);
			if (!varName || varNames.includes(varName)) {
				varName = `block_${nodeIndex}`;
			}
			varNames.push(varName);
			nodeVars.set(node.id, varName);
			nodeIndex++;

			// Get valid param names from type definition
			const validParamNames = new Set(typeDef!.params.map((p) => p.name));

			// Generate parameter string (multi-line for readability)
			const params = generateBlockParams(node.params, validParamNames, true);

			if (params) {
				lines.push(`${varName} = ${typeDef!.blockClass}(${params})`);
			} else {
				lines.push(`${varName} = ${typeDef!.blockClass}()`);
			}
		}
	}

	// Handle any remaining categories (excluding Subsystem)
	for (const [category, group] of regularBlocksByCategory) {
		if (BLOCK_CATEGORY_ORDER.includes(category)) continue;

		lines.push('');
		lines.push(`# ${category}`);

		for (const { node, typeDef } of group) {
			let varName = sanitizeName(node.name);
			if (!varName || varNames.includes(varName)) {
				varName = `block_${nodeIndex}`;
			}
			varNames.push(varName);
			nodeVars.set(node.id, varName);
			nodeIndex++;

			const validParamNames = new Set(typeDef!.params.map((p) => p.name));
			const params = generateBlockParams(node.params, validParamNames, true);

			if (params) {
				lines.push(`${varName} = ${typeDef!.blockClass}(${params})`);
			} else {
				lines.push(`${varName} = ${typeDef!.blockClass}()`);
			}
		}
	}

	// Add blocks list at end of section
	lines.push('');
	lines.push(...generateListDefinition('blocks', varNames));
	lines.push('');

	// Connections section
	lines.push(divider);
	lines.push('# CONNECTIONS');
	lines.push(divider);
	lines.push('');

	// Connections (named variables for mutation support)
	if (connections.length === 0) {
		lines.push('connections = []');
	} else {
		const connResult = generateNamedConnections(connections, nodeVars);
		for (const line of connResult.lines) {
			lines.push(line);
		}
		lines.push('');
		lines.push(...generateListDefinition('connections', connResult.varNames));
	}
	lines.push('');

	// Events section (if any)
	if (hasEvents) {
		lines.push(divider);
		lines.push('# EVENTS');
		lines.push(divider);
		lines.push('');
		const eventVarNames = generateEventDefinitions(events, varNames, lines, true);
		lines.push('');
		lines.push(...generateListDefinition('events', eventVarNames));
		lines.push('');
	}

	// Simulation section
	lines.push(divider);
	lines.push('# SIMULATION');
	lines.push(divider);
	lines.push('');
	generateSimulationSetup(settings, hasEvents, lines);
	lines.push('');

	// Main block
	lines.push(divider);
	lines.push('# MAIN');
	lines.push(divider);
	lines.push('');
	lines.push("if __name__ == '__main__':");
	lines.push('');
	lines.push('    # Run simulation');
	lines.push(`    sim.run(duration=${getSettingOrDefault(settings, 'duration')})`);
	lines.push('');
	lines.push('    # Plot results');
	lines.push('    sim.plot()');
	lines.push('    plt.show()');
	lines.push('');

	return lines.join('\n');
}

/**
 * Run streaming simulation from graph state with live updates
 * @param onUpdate - Callback called for each streaming update
 */
export async function runGraphStreamingSimulation(
	nodes: NodeInstance[],
	connections: Connection[],
	settings: SimulationSettings,
	codeContext: string,
	events: EventInstance[] = [],
	onUpdate?: (result: SimulationResult) => void
): Promise<SimulationResult | null> {
	// Generate code without sim.run() - streaming will handle execution
	const result = generatePythonCode(nodes, connections, settings, codeContext, true, events, false);
	const duration = getSettingOrDefault(settings, 'duration');
	return runStreamingSimulation(result.code, String(duration), onUpdate);
}

/**
 * Export graph to standalone Python script
 */
export function exportToPython(
	nodes: NodeInstance[],
	connections: Connection[],
	settings: SimulationSettings,
	codeContext: string,
	events: EventInstance[] = []
): string {
	return generateFormattedPythonCode(nodes, connections, settings, codeContext, events);
}

/**
 * Generate Python code for a single block
 * For Subsystem blocks, generates the full hierarchical code with internal blocks/connections
 */
export function generateBlockCode(
	node: NodeInstance,
	allNodes?: NodeInstance[],
	allConnections?: Connection[]
): string {
	const typeDef = nodeRegistry.get(node.type);
	if (!typeDef) return '';

	// Handle Interface blocks - generate parent Subsystem code instead
	if (node.type === NODE_TYPES.INTERFACE) {
		const rootNodes = allNodes || graphStore.getAllNodes();
		const parentSubsystem = findParentSubsystem(rootNodes, node.id);
		if (parentSubsystem) {
			return generateBlockCode(parentSubsystem, allNodes, allConnections);
		}
		return '# Interface block (no parent subsystem found)';
	}

	const varName = sanitizeName(node.name) || 'block';

	// Handle Subsystem blocks specially - generate full hierarchical code
	if (node.type === NODE_TYPES.SUBSYSTEM && allNodes && allConnections) {
		const lines: string[] = [];
		const nodeVars = new Map<string, string>();
		const varNames: string[] = [];

		generateSubsystemCode(node, nodeVars, varNames, lines, '', { formatted: true });

		return lines.join('\n');
	}

	// Regular block - simple code generation
	const validParamNames = new Set(typeDef.params.map((p) => p.name));
	const params = generateBlockParams(node.params, validParamNames, true);

	if (params) {
		return `${varName} = ${typeDef.blockClass}(${params})`;
	}
	return `${varName} = ${typeDef.blockClass}()`;
}

/**
 * Generate Python code for a single event instance
 */
export function generateSingleEventCode(event: EventInstance): string {
	const typeDef = eventRegistry.get(event.type);
	if (!typeDef) return '';

	const varName = sanitizeName(event.name) || 'event';
	const validParamNames = new Set(typeDef.params.map((p) => p.name));
	const params = generateEventParams(event.params, validParamNames, true);

	if (params) {
		return `${varName} = ${typeDef.eventClass}(${params})`;
	}
	return `${varName} = ${typeDef.eventClass}()`;
}

/**
 * Extract node parameters for validation
 * Returns a map of nodeId -> { paramName: paramValue }
 */
function extractNodeParams(nodes: NodeInstance[]): Record<string, Record<string, string>> {
	const result: Record<string, Record<string, string>> = {};

	for (const node of nodes) {
		const typeDef = nodeRegistry.get(node.type);
		if (!typeDef) continue;

		const validParamNames = new Set(typeDef.params.map((p) => p.name));
		const nodeParams: Record<string, string> = {};

		for (const [name, value] of Object.entries(node.params)) {
			// Skip null/undefined/empty
			if (value === null || value === undefined || value === '') continue;
			// Skip internal params
			if (name.startsWith('_')) continue;
			// Skip params not in type definition
			if (!validParamNames.has(name)) continue;

			nodeParams[name] = String(value);
		}

		if (Object.keys(nodeParams).length > 0) {
			result[node.id] = nodeParams;
		}
	}

	return result;
}

/**
 * Validate graph before running simulation
 * Checks code context syntax and all parameter expressions
 */
export async function validateGraphSimulation(
	nodes: NodeInstance[],
	codeContext: string
): Promise<ValidationResult> {
	const nodeParams = extractNodeParams(nodes);
	return validateGraphBridge(codeContext, nodeParams);
}

export type { ValidationResult };
