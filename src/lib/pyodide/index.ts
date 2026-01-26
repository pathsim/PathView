/**
 * Pyodide module entry point
 * Re-exports all Pyodide-related functionality
 */

// High-level simulation API
export {
	initPyodide,
	runStreamingSimulation,
	continueStreamingSimulation,
	resetSimulation,
	validateGraph,
	stopSimulation,
	forceStop,
	truncateResultHistory,
	pyodideState,
	simulationState,
	type SimulationResult,
	type ValidationResult,
	type ValidationError
} from './bridge';

// Code generation
export {
	generatePythonCode,
	runGraphStreamingSimulation,
	exportToPython,
	validateGraphSimulation,
	generateBlockCode,
	generateSingleEventCode,
	sanitizeName
} from './pathsimRunner';

// Low-level backend API
export {
	init as initRepl,
	exec,
	evaluate,
	terminate as terminateRepl,
	isReady as isReplReady,
	isLoading as isReplLoading,
	replState,
	getBackend,
	terminateBackend,
	type Backend,
	type BackendState
} from './backend';
