/**
 * Centralized node type identifiers
 * These match the PathSim block class names directly
 */
export const NODE_TYPES = {
	SUBSYSTEM: 'Subsystem',
	INTERFACE: 'Interface'
} as const;

export type NodeTypeId = (typeof NODE_TYPES)[keyof typeof NODE_TYPES];
