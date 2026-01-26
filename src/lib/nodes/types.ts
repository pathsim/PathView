/**
 * Node type definitions
 *
 * Re-exports types from centralized locations for convenience.
 */

// Re-export all node-related types
export type {
	PortDirection,
	PortDefinition,
	PortInstance,
	ParamType,
	ParamDefinition,
	NodeCategory,
	NodeShape,
	NodeTypeDefinition,
	SubsystemGraph,
	NodeInstance,
	Connection,
	Annotation
} from '$lib/types/nodes';

// Re-export simulation types
export type { SolverType, SimulationSettings } from '$lib/types/simulation';

// Re-export schema types
export type { GraphFile } from '$lib/types/schema';
export { GRAPH_FILE_VERSION } from '$lib/types/schema';

// Re-export simulation defaults
export { DEFAULT_SIMULATION_SETTINGS, INITIAL_SIMULATION_SETTINGS } from '$lib/simulation/defaults';
