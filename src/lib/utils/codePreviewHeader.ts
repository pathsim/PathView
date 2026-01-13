/**
 * Utilities for generating self-contained code preview headers
 * Used by block/event property dialogs to show copyable code snippets
 */

import { nodeRegistry, type NodeInstance } from '$lib/nodes';
import { eventRegistry, type EventInstance } from '$lib/events';
import { NODE_TYPES } from '$lib/constants/nodeTypes';

/**
 * Extract Python identifiers from a string (parameter values)
 */
function extractIdentifiers(code: string): Set<string> {
	const identifierPattern = /(?<![.\w])([a-zA-Z_][a-zA-Z0-9_]*)/g;
	const identifiers = new Set<string>();
	let match;
	while ((match = identifierPattern.exec(code)) !== null) {
		identifiers.add(match[1]);
	}
	return identifiers;
}

// Python keywords and builtins to ignore when extracting references
const PYTHON_BUILTINS = new Set([
	'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'if', 'else', 'elif',
	'for', 'while', 'def', 'class', 'return', 'yield', 'import', 'from', 'as',
	'try', 'except', 'finally', 'with', 'lambda', 'pass', 'break', 'continue',
	'raise', 'global', 'nonlocal', 'assert', 'del', 'print', 'len', 'range',
	'list', 'dict', 'set', 'tuple', 'str', 'int', 'float', 'bool', 'type',
	'np', 'numpy', 'math', 'sin', 'cos', 'tan', 'exp', 'log', 'sqrt', 'pi',
	'abs', 'min', 'max', 'sum', 'any', 'all', 'map', 'filter', 'zip', 'enumerate'
]);

/**
 * Extract relevant code context - only definitions referenced by the given identifiers
 */
function extractRelevantCodeContext(codeContext: string, referencedIds: Set<string>): string {
	if (!codeContext.trim() || referencedIds.size === 0) return '';

	const lines = codeContext.split('\n');
	const relevantLines: string[] = [];
	let inRelevantBlock = false;
	let blockIndent = 0;

	// Filter to only meaningful references
	const meaningfulRefs = new Set([...referencedIds].filter(id => !PYTHON_BUILTINS.has(id)));
	if (meaningfulRefs.size === 0) return '';

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Check for function definition
		const funcMatch = trimmed.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
		if (funcMatch && meaningfulRefs.has(funcMatch[1])) {
			inRelevantBlock = true;
			blockIndent = line.search(/\S/);
			relevantLines.push(line);
			continue;
		}

		// Check for variable assignment at top level
		const varMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
		if (varMatch && meaningfulRefs.has(varMatch[1]) && !inRelevantBlock) {
			relevantLines.push(line);
			continue;
		}

		// Continue collecting lines if inside a relevant function block
		if (inRelevantBlock) {
			const currentIndent = line.search(/\S/);
			if (trimmed === '' || currentIndent > blockIndent) {
				relevantLines.push(line);
			} else {
				inRelevantBlock = false;
			}
		}
	}

	return relevantLines.join('\n').trim();
}

/**
 * Collect all parameter values from a node and its nested subsystems (recursively)
 */
function collectAllParamValues(node: NodeInstance): string[] {
	const values: string[] = [];

	for (const value of Object.values(node.params)) {
		if (value != null && value !== '') {
			values.push(String(value));
		}
	}

	if (node.graph) {
		for (const child of node.graph.nodes) {
			values.push(...collectAllParamValues(child));
		}
	}

	return values;
}

/**
 * Collect all block classes used within a subsystem (recursively)
 */
function collectSubsystemBlockClasses(node: NodeInstance, classes: Set<string>): void {
	if (!node.graph) return;

	for (const child of node.graph.nodes) {
		const childTypeDef = nodeRegistry.get(child.type);
		if (childTypeDef && childTypeDef.blockClass !== 'Subsystem' && childTypeDef.blockClass !== 'Interface') {
			classes.add(childTypeDef.blockClass);
		}
		if (child.type === NODE_TYPES.SUBSYSTEM) {
			collectSubsystemBlockClasses(child, classes);
		}
	}
}

/**
 * Generate imports and referenced code context header for a block
 */
export function generateBlockCodeHeader(node: NodeInstance, codeContext: string): string {
	const typeDef = nodeRegistry.get(node.type);
	if (!typeDef) return '';

	const lines: string[] = [];

	// Imports
	lines.push('import numpy as np');
	if (node.type === NODE_TYPES.SUBSYSTEM) {
		lines.push('from pathsim import Subsystem, Interface, Connection');
		const blockClasses = new Set<string>();
		collectSubsystemBlockClasses(node, blockClasses);
		if (blockClasses.size > 0) {
			lines.push(`from pathsim.blocks import ${[...blockClasses].sort().join(', ')}`);
		}
	} else {
		lines.push(`from pathsim.blocks import ${typeDef.blockClass}`);
	}

	// Extract referenced code context
	const paramValues = node.type === NODE_TYPES.SUBSYSTEM
		? collectAllParamValues(node).join(' ')
		: Object.values(node.params).filter(v => v != null && v !== '').join(' ');
	const referencedIds = extractIdentifiers(paramValues);
	const relevantContext = extractRelevantCodeContext(codeContext, referencedIds);

	if (relevantContext) {
		lines.push('');
		lines.push(relevantContext);
	}

	lines.push('');
	return lines.join('\n');
}

/**
 * Generate imports and referenced code context header for an event
 */
export function generateEventCodeHeader(event: EventInstance, codeContext: string): string {
	const typeDef = eventRegistry.get(event.type);
	if (!typeDef) return '';

	const lines: string[] = [];

	// Imports
	lines.push('import numpy as np');
	lines.push(`from pathsim.events import ${typeDef.eventClass}`);

	// Extract referenced code context
	const paramValues = Object.values(event.params).filter(v => v != null && v !== '').join(' ');
	const referencedIds = extractIdentifiers(paramValues);
	const relevantContext = extractRelevantCodeContext(codeContext, referencedIds);

	if (relevantContext) {
		lines.push('');
		lines.push(relevantContext);
	}

	lines.push('');
	return lines.join('\n');
}
