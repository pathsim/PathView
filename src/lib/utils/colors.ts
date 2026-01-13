/**
 * Color definitions for PathView
 */

// Default node/event color (matches --pathsim-blue CSS variable)
export const DEFAULT_NODE_COLOR = '#0070C0';

// Port colors
export const PORT_COLORS = {
	default: '#969696', // Gray: rgb(150, 150, 150)
	signal: '#64c8ff', // Blue: rgb(100, 200, 255)
	control: '#ffc864', // Orange: rgb(255, 200, 100)
	data: '#c864ff' // Purple: rgb(200, 100, 255)
};

// Color palette for dialogs (block/event properties)
export const DIALOG_COLOR_PALETTE = [
	DEFAULT_NODE_COLOR, // PathSim blue (default)
	'#E57373', // Red
	'#FFB74D', // Orange
	'#FFF176', // Yellow
	'#81C784', // Green
	'#4DB6AC', // Teal
	'#4DD0E1', // Cyan
	'#64B5F6', // Blue
	'#BA68C8', // Purple
	'#F06292', // Pink
	'#90A4AE', // Grey
	'#FFFFFF' // White
];
