/**
 * Event store - Manages PathSim events separately from the graph
 * Events are diamond-shaped nodes without ports
 */

import { writable, derived, get } from 'svelte/store';
import type { EventInstance } from '$lib/events/types';
import type { Position } from '$lib/types';
import { eventRegistry } from '$lib/events/registry';
import { triggerSelectNodes, triggerClearSelection } from '$lib/stores/viewActions';
import { generateId } from '$lib/stores/utils';

// All events in the model
const events = writable<Map<string, EventInstance>>(new Map());

// Selected event IDs
const selectedEventIds = writable<Set<string>>(new Set());

/**
 * Direct setter for event selection - used by FlowCanvas to sync from SvelteFlow
 * This bypasses the trigger system to avoid loops
 */
export function setEventSelection(ids: Set<string>): void {
	selectedEventIds.set(ids);
}

// Derived stores
const eventsArray = derived(events, ($events) => Array.from($events.values()));

const selectedEvents = derived([events, selectedEventIds], ([$events, $selectedIds]) =>
	Array.from($selectedIds)
		.map((id) => $events.get(id))
		.filter((e): e is EventInstance => e !== undefined)
);

/**
 * Event store actions
 */
export const eventStore = {
	// Subscribe to stores
	events: { subscribe: events.subscribe },
	eventsArray: { subscribe: eventsArray.subscribe },
	selectedEventIds: { subscribe: selectedEventIds.subscribe },
	selectedEvents: { subscribe: selectedEvents.subscribe },

	/**
	 * Add a new event
	 */
	addEvent(
		type: string,
		position: Position,
		name?: string
	): EventInstance | null {
		const typeDef = eventRegistry.get(type);
		if (!typeDef) {
			console.error(`Unknown event type: ${type}`);
			return null;
		}

		const id = generateId();
		const event: EventInstance = {
			id,
			type,
			name: name || typeDef.name,
			position,
			params: {} // Start empty - defaults shown as placeholders, code gen uses Python defaults
		};

		events.update((e) => {
			const newMap = new Map(e);
			newMap.set(id, event);
			return newMap;
		});

		return event;
	},

	/**
	 * Remove an event
	 */
	removeEvent(id: string): void {
		events.update((e) => {
			const newMap = new Map(e);
			newMap.delete(id);
			return newMap;
		});

		selectedEventIds.update((ids) => {
			const newSet = new Set(ids);
			newSet.delete(id);
			return newSet;
		});
	},

	/**
	 * Update an event's position
	 */
	updateEventPosition(id: string, position: Position): void {
		events.update((e) => {
			const event = e.get(id);
			if (event) {
				const newMap = new Map(e);
				newMap.set(id, { ...event, position: { ...position } });
				return newMap;
			}
			return e;
		});
	},

	/**
	 * Update an event's name
	 */
	updateEventName(id: string, name: string): void {
		events.update((e) => {
			const event = e.get(id);
			if (event) {
				const newMap = new Map(e);
				newMap.set(id, { ...event, name });
				return newMap;
			}
			return e;
		});
	},

	/**
	 * Update an event's parameters
	 */
	updateEventParams(id: string, params: Record<string, unknown>): void {
		events.update((e) => {
			const event = e.get(id);
			if (event) {
				const newMap = new Map(e);
				newMap.set(id, { ...event, params: { ...event.params, ...params } });
				return newMap;
			}
			return e;
		});
	},

	/**
	 * Update an event's color
	 */
	updateEventColor(id: string, color: string | undefined): void {
		events.update((e) => {
			const event = e.get(id);
			if (event) {
				const newMap = new Map(e);
				newMap.set(id, { ...event, color });
				return newMap;
			}
			return e;
		});
	},

	/**
	 * Select an event (triggers SvelteFlow update)
	 */
	selectEvent(id: string, addToSelection = false): void {
		if (addToSelection) {
			// Get currently selected events and add the new one
			const current = get(selectedEventIds);
			triggerSelectNodes([...current, id], true);
		} else {
			triggerSelectNodes([id], false);
		}
	},

	/**
	 * Deselect an event (triggers SvelteFlow update)
	 */
	deselectEvent(id: string): void {
		const current = get(selectedEventIds);
		const remaining = [...current].filter(eventId => eventId !== id);
		triggerSelectNodes(remaining, false);
	},

	/**
	 * Clear event selection (triggers SvelteFlow update)
	 */
	clearSelection(): void {
		triggerClearSelection();
	},

	/**
	 * Check if any events are selected
	 */
	hasSelection(): boolean {
		return get(selectedEventIds).size > 0;
	},

	/**
	 * Clear all events
	 */
	clear(): void {
		events.set(new Map());
		selectedEventIds.set(new Set());
	},

	/**
	 * Get an event by ID
	 */
	getEvent(id: string): EventInstance | undefined {
		return get(events).get(id);
	},

	/**
	 * Get all events as array
	 */
	getAll(): EventInstance[] {
		return Array.from(get(events).values());
	},

	/**
	 * Select all events
	 */
	selectAll(): void {
		const allIds = Array.from(get(events).keys());
		selectedEventIds.set(new Set(allIds));
	},

	/**
	 * Duplicate selected events
	 */
	duplicateSelected(): string[] {
		const selected = get(selectedEventIds);
		if (selected.size === 0) return [];

		const currentEvents = get(events);
		const newEventIds: string[] = [];
		const offset = { x: 50, y: 50 };

		selected.forEach((id) => {
			const original = currentEvents.get(id);
			if (!original) return;

			const newId = generateId();
			const newEvent: EventInstance = {
				id: newId,
				type: original.type,
				name: original.name,
				position: {
					x: original.position.x + offset.x,
					y: original.position.y + offset.y
				},
				// Deep clone params to avoid shared references
				params: JSON.parse(JSON.stringify(original.params)),
				color: original.color
			};

			events.update((e) => {
				const newMap = new Map(e);
				newMap.set(newId, newEvent);
				return newMap;
			});

			newEventIds.push(newId);
		});

		if (newEventIds.length > 0) {
			triggerSelectNodes(newEventIds, false);
		}

		return newEventIds;
	},

	/**
	 * Nudge selected events by a delta
	 */
	nudgeSelectedEvents(delta: { x: number; y: number }): void {
		const selected = get(selectedEventIds);
		if (selected.size === 0) return;

		events.update((e) => {
			const newMap = new Map(e);
			selected.forEach((id) => {
				const event = newMap.get(id);
				if (event) {
					newMap.set(id, {
						...event,
						position: {
							x: event.position.x + delta.x,
							y: event.position.y + delta.y
						}
					});
				}
			});
			return newMap;
		});
	},

	/**
	 * Get current state as JSON-serializable array
	 */
	toJSON(): EventInstance[] {
		return Array.from(get(events).values());
	},

	/**
	 * Load state from JSON
	 */
	fromJSON(eventList: EventInstance[]): void {
		if (!eventList || !Array.isArray(eventList)) {
			events.set(new Map());
		} else {
			events.set(new Map(eventList.map((e) => [e.id, e])));
		}
		selectedEventIds.set(new Set());
	}
};
