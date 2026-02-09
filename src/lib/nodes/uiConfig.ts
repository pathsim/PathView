/**
 * UI-specific block configuration
 * Separate from auto-generated blocks.ts to allow UI behavior overrides
 */

/**
 * Port label configuration for a single direction
 */
export interface PortLabelConfig {
	param: string;
	direction: 'input' | 'output';
	/** Optional custom parser to convert param value to label strings.
	 *  Default uses parsePythonList (for ["a", "b"] format). */
	parser?: (value: unknown) => string[] | null;
}

/**
 * Parse an operations string into individual character labels.
 * Handles Python-style quoted strings: '+-' or "+-" → ['+', '-']
 * Also handles unquoted: +- → ['+', '-']
 */
function parseOperationsString(value: unknown): string[] | null {
	if (value === null || value === undefined || value === 'None' || value === '') {
		return null;
	}
	let str = String(value).trim();
	if (str.length === 0) return null;
	// Strip surrounding Python quotes (single or double)
	if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
		str = str.slice(1, -1);
	}
	if (str.length === 0) return null;
	return [...str];
}

/**
 * Blocks where parameters control port labels.
 * When the param value changes, port names are updated to match.
 * Supports multiple configs per block (e.g., separate input and output labels).
 */
export const portLabelParams: Record<string, PortLabelConfig | PortLabelConfig[]> = {
	Scope: { param: 'labels', direction: 'input' },
	Spectrum: { param: 'labels', direction: 'input' },
	Adder: { param: 'operations', direction: 'input', parser: parseOperationsString }
};

/**
 * Get all port label configs for a block type (normalized to array)
 */
export function getPortLabelConfigs(blockType: string): PortLabelConfig[] {
	const config = portLabelParams[blockType];
	if (!config) return [];
	return Array.isArray(config) ? config : [config];
}

/**
 * Blocks where output port count must equal input port count.
 * These blocks process inputs as parallel paths - each input has a corresponding output.
 * UI shows only input port controls; outputs auto-sync.
 */
export const syncPortBlocks = new Set([
	// Dynamic blocks (parallel integration/differentiation/delay)
	'Integrator',
	'Differentiator',
	'Delay',
	'PID',
	'PID_Antiwindup',

	// Algebraic blocks (element-wise operations)
	'Amplifier',
	'Sin',
	'Cos',
	'Tan',
	'Tanh',
	'Abs',
	'Sqrt',
	'Exp',
	'Log',
	'Log10',
	'Mod',
	'Clip',
	'Pow',

	// Mixed blocks (parallel sampling)
	'SampleHold'
]);
