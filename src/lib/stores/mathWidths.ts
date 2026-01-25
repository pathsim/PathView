/**
 * Store for measured math widths
 *
 * When a node name contains LaTeX math, the actual rendered width differs
 * from the string-length estimate. This store holds the measured widths
 * so FlowCanvas can use them for SvelteFlow bounds.
 */

import { writable, get } from 'svelte/store';

const internal = writable<Map<string, number>>(new Map());

export const mathWidthStore = {
	subscribe: internal.subscribe,

	/** Set the measured width for a node */
	set(nodeId: string, width: number): void {
		internal.update((map) => {
			map.set(nodeId, width);
			return new Map(map); // New reference to trigger reactivity
		});
	},

	/** Get the measured width for a node (returns undefined if not measured) */
	get(nodeId: string): number | undefined {
		return get(internal).get(nodeId);
	},

	/** Remove a node's measured width (call when node is deleted) */
	remove(nodeId: string): void {
		internal.update((map) => {
			map.delete(nodeId);
			return new Map(map);
		});
	},

	/** Clear all measured widths */
	clear(): void {
		internal.set(new Map());
	}
};
