/**
 * Simulation settings store
 */

import { writable, get } from 'svelte/store';
import type { SimulationSettings, SolverType } from '$lib/nodes/types';
import { DEFAULT_SIMULATION_SETTINGS, INITIAL_SIMULATION_SETTINGS } from '$lib/nodes/types';
import { queueUpdateSetting } from '$lib/pyodide/mutationQueue';

/** Map UI setting names to pathsim Simulation attributes */
const SETTING_TO_PATHSIM: Record<string, string> = {
	dt: 'dt',
	dt_min: 'dt_min',
	dt_max: 'dt_max',
	rtol: 'tolerance_lte_rel',
	atol: 'tolerance_lte_abs',
	ftol: 'tolerance_fpi'
};

const settings = writable<SimulationSettings>({ ...INITIAL_SIMULATION_SETTINGS });

export const settingsStore = {
	subscribe: settings.subscribe,

	/**
	 * Update simulation settings
	 */
	update(newSettings: Partial<SimulationSettings>): void {
		settings.update((s) => ({ ...s, ...newSettings }));

		// Queue setting mutations (no-op if no simulation active)
		for (const [key, value] of Object.entries(newSettings)) {
			const pathsimAttr = SETTING_TO_PATHSIM[key];
			if (pathsimAttr && value !== null && value !== undefined && value !== '') {
				queueUpdateSetting(pathsimAttr, String(value));
			}
		}
	},

	/**
	 * Set duration (Python expression)
	 */
	setDuration(duration: string): void {
		settings.update((s) => ({ ...s, duration }));
	},

	/**
	 * Set time step (Python expression)
	 */
	setDt(dt: string): void {
		settings.update((s) => ({ ...s, dt }));
	},

	/**
	 * Set solver
	 */
	setSolver(solver: SolverType): void {
		settings.update((s) => ({ ...s, solver }));
	},

	/**
	 * Reset to initial empty state (defaults shown as placeholders)
	 */
	reset(): void {
		settings.set({ ...INITIAL_SIMULATION_SETTINGS });
	},

	/**
	 * Get current settings
	 */
	get(): SimulationSettings {
		return get(settings);
	},

	/**
	 * Set all settings at once
	 */
	set(newSettings: SimulationSettings): void {
		settings.set(newSettings);
	}
};
