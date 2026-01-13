/**
 * Core type definitions for PathView nodes
 */

import type { Position } from './common';
import type { EventInstance } from './events';

/** Port direction */
export type PortDirection = 'input' | 'output';

/** Port definition for a node type (static metadata) */
export interface PortDefinition {
	name: string;
	direction: PortDirection;
	color?: string;
}

/** Port instance on a node (runtime) */
export interface PortInstance {
	id: string; // Unique port ID: `${nodeId}-${direction}-${index}`
	nodeId: string;
	name: string;
	direction: PortDirection;
	index: number;
	color: string;
}

/** Parameter type annotation (mirrors Python type hints) */
export type ParamType = 'number' | 'integer' | 'boolean' | 'string' | 'array' | 'callable' | 'any';

/** Parameter definition for a node type */
export interface ParamDefinition {
	name: string;
	type: ParamType;
	default: unknown;
	description?: string;
	min?: number; // For numeric types
	max?: number; // For numeric types
	options?: string[]; // For enum-like strings
}

/** Node type category */
export type NodeCategory =
	| 'Sources'
	| 'Dynamic'
	| 'Algebraic'
	| 'Mixed'
	| 'Recording'
	| 'Subsystem';

/** Node shape override (defaults based on category if not specified) */
export type NodeShape = 'pill' | 'rect' | 'circle' | 'diamond';

/** Node type definition (static metadata - like Python class) */
export interface NodeTypeDefinition {
	type: string; // Block class name: 'Constant', 'Integrator', etc.
	name: string; // Display name: 'Constant'
	category: NodeCategory;
	description: string;
	color?: string; // Optional custom color (defaults to pathsim-blue)

	// Port configuration
	ports: {
		inputs: PortDefinition[];
		outputs: PortDefinition[];
		minInputs: number; // minimum number of input ports (default 1)
		minOutputs: number; // minimum number of output ports (default 1)
		maxInputs: number | null; // null = unlimited
		maxOutputs: number | null;
	};

	// Parameter definitions
	params: ParamDefinition[];

	// PathSim block class name for export
	blockClass: string;

	// Full RST docstring from PathSim (for documentation display)
	docstring?: string;

	// Shape override (defaults based on category if not specified)
	shape?: NodeShape;
}

/** Subsystem's internal graph (nested structure) */
export interface SubsystemGraph {
	nodes: NodeInstance[];
	connections: Connection[];
	annotations?: Annotation[];
	events?: EventInstance[];
}

/** Node instance (runtime - like Python object) */
export interface NodeInstance {
	id: string; // Unique instance ID
	type: string; // References NodeTypeDefinition.type
	name: string; // User-editable display name
	position: Position;

	// Dynamic port instances
	inputs: PortInstance[];
	outputs: PortInstance[];

	// Parameter values (user-edited)
	params: Record<string, unknown>;

	// Parameter names to show as inline inputs on node
	pinnedParams?: string[];

	// Custom node color (optional - defaults to pathsim-blue)
	color?: string;

	// Nested graph for Subsystem nodes
	graph?: SubsystemGraph;

	// Index signature for SvelteFlow compatibility
	[key: string]: unknown;
}

/** Connection between ports */
export interface Connection {
	id: string;
	sourceNodeId: string;
	sourcePortIndex: number;
	targetNodeId: string;
	targetPortIndex: number;
}

/** Canvas annotation (markdown/LaTeX text) */
export interface Annotation {
	id: string;
	position: Position;
	content: string; // Markdown with LaTeX ($...$, $$...$$)
	width: number;
	height: number;
	color?: string; // Optional custom color (defaults to --pathsim-blue)

	// Index signature for SvelteFlow compatibility
	[key: string]: unknown;
}
