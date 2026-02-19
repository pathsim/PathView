/**
 * Python Code Builder Utilities
 * Low-level utilities for building Python code strings
 */

import type { Connection } from '$lib/nodes/types';

/** Options for parameter string generation */
export interface ParamStringOptions {
	/** Use multi-line formatting with indentation */
	multiLine?: boolean;
	/** Indentation string for multi-line output */
	indent?: string;
	/** Skip params starting with underscore (internal params) */
	skipInternal?: boolean;
}

/**
 * Generate a parameter string for Python constructor calls.
 * All param values are treated as raw Python expressions - no parsing or transformation.
 *
 * @param params - Object of param name to value
 * @param validParamNames - Set of valid param names (others are skipped)
 * @param options - Formatting options
 * @returns Parameter string like "x=1, y=2" or multi-line formatted
 */
export function generateParamString(
	params: Record<string, unknown>,
	validParamNames: Set<string>,
	options: ParamStringOptions = {}
): string {
	const { multiLine = false, indent = '    ', skipInternal = false } = options;

	const parts: string[] = [];

	for (const [name, value] of Object.entries(params)) {
		// Skip null/undefined/empty
		if (value === null || value === undefined || value === '') continue;
		// Skip internal params if requested (starting with underscore)
		if (skipInternal && name.startsWith('_')) continue;
		// Skip params not defined in the type definition
		if (!validParamNames.has(name)) continue;

		// Pass through verbatim - value is a Python expression
		parts.push(`${name}=${value}`);
	}

	if (multiLine && parts.length > 0) {
		return '\n' + parts.map((p) => indent + p).join(',\n') + '\n';
	}
	return parts.join(', ');
}

/**
 * Group connections by source (nodeId + portIndex) for multi-target Connection syntax.
 * PathSim allows Connection(src[0], tgt1[0], tgt2[1]) for fan-out from same output.
 */
export function groupConnectionsBySource(
	connections: Connection[],
	nodeVars: Map<string, string>
): Map<string, { sourceVar: string; sourcePort: number; targets: { varName: string; port: number }[] }> {
	const groups = new Map<
		string,
		{ sourceVar: string; sourcePort: number; targets: { varName: string; port: number }[] }
	>();

	for (const conn of connections) {
		const sourceVar = nodeVars.get(conn.sourceNodeId);
		const targetVar = nodeVars.get(conn.targetNodeId);
		if (!sourceVar || !targetVar) continue;

		const key = `${conn.sourceNodeId}:${conn.sourcePortIndex}`;
		if (!groups.has(key)) {
			groups.set(key, {
				sourceVar,
				sourcePort: conn.sourcePortIndex,
				targets: []
			});
		}
		groups.get(key)!.targets.push({ varName: targetVar, port: conn.targetPortIndex });
	}

	return groups;
}

/**
 * Generate connection lines from grouped connections (anonymous, for inline use)
 *
 * @param connections - Array of connections
 * @param nodeVars - Map of nodeId to variable name
 * @param indent - Indentation string (default '    ')
 * @returns Array of connection lines like "    Connection(src[0], tgt[1]),"
 */
export function generateConnectionLines(
	connections: Connection[],
	nodeVars: Map<string, string>,
	indent: string = '    '
): string[] {
	const lines: string[] = [];
	const groups = groupConnectionsBySource(connections, nodeVars);

	for (const { sourceVar, sourcePort, targets } of groups.values()) {
		const targetParts = targets.map((t) => `${t.varName}[${t.port}]`);
		lines.push(`${indent}Connection(${sourceVar}[${sourcePort}], ${targetParts.join(', ')}),`);
	}

	return lines;
}

/**
 * Generate named connection variable definitions.
 * Each edge gets its own named variable for individual mutation support.
 *
 * @param connections - Array of connections
 * @param nodeVars - Map of nodeId to variable name
 * @param prefix - Variable name prefix (default 'conn')
 * @returns Object with definition lines, variable names list, and id-to-varname map
 */
export function generateNamedConnections(
	connections: Connection[],
	nodeVars: Map<string, string>,
	prefix: string = 'conn'
): { lines: string[]; varNames: string[]; connVars: Map<string, string> } {
	const lines: string[] = [];
	const varNames: string[] = [];
	const connVars = new Map<string, string>();

	let idx = 0;
	for (const conn of connections) {
		const sourceVar = nodeVars.get(conn.sourceNodeId);
		const targetVar = nodeVars.get(conn.targetNodeId);
		if (!sourceVar || !targetVar) continue;

		const varName = `${prefix}_${idx}`;
		lines.push(`${varName} = Connection(${sourceVar}[${conn.sourcePortIndex}], ${targetVar}[${conn.targetPortIndex}])`);
		varNames.push(varName);
		connVars.set(conn.id, varName);
		idx++;
	}

	return { lines, varNames, connVars };
}

/**
 * Generate a Python list definition
 *
 * @param listName - Variable name for the list (e.g., 'blocks')
 * @param items - Array of item variable names
 * @param indent - Indentation for items (default '    ')
 * @returns Array of lines defining the list
 */
export function generateListDefinition(
	listName: string,
	items: string[],
	indent: string = '    '
): string[] {
	const lines: string[] = [];
	lines.push(`${listName} = [`);
	for (const item of items) {
		lines.push(`${indent}${item},`);
	}
	lines.push(']');
	return lines;
}

/**
 * Sanitize a name for use as a Python variable.
 * - Removes invalid characters
 * - Replaces spaces with underscores
 * - Ensures doesn't start with number
 * - Lowercases
 */
export function sanitizeName(name: string): string {
	if (!name) return '';

	let sanitized = '';
	for (const char of name) {
		if (/[a-zA-Z0-9_]/.test(char)) {
			sanitized += char;
		} else if (char === ' ') {
			sanitized += '_';
		}
	}

	if (sanitized && /^[0-9]/.test(sanitized)) {
		sanitized = 'n_' + sanitized;
	}

	return sanitized.toLowerCase();
}
