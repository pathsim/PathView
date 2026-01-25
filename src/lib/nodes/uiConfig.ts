/**
 * UI-specific block configuration
 * Separate from auto-generated blocks.ts to allow UI behavior overrides
 */

/**
 * Blocks where a parameter controls port labels.
 * When the param value changes, port names are updated to match.
 */
export const portLabelParams: Record<string, { param: string; direction: 'input' | 'output' }> = {
	Scope: { param: 'labels', direction: 'input' },
	Spectrum: { param: 'labels', direction: 'input' }
};

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
