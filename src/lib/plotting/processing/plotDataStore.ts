/**
 * Plot data store - central reactive store for processed plot data
 *
 * This store:
 * 1. Subscribes to simulationState, plotSettingsStore, and settingsStore
 * 2. Uses the unified renderQueue for throttling
 * 3. Calls processPlot() for each plot
 * 4. Outputs a Map<nodeId, ProcessedPlot>
 */

import { writable, get } from 'svelte/store';
import { simulationState, type SimulationResult } from '$lib/pyodide/bridge';
import { plotSettingsStore, createTraceId } from '$lib/stores/plotSettings';
import { settingsStore } from '$lib/stores/settings';
import { processPlot } from './dataProcessor';
import { plotRenderQueue } from './renderQueue';
import { getAccentColor } from '../core/constants';
import type { ProcessedPlot, PlotDataState, RawScopeData, RawSpectrumData } from '../core/types';

// ============================================================
// INTERNAL STATE
// ============================================================

const internal = writable<PlotDataState>({
	plots: new Map(),
	isStreaming: false,
	lastUpdateTime: 0
});

// Queue ID for this store
const queueId = Symbol('plotDataStore');

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Process all plots from current simulation state
 */
function processAllPlots(
	result: SimulationResult | null,
	resultHistory: SimulationResult[],
	ghostTraceCount: number
): Map<string, ProcessedPlot> {
	const plots = new Map<string, ProcessedPlot>();

	if (!result) return plots;

	const accentColor = getAccentColor();

	// Helper to get node name
	const getNodeName = (id: string, fallback: string) => result.nodeNames?.[id] || fallback;

	// Helper to get ghost data for a node
	const getGhostData = (
		nodeId: string,
		type: 'scope' | 'spectrum'
	): (RawScopeData | RawSpectrumData)[] => {
		const history = resultHistory.slice(0, ghostTraceCount);
		return history
			.map((r) => (type === 'scope' ? r.scopeData?.[nodeId] : r.spectrumData?.[nodeId]))
			.filter((d): d is RawScopeData | RawSpectrumData => d != null);
	};

	// Process scope plots
	if (result.scopeData) {
		for (const [nodeId, data] of Object.entries(result.scopeData)) {
			const processed = processPlot({
				nodeId,
				type: 'scope',
				title: getNodeName(nodeId, 'Scope'),
				data,
				ghostData: getGhostData(nodeId, 'scope'),
				getTraceSettings: (idx) => plotSettingsStore.getTraceSettings(createTraceId(nodeId, idx)),
				blockSettings: plotSettingsStore.getBlockSettings(nodeId),
				accentColor
			});
			plots.set(nodeId, processed);
		}
	}

	// Process spectrum plots
	if (result.spectrumData) {
		for (const [nodeId, data] of Object.entries(result.spectrumData)) {
			// Initialize spectrum blocks with log Y-axis if not set
			const existingSettings = get(plotSettingsStore).blocks[nodeId];
			if (!existingSettings) {
				plotSettingsStore.setBlockYAxisScale(nodeId, 'log');
			}

			const processed = processPlot({
				nodeId,
				type: 'spectrum',
				title: getNodeName(nodeId, 'Spectrum'),
				data,
				ghostData: getGhostData(nodeId, 'spectrum'),
				getTraceSettings: (idx) => plotSettingsStore.getTraceSettings(createTraceId(nodeId, idx)),
				blockSettings: plotSettingsStore.getBlockSettings(nodeId),
				accentColor
			});
			plots.set(nodeId, processed);
		}
	}

	return plots;
}

// ============================================================
// SCHEDULING & SUBSCRIPTIONS
// ============================================================

// Track last values to avoid unnecessary processing
let lastResult: SimulationResult | null = null;
let lastHistory: SimulationResult[] = [];
let lastGhostCount = 0;

/**
 * Schedule processing via the render queue
 */
function scheduleProcessing() {
	plotRenderQueue.enqueue(queueId, () => {
		const simState = get(simulationState);
		const settings = get(settingsStore);
		const ghostCount = settings.ghostTraces ?? 0;

		const plots = processAllPlots(simState.result, simState.resultHistory, ghostCount);

		internal.set({
			plots,
			isStreaming: simState.phase === 'running',
			lastUpdateTime: Date.now()
		});
	});
}

// Subscribe to simulation state changes
simulationState.subscribe((state) => {
	if (state.result !== lastResult || state.resultHistory !== lastHistory) {
		lastResult = state.result;
		lastHistory = state.resultHistory;
		scheduleProcessing();
	}
});

// Subscribe to ghost trace count changes
settingsStore.subscribe((state) => {
	if ((state.ghostTraces ?? 0) !== lastGhostCount) {
		lastGhostCount = state.ghostTraces ?? 0;
		scheduleProcessing();
	}
});

// Subscribe to plot settings changes
plotSettingsStore.subscribe(() => {
	// Settings changed, reprocess
	scheduleProcessing();
});

// ============================================================
// PUBLIC API
// ============================================================

export const plotDataStore = {
	subscribe: internal.subscribe,

	/**
	 * Get processed data for a specific plot
	 */
	getPlot(nodeId: string): ProcessedPlot | undefined {
		return get(internal).plots.get(nodeId);
	},

	/**
	 * Get all processed plots as an array
	 */
	getAllPlots(): ProcessedPlot[] {
		return Array.from(get(internal).plots.values());
	},

	/**
	 * Check if currently streaming
	 */
	isStreaming(): boolean {
		return get(internal).isStreaming;
	}
};
