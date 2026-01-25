/**
 * UI-specific block configuration
 * Separate from auto-generated blocks.ts to allow UI behavior overrides
 */

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
