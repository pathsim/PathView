/**
 * Plot settings store
 * Controls visual appearance of plots with per-trace and per-block customization
 */

import { writable, get } from 'svelte/store';

// Import and re-export types from plotting core (single source of truth)
export type { LineStyle, MarkerStyle, AxisScale } from '$lib/plotting/core/types';
import type { LineStyle, MarkerStyle, AxisScale } from '$lib/plotting/core/types';

/** Settings for an individual trace */
export interface TraceSettings {
	lineStyle: LineStyle | null; // null = no line
	markerStyle: MarkerStyle | null; // null = no markers
}

/** Settings for a recording block (node) */
export interface BlockSettings {
	xAxisScale: AxisScale;
	yAxisScale: AxisScale;
	showLegend: boolean;
}

/** Global plot settings */
export interface PlotSettings {
	/** Per-trace settings keyed by traceId (nodeId-signalIndex) */
	traces: Record<string, TraceSettings>;
	/** Per-block settings keyed by nodeId */
	blocks: Record<string, BlockSettings>;
}

export const DEFAULT_TRACE_SETTINGS: TraceSettings = {
	lineStyle: 'solid',
	markerStyle: null
};

export const DEFAULT_BLOCK_SETTINGS: BlockSettings = {
	xAxisScale: 'linear',
	yAxisScale: 'linear',
	showLegend: false
};

const DEFAULT_PLOT_SETTINGS: PlotSettings = {
	traces: {},
	blocks: {}
};

const settings = writable<PlotSettings>({ ...DEFAULT_PLOT_SETTINGS });

export const plotSettingsStore = {
	subscribe: settings.subscribe,

	/** Get settings for a trace, returning defaults if not set */
	getTraceSettings(traceId: string): TraceSettings {
		const s = get(settings);
		return s.traces[traceId] ?? { ...DEFAULT_TRACE_SETTINGS };
	},

	/** Get settings for a block, returning defaults if not set */
	getBlockSettings(nodeId: string): BlockSettings {
		const s = get(settings);
		return s.blocks[nodeId] ?? { ...DEFAULT_BLOCK_SETTINGS };
	},

	/** Update settings for a specific trace */
	setTraceSettings(traceId: string, traceSettings: Partial<TraceSettings>): void {
		settings.update((s) => {
			const current = s.traces[traceId] ?? { ...DEFAULT_TRACE_SETTINGS };
			return {
				...s,
				traces: {
					...s.traces,
					[traceId]: { ...current, ...traceSettings }
				}
			};
		});
	},

	/** Update settings for a specific block */
	setBlockSettings(nodeId: string, blockSettings: Partial<BlockSettings>): void {
		settings.update((s) => {
			const current = s.blocks[nodeId] ?? { ...DEFAULT_BLOCK_SETTINGS };
			return {
				...s,
				blocks: {
					...s.blocks,
					[nodeId]: { ...current, ...blockSettings }
				}
			};
		});
	},

	/** Set line style for a trace */
	setTraceLineStyle(traceId: string, lineStyle: LineStyle | null): void {
		this.setTraceSettings(traceId, { lineStyle });
	},

	/** Set marker style for a trace */
	setTraceMarkerStyle(traceId: string, markerStyle: MarkerStyle | null): void {
		this.setTraceSettings(traceId, { markerStyle });
	},

	/** Set X axis scale for a block */
	setBlockXAxisScale(nodeId: string, xAxisScale: AxisScale): void {
		this.setBlockSettings(nodeId, { xAxisScale });
	},

	/** Set Y axis scale for a block */
	setBlockYAxisScale(nodeId: string, yAxisScale: AxisScale): void {
		this.setBlockSettings(nodeId, { yAxisScale });
	},

	/** Set show legend for a block */
	setBlockShowLegend(nodeId: string, showLegend: boolean): void {
		this.setBlockSettings(nodeId, { showLegend });
	},

	reset(): void {
		settings.set({ ...DEFAULT_PLOT_SETTINGS });
	},

	get(): PlotSettings {
		return get(settings);
	}
};

/** Helper to create a trace ID */
export function createTraceId(nodeId: string, signalIndex: number): string {
	return `${nodeId}-${signalIndex}`;
}
