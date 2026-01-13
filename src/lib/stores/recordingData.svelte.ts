/**
 * Reactive recording node data helper
 * Shared between BaseNode (plot preview) and BlockPropertiesDialog (CSV export)
 */

import { simulationState, type SimulationResult, type SimulationPhase } from '$lib/pyodide/bridge';
import { settingsStore } from '$lib/stores/settings';

export type DataSource = 'scope' | 'spectrum';

export interface ScopeData {
	time: number[];
	signals: number[][];
	labels?: string[];
}

export interface SpectrumData {
	frequency: number[];
	magnitude: number[][];
	labels?: string[];
}

/**
 * Create reactive state for a recording node's data
 * Must be called from component initialization (uses $state)
 */
export function createRecordingDataState() {
	let simResult = $state<SimulationResult | null>(null);
	let resultHistory = $state<SimulationResult[]>([]);
	let simPhase = $state<SimulationPhase>('idle');
	let ghostTraces = $state(0);

	const unsubscribeSim = simulationState.subscribe((s) => {
		simResult = s.result;
		resultHistory = s.resultHistory;
		simPhase = s.phase;
	});

	const unsubscribeSettings = settingsStore.subscribe((s) => {
		ghostTraces = s.ghostTraces ?? 0;
	});

	function getDataSource(nodeType: string): DataSource {
		return nodeType === 'Scope' ? 'scope' : 'spectrum';
	}

	function hasData(nodeId: string, nodeType: string): boolean {
		if (!simResult) return false;
		const dataSource = getDataSource(nodeType);

		if (dataSource === 'scope') {
			const data = simResult.scopeData?.[nodeId];
			return !!(data && data.time.length > 0);
		} else {
			const data = simResult.spectrumData?.[nodeId];
			return !!(data && data.frequency.length > 0);
		}
	}

	function getScopeData(nodeId: string): ScopeData | null {
		return simResult?.scopeData?.[nodeId] || null;
	}

	function getSpectrumData(nodeId: string): SpectrumData | null {
		return simResult?.spectrumData?.[nodeId] || null;
	}

	function getPlotData(nodeId: string, nodeType: string): { type: 'scope'; data: ScopeData } | { type: 'spectrum'; data: SpectrumData } | null {
		const dataSource = getDataSource(nodeType);

		if (dataSource === 'scope') {
			const data = getScopeData(nodeId);
			// Return data if it exists (even with empty arrays - keeps preview mounted during rerun)
			if (data) {
				return { type: 'scope', data };
			}
		} else {
			const data = getSpectrumData(nodeId);
			if (data) {
				return { type: 'spectrum', data };
			}
		}
		return null;
	}

	function getGhostData(nodeId: string, nodeType: string): (ScopeData | SpectrumData)[] {
		if (ghostTraces === 0 || resultHistory.length === 0) return [];

		const dataSource = getDataSource(nodeType);
		const history = resultHistory.slice(0, ghostTraces);

		return history
			.map((result) => {
				if (dataSource === 'scope') {
					return result.scopeData?.[nodeId];
				} else {
					return result.spectrumData?.[nodeId];
				}
			})
			.filter((d): d is ScopeData | SpectrumData => d != null);
	}

	function destroy() {
		unsubscribeSim();
		unsubscribeSettings();
	}

	return {
		get simResult() { return simResult; },
		get resultHistory() { return resultHistory; },
		get simPhase() { return simPhase; },
		get ghostTraces() { return ghostTraces; },
		hasData,
		getScopeData,
		getSpectrumData,
		getPlotData,
		getGhostData,
		destroy
	};
}
