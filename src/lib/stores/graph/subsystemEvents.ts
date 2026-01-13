/**
 * Graph store - Subsystem event operations
 * These methods manage events within subsystems (not root level)
 */

import { get } from 'svelte/store';
import type { EventInstance } from '$lib/events/types';
import {
	currentPath,
	getCurrentGraph,
	updateSubsystemGraph
} from './state';

/**
 * Add an event to the current subsystem (only works inside subsystems)
 */
export function addSubsystemEvent(event: EventInstance): boolean {
	const path = get(currentPath);
	if (path.length === 0) return false; // Root events use eventStore

	updateSubsystemGraph(path, graph => ({
		...graph,
		events: [...(graph.events || []), event]
	}));
	return true;
}

/**
 * Remove an event from the current subsystem
 */
export function removeSubsystemEvent(id: string): void {
	const path = get(currentPath);
	if (path.length === 0) return;

	updateSubsystemGraph(path, graph => ({
		...graph,
		events: (graph.events || []).filter(e => e.id !== id)
	}));
}

/**
 * Update a subsystem event's position
 */
export function updateSubsystemEventPosition(id: string, position: { x: number; y: number }): void {
	const path = get(currentPath);
	if (path.length === 0) return;

	updateSubsystemGraph(path, graph => ({
		...graph,
		events: (graph.events || []).map(e =>
			e.id === id ? { ...e, position: { ...position } } : e
		)
	}));
}

/**
 * Update a subsystem event's name
 */
export function updateSubsystemEventName(id: string, name: string): void {
	const path = get(currentPath);
	if (path.length === 0) return;

	updateSubsystemGraph(path, graph => ({
		...graph,
		events: (graph.events || []).map(e =>
			e.id === id ? { ...e, name } : e
		)
	}));
}

/**
 * Update a subsystem event's parameters
 */
export function updateSubsystemEventParams(id: string, params: Record<string, unknown>): void {
	const path = get(currentPath);
	if (path.length === 0) return;

	updateSubsystemGraph(path, graph => ({
		...graph,
		events: (graph.events || []).map(e =>
			e.id === id ? { ...e, params: { ...e.params, ...params } } : e
		)
	}));
}

/**
 * Update a subsystem event's color
 */
export function updateSubsystemEventColor(id: string, color: string | undefined): void {
	const path = get(currentPath);
	if (path.length === 0) return;

	updateSubsystemGraph(path, graph => ({
		...graph,
		events: (graph.events || []).map(e =>
			e.id === id ? { ...e, color } : e
		)
	}));
}

/**
 * Get a subsystem event by ID
 */
export function getSubsystemEvent(id: string): EventInstance | undefined {
	return getCurrentGraph().events.get(id);
}

/**
 * Get all subsystem events as array
 */
export function getSubsystemEvents(): EventInstance[] {
	return Array.from(getCurrentGraph().events.values());
}
