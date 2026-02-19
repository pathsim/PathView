/**
 * Mutation Queue
 * Tracks graph changes (add/remove blocks, connections, events, parameter/settings changes)
 * as Python code strings to be applied to the worker namespace on "Continue".
 *
 * On "Run": queue is cleared (fresh namespace).
 * On "Continue": queue is flushed → executed in worker → then new streaming generator starts.
 */

import type { NodeInstance, Connection } from '$lib/nodes/types';
import { nodeRegistry } from '$lib/nodes/registry';
import { sanitizeName } from './codeBuilder';

/**
 * A queued mutation — a Python code string to execute in the worker namespace.
 */
interface Mutation {
	type: 'add-block' | 'remove-block' | 'add-connection' | 'remove-connection' |
		  'add-event' | 'remove-event' | 'update-param' | 'update-setting';
	code: string;
}

/** Active variable name mappings from the last run */
let activeNodeVars = new Map<string, string>();   // nodeId → Python var name
let activeConnVars = new Map<string, string>();    // connectionId → Python var name

/** Counter for dynamically added connections */
let dynamicConnCounter = 0;

/** The pending mutation queue */
const queue: Mutation[] = [];

/**
 * Initialize mappings from a fresh run's code generation result.
 * Called when "Run" starts.
 */
export function initMappings(nodeVars: Map<string, string>, connVars: Map<string, string>): void {
	activeNodeVars = new Map(nodeVars);
	activeConnVars = new Map(connVars);
	dynamicConnCounter = 0;
	queue.length = 0;
}

/**
 * Clear the mutation queue (on fresh Run).
 */
export function clearQueue(): void {
	queue.length = 0;
}

/**
 * Get all pending mutations and clear the queue.
 * Returns a single Python code string to execute.
 */
export function flushQueue(): string | null {
	if (queue.length === 0) return null;
	const code = queue.map(m => m.code).join('\n');
	queue.length = 0;
	return code;
}

/**
 * Check if there are pending mutations.
 */
export function hasPendingMutations(): boolean {
	return queue.length > 0;
}

/**
 * Check if the mutation queue is active (a simulation has been run).
 */
export function isActive(): boolean {
	return activeNodeVars.size > 0;
}

// --- Mutation generators ---

/**
 * Queue adding a new block to the simulation.
 */
export function queueAddBlock(node: NodeInstance): void {
	if (!isActive()) return;

	const typeDef = nodeRegistry.get(node.type);
	if (!typeDef) return;

	const existingNames = new Set(activeNodeVars.values());
	let varName = sanitizeName(node.name);
	if (!varName || existingNames.has(varName)) {
		varName = `block_dyn_${dynamicConnCounter++}`;
	}
	activeNodeVars.set(node.id, varName);

	const validParamNames = new Set(typeDef.params.map(p => p.name));
	const paramParts: string[] = [];
	for (const [name, value] of Object.entries(node.params)) {
		if (value === null || value === undefined || value === '') continue;
		if (name.startsWith('_')) continue;
		if (!validParamNames.has(name)) continue;
		paramParts.push(`${name}=${value}`);
	}
	const params = paramParts.join(', ');
	const constructor = params ? `${typeDef.blockClass}(${params})` : `${typeDef.blockClass}()`;

	queue.push({
		type: 'add-block',
		code: [
			`${varName} = ${constructor}`,
			`sim.add_block(${varName})`,
			`blocks.append(${varName})`,
			`_node_id_map[id(${varName})] = "${node.id}"`,
			`_node_name_map["${node.id}"] = "${node.name.replace(/"/g, '\\"')}"`
		].join('\n')
	});
}

/**
 * Queue removing a block from the simulation.
 */
export function queueRemoveBlock(nodeId: string): void {
	const varName = activeNodeVars.get(nodeId);
	if (!varName) return;

	queue.push({
		type: 'remove-block',
		code: [
			`sim.remove_block(${varName})`,
			`blocks.remove(${varName})`,
			`_node_id_map.pop(id(${varName}), None)`,
			`_node_name_map.pop("${nodeId}", None)`
		].join('\n')
	});

	activeNodeVars.delete(nodeId);
}

/**
 * Queue adding a new connection to the simulation.
 */
export function queueAddConnection(conn: Connection): void {
	if (!isActive()) return;

	const sourceVar = activeNodeVars.get(conn.sourceNodeId);
	const targetVar = activeNodeVars.get(conn.targetNodeId);
	if (!sourceVar || !targetVar) return;

	const varName = `conn_dyn_${dynamicConnCounter++}`;
	activeConnVars.set(conn.id, varName);

	queue.push({
		type: 'add-connection',
		code: [
			`${varName} = Connection(${sourceVar}[${conn.sourcePortIndex}], ${targetVar}[${conn.targetPortIndex}])`,
			`sim.add_connection(${varName})`,
			`connections.append(${varName})`
		].join('\n')
	});
}

/**
 * Queue removing a connection from the simulation.
 */
export function queueRemoveConnection(connId: string): void {
	const varName = activeConnVars.get(connId);
	if (!varName) return;

	queue.push({
		type: 'remove-connection',
		code: [
			`sim.remove_connection(${varName})`,
			`connections.remove(${varName})`
		].join('\n')
	});

	activeConnVars.delete(connId);
}

/**
 * Queue a block parameter change.
 */
export function queueUpdateParam(nodeId: string, paramName: string, value: string): void {
	const varName = activeNodeVars.get(nodeId);
	if (!varName) return;

	queue.push({
		type: 'update-param',
		code: `${varName}.${paramName} = ${value}`
	});
}

/**
 * Queue a simulation setting change.
 */
export function queueUpdateSetting(settingName: string, value: string): void {
	if (!isActive()) return;

	queue.push({
		type: 'update-setting',
		code: `sim.${settingName} = ${value}`
	});
}

/**
 * Get the Python variable name for a node.
 */
export function getNodeVar(nodeId: string): string | undefined {
	return activeNodeVars.get(nodeId);
}

/**
 * Get the Python variable name for a connection.
 */
export function getConnVar(connId: string): string | undefined {
	return activeConnVars.get(connId);
}
