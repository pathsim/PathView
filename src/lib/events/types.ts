/**
 * Event type definitions
 *
 * Re-exports types from centralized location for backwards compatibility.
 * New code should import from '$lib/types' directly.
 */

export type {
	EventCategory,
	EventParamType,
	EventParamDefinition,
	EventTypeDefinition,
	EventInstance
} from '$lib/types/events';
