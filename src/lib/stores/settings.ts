/**
 * Simulation settings store
 */

import { writable, get } from 'svelte/store';
import type { SimulationSettings, SolverType } from '$lib/nodes/types';
import { DEFAULT_SIMULATION_SETTINGS, INITIAL_SIMULATION_SETTINGS } from '$lib/nodes/types';
import { queueUpdateSetting } from '$lib/pyodide/mutationQueue';

/** Map UI setting names to pathsim Simulation attribute mutations */
const SETTING_MUTATIONS: Record<string, (value: string) => { attr: string; code: string }> = {
	dt:     (v) => ({ attr: 'dt',     code: `sim.dt = ${v}` }),
	dt_min: (v) => ({ attr: 'dt_min', code: `sim.dt_min = ${v}` }),
	dt_max: (v) => ({ attr: 'dt_max', code: `sim.dt_max = ${v}` }),
	rtol:   (v) => ({ attr: 'rtol',   code: `sim.tolerance_lte_rel = ${v}` }),
	atol:   (v) => ({ attr: 'atol',   code: `sim.tolerance_lte_abs = ${v}` }),
	ftol:   (v) => ({ attr: 'ftol',   code: `sim.tolerance_fpi = ${v}` }),
	solver: (v) => ({ attr: 'solver', code: `sim._set_solver(${v})` })
};

function queueSettingChanges(newSettings: Partial<SimulationSettings>): void {
	for (const [key, value] of Object.entries(newSettings)) {
		if (value === null || value === undefined || value === '') continue;
		const mutationFn = SETTING_MUTATIONS[key];
		if (mutationFn) {
			const { attr, code } = mutationFn(String(value));
			queueUpdateSetting(attr, code);  // attr is the coalescing key, code is the Python to execute
		}
	}
}

const settings = writable<SimulationSettings>({ ...INITIAL_SIMULATION_SETTINGS });

export const settingsStore = {
	subscribe: settings.subscribe,

	/**
	 * Update simulation settings
	 */
	update(newSettings: Partial<SimulationSettings>): void {
		settings.update((s) => ({ ...s, ...newSettings }));
		queueSettingChanges(newSettings);
	},

	/**
	 * Set duration (Python expression)
	 */
	setDuration(duration: string): void {
		settings.update((s) => ({ ...s, duration }));
		// Duration is not a sim attribute — it's passed to run_streaming()
	},

	/**
	 * Set time step (Python expression)
	 */
	setDt(dt: string): void {
		settings.update((s) => ({ ...s, dt }));
		queueSettingChanges({ dt });
	},

	/**
	 * Set solver
	 */
	setSolver(solver: SolverType): void {
		settings.update((s) => ({ ...s, solver }));
		queueSettingChanges({ solver });
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
