/**
 * Event type registry
 * Manages all available event type definitions
 */

import type { EventTypeDefinition } from './types';
import { eventDefinitions } from './definitions';

class EventRegistry {
	private events = new Map<string, EventTypeDefinition>();

	constructor() {
		// Register all built-in event definitions
		for (const def of eventDefinitions) {
			this.register(def);
		}
	}

	/**
	 * Register an event type definition
	 */
	register(definition: EventTypeDefinition): void {
		this.events.set(definition.type, definition);
	}

	/**
	 * Get an event type definition by type ID
	 */
	get(type: string): EventTypeDefinition | undefined {
		return this.events.get(type);
	}

	/**
	 * Get all registered event type definitions
	 */
	getAll(): EventTypeDefinition[] {
		return Array.from(this.events.values());
	}

	/**
	 * Check if an event type is registered
	 */
	has(type: string): boolean {
		return this.events.has(type);
	}
}

// Singleton instance
export const eventRegistry = new EventRegistry();
