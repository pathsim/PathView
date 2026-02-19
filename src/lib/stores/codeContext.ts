/**
 * Code context store
 * Manages user-defined Python code for variables and functions
 */

import { writable, derived, get } from 'svelte/store';
import { queueUpdateSetting, isActive as isMutationQueueActive } from '$lib/pyodide/mutationQueue';

const code = writable<string>('');
const lastError = writable<string | null>(null);

// Extract defined names from code (simple regex-based)
const definedNames = derived(code, ($code) => {
	const names: string[] = [];

	// Match function definitions: def function_name(
	const funcMatches = $code.matchAll(/def\s+(\w+)\s*\(/g);
	for (const match of funcMatches) {
		names.push(match[1]);
	}

	// Match variable assignments: variable_name =
	const varMatches = $code.matchAll(/^(\w+)\s*=/gm);
	for (const match of varMatches) {
		names.push(match[1]);
	}

	// Return unique names
	return [...new Set(names)];
});

export const codeContextStore = {
	// Direct store subscriptions
	code: { subscribe: code.subscribe },
	lastError: { subscribe: lastError.subscribe },
	definedNames: { subscribe: definedNames.subscribe },

	/**
	 * Set the code content
	 */
	setCode(newCode: string): void {
		code.set(newCode);
		lastError.set(null);

		// Queue code context re-execution as a mutation
		if (isMutationQueueActive() && newCode.trim()) {
			queueUpdateSetting('code_context', newCode.trim());
		}
	},

	/**
	 * Get the current code
	 */
	getCode(): string {
		return get(code);
	},

	/**
	 * Set an error message
	 */
	setError(error: string): void {
		lastError.set(error);
	},

	/**
	 * Clear error
	 */
	clearError(): void {
		lastError.set(null);
	},

	/**
	 * Check if a name is defined in the code
	 */
	hasName(name: string): boolean {
		const names = get(definedNames);
		return names.includes(name);
	},

	/**
	 * Get all defined names
	 */
	getDefinedNames(): string[] {
		return get(definedNames);
	},

	/**
	 * Clear the code context
	 */
	clear(): void {
		code.set('');
		lastError.set(null);
	}
};
