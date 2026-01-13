/**
 * Console store for capturing simulation logs
 * Uses batching to avoid excessive UI updates during rapid logging
 */

import { writable, get } from 'svelte/store';

export interface LogEntry {
	id: number;
	timestamp: Date;
	level: 'info' | 'warning' | 'error' | 'output';
	message: string;
}

let nextId = 0;
const MAX_ENTRIES = 500;

function createConsoleStore() {
	const { subscribe, set, update } = writable<LogEntry[]>([]);

	// Batching state
	let pendingEntries: LogEntry[] = [];
	let flushTimeout: ReturnType<typeof setTimeout> | null = null;
	const BATCH_DELAY = 50; // ms - flush every 50ms max

	function flushPending() {
		if (pendingEntries.length === 0) return;

		const toAdd = pendingEntries;
		pendingEntries = [];
		flushTimeout = null;

		update((entries) => {
			const combined = [...entries, ...toAdd];
			// Keep only the last MAX_ENTRIES to prevent memory bloat
			return combined.length > MAX_ENTRIES
				? combined.slice(-MAX_ENTRIES)
				: combined;
		});
	}

	function scheduleFlush() {
		if (flushTimeout === null) {
			flushTimeout = setTimeout(flushPending, BATCH_DELAY);
		}
	}

	return {
		subscribe,

		log(message: string, level: LogEntry['level'] = 'info') {
			pendingEntries.push({
				id: nextId++,
				timestamp: new Date(),
				level,
				message
			});
			scheduleFlush();
		},

		info(message: string) {
			this.log(message, 'info');
		},

		warn(message: string) {
			this.log(message, 'warning');
		},

		error(message: string) {
			this.log(message, 'error');
		},

		output(message: string) {
			this.log(message, 'output');
		},

		clear() {
			pendingEntries = [];
			if (flushTimeout) {
				clearTimeout(flushTimeout);
				flushTimeout = null;
			}
			set([]);
		},

		getAll() {
			return get({ subscribe });
		},

		// Force flush any pending entries (useful before reading)
		flush() {
			if (flushTimeout) {
				clearTimeout(flushTimeout);
			}
			flushPending();
		}
	};
}

export const consoleStore = createConsoleStore();
