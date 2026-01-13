/**
 * Core type definitions for PathView events
 */

import type { Position } from './common';

/** Event type category */
export type EventCategory = 'Events';

/** Parameter type for events (subset of node params + callable) */
export type EventParamType = 'number' | 'string' | 'callable' | 'array';

/** Parameter definition for an event type */
export interface EventParamDefinition {
	name: string;
	type: EventParamType;
	default: unknown;
	description?: string;
	required?: boolean;
}

/** Event type definition (static metadata - like Python class) */
export interface EventTypeDefinition {
	type: string; // Unique type ID: 'pathsim.events.ZeroCrossing'
	name: string; // Display name: 'ZeroCrossing'
	description: string;

	// Parameter definitions
	params: EventParamDefinition[];

	// PathSim event class name for export
	eventClass: string;

	// Pre-converted HTML docstring (for documentation display)
	docstringHtml?: string;
}

/** Event instance (runtime - like Python object) */
export interface EventInstance {
	id: string; // Unique instance ID
	type: string; // Reference to EventTypeDefinition.type
	name: string; // User-defined name (e.g., 'bounce_event')

	// Position on canvas
	position: Position;

	// Parameter values (user-provided Python expressions)
	params: Record<string, unknown>;

	// Optional color override
	color?: string;

	// Index signature for SvelteFlow compatibility
	[key: string]: unknown;
}
