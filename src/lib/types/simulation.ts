/**
 * Simulation-related type definitions
 */

/** Scope data from simulation results */
export interface ScopeData {
	time: number[];
	signals: number[][];
	labels?: string[];
}

/** Spectrum data from simulation results */
export interface SpectrumData {
	frequency: number[];
	magnitude: number[][];
	labels?: string[];
}

/** Complete simulation result */
export interface SimulationResult {
	scopeData: Record<string, ScopeData>;
	spectrumData: Record<string, SpectrumData>;
	nodeNames: Record<string, string>;
}

/** Validation error for a specific parameter */
export interface ValidationError {
	nodeId: string;
	param: string;
	error: string;
}

/** Result of code validation */
export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

/** Solver types available in PathSim */
export type SolverType =
	| 'SSPRK22'
	| 'RK4'
	| 'RKBS32'
	| 'RKCK54'
	| 'BDF2'
	| 'GEAR52A'
	| 'ESDIRK43';

/** Simulation settings configuration */
export interface SimulationSettings {
	duration: string; // Simulation duration (Python expression)
	dt: string; // Initial/fixed time step (Python expression)
	solver: SolverType; // Numerical integration method
	adaptive: boolean; // Enable adaptive timestepping
	atol: string; // Absolute LTE tolerance (Python expression)
	rtol: string; // Relative LTE tolerance (Python expression)
	ftol: string; // Fixed-point iteration tolerance (Python expression)
	dt_min: string; // Minimum timestep for adaptive solvers (Python expression)
	dt_max: string; // Maximum timestep for adaptive solvers (Python expression)
	ghostTraces: number; // Number of previous runs to show as ghost traces (0-6)
	plotResults: boolean; // UI: auto-open plot panel
}

/** Worker message types */
export interface WorkerMessage {
	type: 'init' | 'run' | 'continue' | 'clear' | 'status' | 'validate';
	id?: string;
	payload?: unknown;
}

/** Worker response types */
export interface WorkerResponse {
	type: 'ready' | 'result' | 'error' | 'progress' | 'log' | 'stdout' | 'stderr';
	id?: string;
	payload?: unknown;
	error?: string;
}

/** Pyodide runtime state */
export interface PyodideState {
	initialized: boolean;
	loading: boolean;
	error: string | null;
	progress: string;
}

/** Simulation runtime state */
export interface SimulationState {
	running: boolean;
	progress: string;
	error: string | null;
	result: SimulationResult | null;
	resultHistory: SimulationResult[];
}
