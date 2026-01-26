/**
 * Default simulation settings
 * Values extracted from PathSim via scripts/extract.py
 */

import { extractedSimulationParams, uiOnlyParams } from '$lib/simulation/generated/simulation';
import type { SolverType, SimulationSettings } from '$lib/types/simulation';

function getExtractedDefault(key: string): string {
	const param = extractedSimulationParams[key];
	return param?.default ?? '';
}

/** Default values for simulation settings (used as placeholders and code gen fallback) */
export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
	duration: getExtractedDefault('duration'),
	dt: getExtractedDefault('dt'),
	solver: (getExtractedDefault('solver') || 'SSPRK22') as SolverType,
	adaptive: true,
	atol: getExtractedDefault('atol'),
	rtol: getExtractedDefault('rtol'),
	ftol: getExtractedDefault('ftol'),
	dt_min: getExtractedDefault('dt_min'),
	dt_max: getExtractedDefault('dt_max'),
	ghostTraces: parseInt(uiOnlyParams.ghostTraces?.default || '0'),
	plotResults: uiOnlyParams.plotResults?.default === 'true'
};

/** Initial empty settings (defaults shown as placeholders) */
export const INITIAL_SIMULATION_SETTINGS: SimulationSettings = {
	duration: '',
	dt: '',
	solver: 'SSPRK22',
	adaptive: true,
	atol: '',
	rtol: '',
	ftol: '',
	dt_min: '',
	dt_max: '',
	ghostTraces: 0,
	plotResults: true
};
