/**
 * Pyodide Web Worker
 * Executes Python code via Pyodide in a separate thread
 */

// TODO: Need to replace every instance of readPythonAsync with the flask backend call based on the backend preference set

import { PYODIDE_CDN_URL } from '$lib/constants/python';
import { PROGRESS_MESSAGES, ERROR_MESSAGES } from '$lib/constants/messages';
import type { REPLRequest, REPLResponse } from '../types';

import type { PyodideInterface } from 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs';
import { backendPreferenceStore } from '$lib/stores';

let pyodide: PyodideInterface | null = null;
let isInitialized = false;
let streamingActive = false;
const streamingCodeQueue: string[] = [];

/**
 * Send a response to the main thread
 */
function send(response: REPLResponse): void {
	postMessage(response);
}

/**
 * Initialize Pyodide and install packages
 */
async function initialize(): Promise<void> {
	console.log(`We are intializing the Pyodide backend but the backend preference is: ${backendPreferenceStore.get()}`)
	
	if (isInitialized) {
		send({ type: 'ready' });
		return;
	}

	send({ type: 'progress', value: PROGRESS_MESSAGES.LOADING_PYODIDE });

	const { loadPyodide } = await import(
		/* @vite-ignore */
		PYODIDE_CDN_URL
	);

	pyodide = await loadPyodide();
	if (!pyodide) throw new Error(ERROR_MESSAGES.FAILED_TO_LOAD_PYODIDE);

	// Capture stdout/stderr
	pyodide.setStdout({
		batched: (msg: string) => send({ type: 'stdout', value: msg })
	});
	pyodide.setStderr({
		batched: (msg: string) => send({ type: 'stderr', value: msg })
	});

	send({ type: 'progress', value: PROGRESS_MESSAGES.INSTALLING_DEPS });
	await pyodide.loadPackage(['numpy', 'scipy', 'micropip']);

	send({ type: 'progress', value: PROGRESS_MESSAGES.INSTALLING_PATHSIM });
	await pyodide.runPythonAsync(`
import micropip
await micropip.install('pathsim')
	`);

	// Verify and print version
	await pyodide.runPythonAsync(`
import pathsim
print(f"PathSim {pathsim.__version__} loaded successfully")
	`);

	// Import numpy as np and gc globally
	await pyodide.runPythonAsync(`import numpy as np`);
	await pyodide.runPythonAsync(`import gc`);

	// Capture clean state for later cleanup
	await pyodide.runPythonAsync(`_clean_globals = set(globals().keys())`);

	isInitialized = true;
	send({ type: 'ready' });
}

/**
 * Execute Python code (no return value)
 */
async function execCode(id: string, code: string): Promise<void> {
	if (!pyodide) throw new Error(ERROR_MESSAGES.WORKER_NOT_INITIALIZED);

	try {
		await pyodide.runPythonAsync(code);
		send({ type: 'ok', id });
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		// Try to get traceback
		let traceback: string | undefined;
		try {
			traceback = (await pyodide.runPythonAsync(`
import traceback
traceback.format_exc()
			`)) as string;
		} catch {
			// Ignore traceback extraction errors
		}
		send({ type: 'error', id, error: errorMsg, traceback });
	}
}

/**
 * Evaluate Python expression and return JSON result
 * Note: _to_json helper is injected via REPL_SETUP_CODE
 */
async function evalExpr(id: string, expr: string): Promise<void> {
	if (!pyodide) throw new Error(ERROR_MESSAGES.WORKER_NOT_INITIALIZED);

	try {
		const result = await pyodide.runPythonAsync(`
_eval_result = ${expr}
json.dumps(_eval_result, default=_to_json if '_to_json' in dir() else str)
		`);

		send({ type: 'value', id, value: result as string });
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		let traceback: string | undefined;
		try {
			traceback = (await pyodide.runPythonAsync(`
import traceback
traceback.format_exc()
			`)) as string;
		} catch {
			// Ignore
		}
		send({ type: 'error', id, error: errorMsg, traceback });
	}
}

/**
 * Run streaming loop - steps generator continuously and posts results
 * Runs autonomously until done or stopped
 */
async function runStreamingLoop(id: string, expr: string): Promise<void> {
	if (!pyodide) throw new Error(ERROR_MESSAGES.WORKER_NOT_INITIALIZED);

	streamingActive = true;
	// Clear any stale code from previous runs
	streamingCodeQueue.length = 0;

	try {
		while (streamingActive) {
			// Execute any queued code first (for runtime parameter changes, events, etc.)
			// Errors in queued code are reported but don't stop the simulation
			while (streamingCodeQueue.length > 0) {
				const code = streamingCodeQueue.shift()!;
				try {
					await pyodide.runPythonAsync(code);
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					send({ type: 'stderr', value: `Stream exec error: ${errorMsg}` });
				}
			}

			// Step the generator
			const result = await pyodide.runPythonAsync(`
_eval_result = ${expr}
json.dumps(_eval_result, default=_to_json if '_to_json' in dir() else str)
			`);

			// Parse result
			const parsed = JSON.parse(result as string);

			// Check if stopped during Python execution - still send final data
			if (!streamingActive) {
				if (!parsed.done && parsed.result) {
					send({ type: 'stream-data', id, value: result as string });
				}
				break;
			}

			// Check if simulation completed
			if (parsed.done) {
				break;
			}

			// Send result and continue
			send({ type: 'stream-data', id, value: result as string });
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		let traceback: string | undefined;
		try {
			traceback = (await pyodide.runPythonAsync(`
import traceback
traceback.format_exc()
			`)) as string;
		} catch {
			// Ignore
		}
		send({ type: 'error', id, error: errorMsg, traceback });
	} finally {
		streamingActive = false;
		// Always send done when loop ends (whether completed, stopped, or error)
		send({ type: 'stream-done', id });
	}
}

/**
 * Stop streaming loop
 */
function stopStreaming(): void {
	streamingActive = false;
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<REPLRequest>) => {
	const { type } = event.data;
	// Extract fields based on request type
	const id = 'id' in event.data ? event.data.id : undefined;
	const code = 'code' in event.data ? event.data.code : undefined;
	const expr = 'expr' in event.data ? event.data.expr : undefined;

	try {
		switch (type) {
			case 'init':
				await initialize();
				break;

			case 'exec':
				if (!id || typeof code !== 'string') {
					throw new Error('Invalid exec request: missing id or code');
				}
				await execCode(id, code);
				break;

			case 'eval':
				if (!id || typeof expr !== 'string') {
					throw new Error('Invalid eval request: missing id or expr');
				}
				await evalExpr(id, expr);
				break;

			case 'stream-start':
				if (!id || typeof expr !== 'string') {
					throw new Error('Invalid stream-start request: missing id or expr');
				}
				// Don't await - let it run autonomously
				runStreamingLoop(id, expr);
				break;

			case 'stream-stop':
				stopStreaming();
				break;

			case 'stream-exec':
				if (typeof code === 'string' && streamingActive) {
					// Queue code to be executed between generator steps
					streamingCodeQueue.push(code);
				}
				break;

			default:
				throw new Error(`Unknown message type: ${type}`);
		}
	} catch (error) {
		send({
			type: 'error',
			id,
			error: error instanceof Error ? error.message : String(error)
		});
	}
};
