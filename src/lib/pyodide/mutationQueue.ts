/**
 * Mutation Queue
 * Tracks graph changes (add/remove blocks, connections, events, parameter/settings changes)
 * as Python code strings to be applied to the worker namespace on "Continue".
 *
 * On "Run": queue is cleared, mappings initialized from code generation result.
 * On "Continue": queue is flushed → executed in worker → then new streaming generator starts.
 *
 * Design:
 * - Structural mutations (add/remove block/connection) are queued in order.
 * - Parameter and setting updates are coalesced: only the latest value per key is kept.
 * - Each mutation is wrapped in try/except so one failure doesn't block the rest.
 * - The queue count is exposed as a Svelte store for UI reactivity.
 */

import { writable, get } from 'svelte/store';
import type { NodeInstance, Connection } from '$lib/nodes/types';
import { nodeRegistry } from '$lib/nodes/registry';
import { isSubsystem } from '$lib/nodes/shapes';
import { sanitizeName } from './codeBuilder';

// --- Internal state ---

/** Active variable name mappings from the last run */
let activeNodeVars = new Map<string, string>();   // nodeId → Python var name
let activeConnVars = new Map<string, string>();    // connectionId → Python var name

/** Counter for dynamically added variables */
let dynamicVarCounter = 0;

/** Ordered structural mutations (add/remove block/connection) */
const structuralQueue: string[] = [];

/** Coalesced parameter updates: "nodeId:paramName" → Python assignment */
const paramUpdates = new Map<string, string>();

/** Coalesced setting updates: pathsimAttr → Python assignment */
const settingUpdates = new Map<string, string>();

/** Reactive store: number of pending mutations */
export const pendingMutationCount = writable(0);

function updateCount(): void {
	pendingMutationCount.set(
		structuralQueue.length + paramUpdates.size + settingUpdates.size
	);
}

// --- Public API ---

/**
 * Check if the mutation queue is active (a simulation has been run).
 */
export function isActive(): boolean {
	return activeNodeVars.size > 0;
}

/**
 * Initialize mappings from a fresh run's code generation result.
 * Called when "Run" starts. Clears all pending mutations.
 */
export function initMappings(nodeVars: Map<string, string>, connVars: Map<string, string>): void {
	activeNodeVars = new Map(nodeVars);
	activeConnVars = new Map(connVars);
	dynamicVarCounter = 0;
	structuralQueue.length = 0;
	paramUpdates.clear();
	settingUpdates.clear();
	updateCount();
}

/**
 * Clear the mutation queue (on fresh Run).
 */
export function clearQueue(): void {
	structuralQueue.length = 0;
	paramUpdates.clear();
	settingUpdates.clear();
	updateCount();
}

/**
 * Get all pending mutations as a Python code string and clear the queue.
 * Each mutation is wrapped in try/except for error isolation.
 * Order: settings first, then structural mutations, then parameter updates.
 */
export function flushQueue(): string | null {
	const allCode: string[] = [];

	// 1. Settings (apply before structural changes)
	for (const code of settingUpdates.values()) {
		allCode.push(wrapTryExcept(code));
	}

	// 2. Structural mutations (add/remove in order)
	for (const code of structuralQueue) {
		allCode.push(wrapTryExcept(code));
	}

	// 3. Parameter updates (apply after blocks exist)
	for (const code of paramUpdates.values()) {
		allCode.push(wrapTryExcept(code));
	}

	structuralQueue.length = 0;
	paramUpdates.clear();
	settingUpdates.clear();
	updateCount();

	if (allCode.length === 0) return null;
	return allCode.join('\n');
}

/**
 * Check if there are pending mutations.
 */
export function hasPendingMutations(): boolean {
	return structuralQueue.length > 0 || paramUpdates.size > 0 || settingUpdates.size > 0;
}

// --- Mutation generators ---

/**
 * Queue adding a new block to the simulation.
 * Skips subsystem nodes (they require recursive internal graph creation).
 */
export function queueAddBlock(node: NodeInstance): void {
	if (!isActive()) return;
	if (isSubsystem(node)) return;

	const typeDef = nodeRegistry.get(node.type);
	if (!typeDef) return;

	const existingNames = new Set(activeNodeVars.values());
	let varName = sanitizeName(node.name);
	if (!varName || existingNames.has(varName)) {
		varName = `block_dyn_${dynamicVarCounter++}`;
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

	structuralQueue.push([
		`${varName} = ${constructor}`,
		`sim.add_block(${varName})`,
		`blocks.append(${varName})`,
		`_node_id_map[id(${varName})] = "${node.id}"`,
		`_node_name_map["${node.id}"] = "${node.name.replace(/"/g, '\\"')}"`
	].join('\n'));
	updateCount();
}

/**
 * Queue removing a block from the simulation.
 */
export function queueRemoveBlock(nodeId: string): void {
	const varName = activeNodeVars.get(nodeId);
	if (!varName) return;

	structuralQueue.push([
		`sim.remove_block(${varName})`,
		`blocks.remove(${varName})`,
		`_node_id_map.pop(id(${varName}), None)`,
		`_node_name_map.pop("${nodeId}", None)`
	].join('\n'));
	activeNodeVars.delete(nodeId);

	// Remove any coalesced param updates for this block
	for (const key of paramUpdates.keys()) {
		if (key.startsWith(nodeId + ':')) {
			paramUpdates.delete(key);
		}
	}
	updateCount();
}

/**
 * Queue adding a new connection to the simulation.
 */
export function queueAddConnection(conn: Connection): void {
	if (!isActive()) return;

	const sourceVar = activeNodeVars.get(conn.sourceNodeId);
	const targetVar = activeNodeVars.get(conn.targetNodeId);
	if (!sourceVar || !targetVar) return;

	const varName = `conn_dyn_${dynamicVarCounter++}`;
	activeConnVars.set(conn.id, varName);

	structuralQueue.push([
		`${varName} = Connection(${sourceVar}[${conn.sourcePortIndex}], ${targetVar}[${conn.targetPortIndex}])`,
		`sim.add_connection(${varName})`,
		`connections.append(${varName})`
	].join('\n'));
	updateCount();
}

/**
 * Queue removing a connection from the simulation.
 */
export function queueRemoveConnection(connId: string): void {
	const varName = activeConnVars.get(connId);
	if (!varName) return;

	structuralQueue.push([
		`sim.remove_connection(${varName})`,
		`connections.remove(${varName})`
	].join('\n'));
	activeConnVars.delete(connId);
	updateCount();
}

/**
 * Queue a block parameter change.
 * Coalesced: only the latest value per (nodeId, paramName) is kept.
 */
export function queueUpdateParam(nodeId: string, paramName: string, value: string): void {
	const varName = activeNodeVars.get(nodeId);
	if (!varName) return;

	paramUpdates.set(`${nodeId}:${paramName}`, `${varName}.${paramName} = ${value}`);
	updateCount();
}

/**
 * Queue a simulation setting change.
 * Coalesced: only the latest code per setting key is kept.
 * @param key - Coalescing key (e.g. 'dt', 'solver')
 * @param code - Full Python code to execute (e.g. 'sim.dt = 0.01')
 */
export function queueUpdateSetting(key: string, code: string): void {
	if (!isActive()) return;

	settingUpdates.set(key, code);
	updateCount();
}

// --- Lookup ---

export function getNodeVar(nodeId: string): string | undefined {
	return activeNodeVars.get(nodeId);
}

export function getConnVar(connId: string): string | undefined {
	return activeConnVars.get(connId);
}

// --- Internal helpers ---

function wrapTryExcept(code: string): string {
	const indented = code.split('\n').map(line => `    ${line}`).join('\n');
	return `try:\n${indented}\nexcept Exception as _e:\n    print(f"Mutation error: {_e}", file=__import__('sys').stderr)`;
}
