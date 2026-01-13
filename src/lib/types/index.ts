/**
 * Centralized type exports
 *
 * This module re-exports all types from the types directory.
 * Import from '$lib/types' for cleaner imports.
 */

// Common types
export type { Position, Size, Bounds, RotationValue } from './common';

// Node types
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
} from './nodes';

// Event types
export type {
	EventCategory,
	EventParamType,
	EventParamDefinition,
	EventTypeDefinition,
	EventInstance
} from './events';

// Simulation types
export type {
	ScopeData,
	SpectrumData,
	SimulationResult,
	ValidationError,
	ValidationResult,
	SolverType,
	SimulationSettings,
	WorkerMessage,
	WorkerResponse,
	PyodideState,
	SimulationState
} from './simulation';

// UI types
export type {
	Theme,
	LogEntry,
	ContextMenuTarget,
	ContextMenuState,
	DialogState,
	NodeDialogState,
	EventDialogState,
	SearchableNode
} from './ui';

// Registry types
export type {
	ExtractedParam,
	ExtractedBlock,
	UIOverride,
	BlockCategory,
	ExtractedEventParam,
	ExtractedEvent,
	ExtractedSimulationParam
} from './registry';

// Schema types
export type { FileMetadata, GraphContent, GraphFile } from './schema';
export { GRAPH_FILE_VERSION } from './schema';

// Component types
export type {
	ComponentType,
	ComponentFile,
	BlockContent,
	SubsystemContent,
	ModelContent
} from './component';
export { COMPONENT_EXTENSIONS, COMPONENT_MIME_TYPES, ALL_COMPONENT_EXTENSIONS } from './component';
