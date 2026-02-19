/**
 * Pyodide Bridge
 * Main-thread interface for running PathSim simulations
 *
 * This module provides the high-level API for simulation operations,
 * implemented using the low-level REPL primitives (exec/eval).
 */

import { writable, get } from 'svelte/store';
import { consoleStore } from '$lib/stores/console';
import { settingsStore } from '$lib/stores/settings';
import { TIMEOUTS } from '$lib/constants/python';
import { PROGRESS_MESSAGES, STATUS_MESSAGES, SUCCESS_MESSAGES } from '$lib/constants/messages';

// Import backend primitives
import {
	init as initRepl,
	exec,
	evaluate,
	terminate as terminateRepl,
	replState,
	startStreaming,
	stopStreaming as stopReplStreaming,
	execDuringStreaming
} from './backend';

// Re-export for use in other modules
export { execDuringStreaming };

// Import mutation queue
import { initMappings, flushQueue, clearQueue } from './mutationQueue';

// Re-export replState as pyodideState for backwards compatibility
export { replState as pyodideState };

// Import Python helpers
import {
	REPL_SETUP_CODE,
	generateRunCode,
	EXTRACT_RESULTS_EXPR,
	generateValidationSetupCode,
	generateParamValidationCode,
	VALIDATION_RESULT_EXPR,
	CLEAR_STATE_CODE,
	CLEANUP_TEMP_CODE,
	toBase64,
	generateStreamingStartCode,
	STREAMING_STEP_EXPR,
	STREAMING_STOP_CODE
} from './pythonHelpers';

// Result types
export interface SimulationResult {
	scopeData: Record<
		string,
		{
			time: number[];
			signals: number[][];
			labels?: string[];
		}
	>;
	spectrumData: Record<
		string,
		{
			frequency: number[];
			magnitude: number[][];
			labels?: string[];
		}
	>;
	nodeNames: Record<string, string>;
}

export interface ValidationError {
	nodeId: string;
	param: string;
	error: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

// Simulation phases for UI state management
export type SimulationPhase = 'idle' | 'starting' | 'running' | 'complete' | 'error';

// Store for simulation state
const initialSimulationState = {
	phase: 'idle' as SimulationPhase,
	progress: '',
	error: null as string | null,
	result: null as SimulationResult | null,
	resultHistory: [] as SimulationResult[]
};

export const simulationState = {
	...writable<typeof initialSimulationState>({ ...initialSimulationState }),
	reset() {
		this.set({ ...initialSimulationState, resultHistory: [] });
	}
};

/**
 * Create empty result structure preserving node IDs but clearing data.
 * This keeps plots mounted while showing loading state.
 */
function createEmptyResultStructure(result: SimulationResult | null): SimulationResult {
	if (!result) {
		return { scopeData: {}, spectrumData: {}, nodeNames: {} };
	}
	return {
		scopeData: Object.fromEntries(
			Object.entries(result.scopeData).map(([id, data]) => [
				id,
				{ time: [], signals: data.signals.map(() => []), labels: data.labels }
			])
		),
		spectrumData: Object.fromEntries(
			Object.entries(result.spectrumData).map(([id, data]) => [
				id,
				{ frequency: [], magnitude: data.magnitude.map(() => []), labels: data.labels }
			])
		),
		nodeNames: { ...result.nodeNames }
	};
}

// Track if helper functions have been injected
let helpersInjected = false;

// Track if streaming simulation is active
let streamingActive = false;

/**
 * Compute updated result history for ghost traces
 * Uses user's ghostTraces setting (constrained to 0-6 by UI)
 */
function computeResultHistory(
	currentResult: SimulationResult | null,
	currentHistory: SimulationResult[],
	maxHistory: number
): SimulationResult[] {
	if (maxHistory === 0) return [];
	if (!currentResult) return currentHistory;
	return [currentResult, ...currentHistory].slice(0, maxHistory);
}

/**
 * Merge incremental streaming result with accumulated result
 * Scope data is appended, spectrum data is replaced
 */
function mergeStreamingResult(
	accumulated: SimulationResult | null,
	incremental: SimulationResult
): SimulationResult {
	if (!accumulated) {
		return incremental;
	}

	// Merge scope data by appending time and signals
	const mergedScopeData: SimulationResult['scopeData'] = { ...accumulated.scopeData };
	for (const [id, data] of Object.entries(incremental.scopeData)) {
		if (mergedScopeData[id]) {
			// Append to existing scope data
			mergedScopeData[id] = {
				time: [...mergedScopeData[id].time, ...data.time],
				signals: mergedScopeData[id].signals.map((sig, i) => [...sig, ...(data.signals[i] || [])]),
				labels: data.labels || mergedScopeData[id].labels
			};
		} else {
			// New scope
			mergedScopeData[id] = data;
		}
	}

	return {
		scopeData: mergedScopeData,
		// Spectrum data is not incremental, just use latest
		spectrumData: incremental.spectrumData,
		// Merge node names
		nodeNames: { ...accumulated.nodeNames, ...incremental.nodeNames }
	};
}

/**
 * Inject helper functions into Python namespace
 */
async function injectHelpers(): Promise<void> {
	if (helpersInjected) return;
	await exec(REPL_SETUP_CODE);
	helpersInjected = true;
}

/**
 * Initialize Pyodide
 */
export async function initPyodide(): Promise<void> {
	await initRepl();
	await injectHelpers();
}

/**
 * Streaming step result from Python
 */
interface StreamingStepResult {
	done: boolean;
	result: SimulationResult | null;
}

// Streaming configuration
const STREAMING_TICKRATE = 10; // Hz - how often Python yields data
const UI_UPDATE_RATE = 10; // Hz - max UI update frequency (decoupled from simulation)

/**
 * Runs the rAF-based streaming loop that consumes results from the worker.
 * Decouples simulation rate from UI update rate.
 *
 * @param initialResult - Starting accumulated result (null for new run, existing for continue)
 * @param onUpdate - Optional callback for each UI update
 * @returns Final accumulated result
 */
async function runStreamingLoop(
	initialResult: SimulationResult | null,
	onUpdate?: (result: SimulationResult) => void
): Promise<SimulationResult | null> {
	let accumulatedResult = initialResult;
	const resultQueue: SimulationResult[] = [];
	let rafId: number | null = null;
	let lastUIUpdate = 0;
	let finalResult: SimulationResult | null = initialResult;

	// rAF loop consumes queue and updates UI at display rate
	function updateUI(timestamp: number) {
		// Drain queue and merge all pending results
		if (resultQueue.length > 0 && timestamp - lastUIUpdate >= 1000 / UI_UPDATE_RATE) {
			while (resultQueue.length > 0) {
				const result = resultQueue.shift()!;
				accumulatedResult = mergeStreamingResult(accumulatedResult, result);
			}
			finalResult = accumulatedResult;
			lastUIUpdate = timestamp;

			if (streamingActive) {
				simulationState.update((s) => ({
					...s,
					result: accumulatedResult
				}));
				if (onUpdate && accumulatedResult) {
					onUpdate(accumulatedResult);
				}
			}
		}

		// Continue if still streaming
		if (streamingActive) {
			rafId = requestAnimationFrame(updateUI);
		}
	}

	// Start rAF loop
	rafId = requestAnimationFrame(updateUI);

	// Start autonomous streaming - worker runs loop and pushes results
	await new Promise<void>((resolve, reject) => {
		startStreaming<StreamingStepResult>(
			STREAMING_STEP_EXPR,
			// onData - push to queue
			(stepResult) => {
				if (stepResult.result) {
					resultQueue.push(stepResult.result);
				}
			},
			// onDone
			() => resolve(),
			// onError
			(error) => reject(error)
		);
	});

	// Process any remaining queued results
	while (resultQueue.length > 0) {
		const result = resultQueue.shift()!;
		accumulatedResult = mergeStreamingResult(accumulatedResult, result);
	}
	finalResult = accumulatedResult;

	// Stop rAF loop
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
	}

	return finalResult;
}

/**
 * Run a streaming simulation with live updates
 * @param code - Setup code that creates blocks, connections, and sim
 * @param duration - Simulation duration expression
 * @param onUpdate - Callback for each streaming update
 */
export async function runStreamingSimulation(
	code: string,
	duration: string,
	onUpdate?: (result: SimulationResult) => void,
	nodeVars?: Map<string, string>,
	connVars?: Map<string, string>
): Promise<SimulationResult | null> {
	// Ensure initialized
	const state = get(replState);
	if (!state.initialized) {
		await initRepl();
	}

	// Initialize mutation queue mappings for this run
	if (nodeVars && connVars) {
		initMappings(nodeVars, connVars);
	} else {
		clearQueue();
	}

	streamingActive = true;

	// Update simulation state - preserve result structure for smooth transition
	const ghostTraces = settingsStore.get().ghostTraces;
	simulationState.update((s) => ({
		...s,
		phase: 'starting',
		progress: PROGRESS_MESSAGES.STARTING_SIMULATION,
		error: null,
		// With ghost traces: clear data so ghosts are visible without duplicate
		// Without ghost traces: keep old result visible until new data arrives
		result: ghostTraces > 0 ? createEmptyResultStructure(s.result) : s.result,
		resultHistory: computeResultHistory(s.result, s.resultHistory, ghostTraces)
	}));

	try {
		// Clear previous simulation state, then inject helpers fresh
		await exec(CLEAR_STATE_CODE);
		helpersInjected = false;
		await injectHelpers();

		// Execute setup code (creates blocks, connections, sim)
		const wrappedCode = generateRunCode(code);
		await exec(wrappedCode);

		// Start streaming generator with optimized tickrate
		await exec(generateStreamingStartCode(duration, STREAMING_TICKRATE));

		// Update phase to running
		simulationState.update((s) => ({ ...s, phase: 'running' }));
		consoleStore.info('Streaming simulation started');

		// Run streaming loop (starts from null for new simulation)
		const finalResult = await runStreamingLoop(null, onUpdate);

		// Clean up streaming state
		await exec(STREAMING_STOP_CODE);
		await exec(CLEANUP_TEMP_CODE);

		// Update state with final phase
		// If stopped externally AND state was reset (result is null), don't overwrite
		simulationState.update((s) => {
			if (!streamingActive && s.result === null) {
				return s;
			}
			return {
				...s,
				phase: streamingActive ? 'complete' : 'idle',
				progress: streamingActive ? STATUS_MESSAGES.COMPLETE : STATUS_MESSAGES.STOPPED,
				result: finalResult
			};
		});

		if (streamingActive) {
			consoleStore.info(SUCCESS_MESSAGES.SIMULATION_COMPLETED);
		}

		return finalResult;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		consoleStore.error(`Streaming simulation failed: ${errorMsg}`);

		// Clean up on error
		try {
			await exec(STREAMING_STOP_CODE);
		} catch {
			// Ignore cleanup errors
		}

		simulationState.update((s) => ({
			...s,
			phase: 'error',
			error: errorMsg
		}));

		throw error;
	} finally {
		streamingActive = false;
	}
}

/**
 * Continue a streaming simulation from where it left off
 * @param durationExpr - Duration expression
 * @param onUpdate - Callback for each streaming update
 */
export async function continueStreamingSimulation(
	durationExpr: string,
	onUpdate?: (result: SimulationResult) => void
): Promise<SimulationResult | null> {
	const state = get(replState);
	if (!state.initialized) {
		throw new Error('No simulation to continue. Run a simulation first.');
	}

	await injectHelpers();

	streamingActive = true;

	simulationState.update((s) => ({
		...s,
		phase: 'starting',
		progress: 'Continuing simulation...',
		error: null,
		// Keep existing result visible while continuing
		resultHistory: computeResultHistory(s.result, s.resultHistory, settingsStore.get().ghostTraces)
	}));

	try {
		// Check if simulation exists
		await exec(`
if 'sim' not in dir() or sim is None:
    raise RuntimeError("No simulation to continue. Run a simulation first.")
		`);

		// Apply any pending graph mutations before continuing
		const mutationCode = flushQueue();
		if (mutationCode) {
			await exec(mutationCode);
			consoleStore.info('Applied graph mutations');
		}

		// Start streaming generator with reset=False and optimized tickrate
		await exec(generateStreamingStartCode(durationExpr, STREAMING_TICKRATE, false));

		// Update phase to running
		simulationState.update((s) => ({ ...s, phase: 'running' }));
		consoleStore.info('Continuing simulation (streaming)...');

		// Run streaming loop (starts from existing result for continuation)
		const existingResult = get(simulationState).result;
		const finalResult = await runStreamingLoop(existingResult, onUpdate);

		// Clean up
		await exec(STREAMING_STOP_CODE);

		// Update state with final result
		// If stopped externally AND state was reset (result is null), don't overwrite
		simulationState.update((s) => {
			if (!streamingActive && s.result === null) {
				return s;
			}
			return {
				...s,
				phase: streamingActive ? 'complete' : 'idle',
				progress: streamingActive ? STATUS_MESSAGES.COMPLETE : STATUS_MESSAGES.STOPPED,
				result: finalResult
			};
		});

		if (streamingActive) {
			consoleStore.info('Simulation continued successfully');
		}

		return finalResult;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		consoleStore.error(`Continue simulation failed: ${errorMsg}`);

		try {
			await exec(STREAMING_STOP_CODE);
		} catch {
			// Ignore cleanup errors
		}

		simulationState.update((s) => ({
			...s,
			phase: 'error',
			error: errorMsg
		}));

		throw error;
	} finally {
		streamingActive = false;
	}
}

/**
 * Stage pending graph mutations into the simulation.
 * If streaming: injects via execDuringStreaming (applied between generator steps).
 * If paused: executes directly via exec.
 * Returns true if mutations were applied, false if nothing to stage.
 */
export async function stageMutations(): Promise<boolean> {
	const code = flushQueue();
	if (!code) return false;

	if (streamingActive) {
		execDuringStreaming(code);
		consoleStore.info('Staged changes (applied during streaming)');
	} else {
		await exec(code);
		consoleStore.info('Staged changes applied');
	}
	return true;
}

/**
 * Reset simulation state completely.
 * Use when loading a new model or creating a new graph.
 * Stops any running simulation, clears results, and clears Python state.
 */
export async function resetSimulation(): Promise<void> {
	// Stop streaming immediately (synchronous part)
	stopReplStreaming();
	streamingActive = false;

	// Reset state store (clears results)
	simulationState.reset();

	// Clear Python state (async, may fail if not initialized)
	const state = get(replState);
	if (state.initialized) {
		try {
			// Stop generator and clear namespace
			await exec(STREAMING_STOP_CODE, TIMEOUTS.VALIDATION);
			await exec(CLEAR_STATE_CODE);
		} catch {
			// Ignore errors during cleanup
		}
	}

	// Reset helpers flag so they get re-injected on next simulation
	helpersInjected = false;
}

/**
 * Validate code context and parameter expressions
 */
export async function validateGraph(
	codeContext: string,
	nodeParams: Record<string, Record<string, string>>
): Promise<ValidationResult> {
	const state = get(replState);
	if (!state.initialized) {
		await initPyodide();
	}

	try {
		// Setup validation namespace and validate code context
		const codeContextBase64 = toBase64(codeContext);
		await exec(generateValidationSetupCode(codeContextBase64), TIMEOUTS.VALIDATION);

		// Validate parameter expressions
		const nodeParamsBase64 = toBase64(JSON.stringify(nodeParams));
		await exec(generateParamValidationCode(nodeParamsBase64), TIMEOUTS.VALIDATION);

		// Get validation result
		const result = await evaluate<ValidationResult>(VALIDATION_RESULT_EXPR, TIMEOUTS.VALIDATION);

		// Clean up
		await exec(CLEANUP_TEMP_CODE);

		return result;
	} catch (error) {
		// If validation itself fails, return as error
		return {
			valid: false,
			errors: [
				{
					nodeId: '__validation__',
					param: '',
					error: error instanceof Error ? error.message : String(error)
				}
			]
		};
	}
}

/**
 * Stop the current simulation gracefully
 * Sends sim.stop() to Python which will stop at the next timestep
 * Also aborts streaming loop if active
 */
export async function stopSimulation(): Promise<void> {
	// Stop REPL streaming first
	stopReplStreaming();

	// Mark streaming as inactive
	streamingActive = false;

	// Update phase but keep results visible
	simulationState.update((s) => ({
		...s,
		phase: 'idle',
		progress: STATUS_MESSAGES.STOPPED,
		error: null
	}));

	const state = get(replState);
	if (!state.initialized) return;

	try {
		// Stop streaming generator if active
		await exec(STREAMING_STOP_CODE, TIMEOUTS.VALIDATION);

		// Send stop signal to simulation
		await exec(`
if 'sim' in dir() and sim is not None:
    sim.stop()
		`, TIMEOUTS.VALIDATION);
	} catch {
		// Ignore errors - simulation might not exist yet
	}
}

/**
 * Force stop by terminating the worker
 * Use this when graceful stop doesn't work
 */
export function forceStop(): void {
	// Mark streaming as inactive
	streamingActive = false;

	// Update phase but keep results visible
	simulationState.update((s) => ({
		...s,
		phase: 'idle',
		progress: STATUS_MESSAGES.STOPPED,
		error: null
	}));

	terminateRepl();
	helpersInjected = false;
}

/**
 * Truncate simulation result history
 */
export function truncateResultHistory(maxSize: number): void {
	simulationState.update((s) => ({
		...s,
		resultHistory: s.resultHistory.slice(0, maxSize)
	}));
}
