/**
 * Unified Event Facade
 *
 * Provides a single interface for event operations that works at both:
 * - Root level (delegates to eventStore)
 * - Subsystem level (delegates to graphStore subsystem event methods)
 *
 * This eliminates the need for consumers to check isAtRoot() before every operation.
 */

import { derived } from 'svelte/store';
import { eventStore } from './events';
import { graphStore } from './graph';
import { eventRegistry } from '$lib/events/registry';
import type { EventInstance } from '$lib/events/types';
import type { Position } from '$lib/types';

/**
 * Check if we're at the root level
 */
function isAtRoot(): boolean {
	return graphStore.isAtRoot();
}

/**
 * Unified event operations that work at any navigation level
 */
export const unifiedEvents = {
	/**
	 * Subscribe to current events (root or subsystem based on navigation)
	 * Returns a derived store that switches between sources
	 */
	get events() {
		return derived(
			[eventStore.eventsArray, graphStore.subsystemEvents, graphStore.currentPath],
			([$rootEvents, $subsystemEvents, $path]) => {
				return $path.length === 0 ? $rootEvents : Array.from($subsystemEvents.values());
			}
		);
	},

	/**
	 * Add an event at the current navigation level
	 */
	addEvent(
		type: string,
		position: Position,
		name?: string
	): EventInstance | null {
		if (isAtRoot()) {
			return eventStore.addEvent(type, position, name);
		} else {
			// Create event instance for subsystem
			const typeDef = eventRegistry.get(type);
			if (!typeDef) return null;

			const event: EventInstance = {
				id: crypto.randomUUID(),
				type,
				name: name || typeDef.name,
				position,
				params: {}
			};

			const success = graphStore.addSubsystemEvent(event);
			return success ? event : null;
		}
	},

	/**
	 * Remove an event at the current navigation level
	 */
	removeEvent(id: string): void {
		if (isAtRoot()) {
			eventStore.removeEvent(id);
		} else {
			graphStore.removeSubsystemEvent(id);
		}
	},

	/**
	 * Update an event's position
	 */
	updateEventPosition(id: string, position: Position): void {
		if (isAtRoot()) {
			eventStore.updateEventPosition(id, position);
		} else {
			graphStore.updateSubsystemEventPosition(id, position);
		}
	},

	/**
	 * Update an event's name
	 */
	updateEventName(id: string, name: string): void {
		if (isAtRoot()) {
			eventStore.updateEventName(id, name);
		} else {
			graphStore.updateSubsystemEventName(id, name);
		}
	},

	/**
	 * Update an event's parameters
	 */
	updateEventParams(id: string, params: Record<string, unknown>): void {
		if (isAtRoot()) {
			eventStore.updateEventParams(id, params);
		} else {
			graphStore.updateSubsystemEventParams(id, params);
		}
	},

	/**
	 * Update an event's color
	 */
	updateEventColor(id: string, color: string | undefined): void {
		if (isAtRoot()) {
			eventStore.updateEventColor(id, color);
		} else {
			graphStore.updateSubsystemEventColor(id, color);
		}
	},

	/**
	 * Get an event by ID at the current navigation level
	 */
	getEvent(id: string): EventInstance | undefined {
		if (isAtRoot()) {
			return eventStore.getEvent(id);
		} else {
			return graphStore.getSubsystemEvent(id);
		}
	},

	/**
	 * Get all events at the current navigation level
	 */
	getAll(): EventInstance[] {
		if (isAtRoot()) {
			return eventStore.getAll();
		} else {
			return graphStore.getSubsystemEvents();
		}
	},

	/**
	 * Select an event
	 */
	selectEvent(id: string, addToSelection = false): void {
		// Selection is only supported at root level currently
		if (isAtRoot()) {
			eventStore.selectEvent(id, addToSelection);
		}
	},

	/**
	 * Clear event selection
	 */
	clearSelection(): void {
		if (isAtRoot()) {
			eventStore.clearSelection();
		}
	},

	/**
	 * Check if we're at root level (useful for components that need to know)
	 */
	isAtRoot
};

// Re-export for convenience
export { eventStore } from './events';
