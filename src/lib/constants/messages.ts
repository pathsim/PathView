/**
 * User-facing messages and progress indicators
 */

export const PROGRESS_MESSAGES = {
	LOADING_PYODIDE: 'Loading Pyodide...',
	INSTALLING_DEPS: 'Installing NumPy and SciPy...',
	INSTALLING_PATHSIM: 'Installing PathSim...',
	INSTALLING_PATHSIM_CHEM: 'Installing PathSim-Chem...',
	STARTING_WORKER: 'Starting worker...',
	STARTING_SIMULATION: 'Starting simulation...'
} as const;

export const STATUS_MESSAGES = {
	READY: 'Ready',
	COMPLETE: 'Complete',
	STOPPED: 'Stopped',
	RUNNING: 'Running'
} as const;

export const ERROR_MESSAGES = {
	SIMULATION_FAILED: 'Simulation failed:',
	NO_SIMULATION_TO_CONTINUE: 'No simulation to continue. Run a simulation first.',
	WORKER_NOT_INITIALIZED: 'Worker not initialized',
	FAILED_TO_LOAD_PYODIDE: 'Failed to load Pyodide'
} as const;

export const SUCCESS_MESSAGES = {
	SIMULATION_COMPLETED: 'Simulation completed successfully'
} as const;
