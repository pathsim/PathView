/**
 * Python/Pyodide related constants
 */

export const PYODIDE_VERSION = '0.26.2';
export const PYODIDE_CDN_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`;

/**
 * Code section headers used in generated Python code
 */
export const CODE_SECTIONS = {
	IMPORTS: '# IMPORTS',
	CODE_CONTEXT: '# CODE CONTEXT',
	USER_DEFINED_CODE: '# USER-DEFINED CODE',
	BLOCKS: '# BLOCKS',
	NODE_ID_MAPPING: '# NODE ID MAPPING (for data extraction)',
	NODE_NAME_MAPPING: '# NODE NAME MAPPING',
	CONNECTIONS: '# CONNECTIONS',
	EVENTS: '# EVENTS',
	SIMULATION: '# SIMULATION',
	RUN: '# RUN',
	MAIN: '# MAIN'
} as const;

/**
 * Category order for organizing blocks in formatted export
 */
export const BLOCK_CATEGORY_ORDER: string[] = [
	'Sources',
	'Dynamic',
	'Algebraic',
	'Mixed',
	'Recording',
	'Subsystem'
];

/**
 * Timeout constants for Pyodide operations (in milliseconds)
 */
export const TIMEOUTS = {
	SIMULATION: 300000, // 5 minutes
	INIT: 120000, // 2 minutes
	VALIDATION: 30000 // 30 seconds
} as const;
