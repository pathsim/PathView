/**
 * Plot settings store
 * Controls visual appearance of plots (line styles, markers, axis scaling)
 */

import { writable, get } from 'svelte/store';

export type LineStyle = 'none' | 'solid' | 'dash' | 'dot' | 'dashdot';
export type MarkerStyle = 'circle' | 'square' | 'diamond' | 'cross' | 'x' | 'triangle-up';
export type AxisScale = 'linear' | 'log';

export interface PlotSettings {
	lineStyle: LineStyle;
	showMarkers: boolean;
	markerStyle: MarkerStyle;
	xAxisScale: AxisScale;
	yAxisScale: AxisScale;
	showLegend: boolean;
}

const DEFAULT_PLOT_SETTINGS: PlotSettings = {
	lineStyle: 'solid',
	showMarkers: false,
	markerStyle: 'circle',
	xAxisScale: 'linear',
	yAxisScale: 'linear',
	showLegend: false
};

const settings = writable<PlotSettings>({ ...DEFAULT_PLOT_SETTINGS });

export const plotSettingsStore = {
	subscribe: settings.subscribe,

	update(newSettings: Partial<PlotSettings>): void {
		settings.update((s) => ({ ...s, ...newSettings }));
	},

	setLineStyle(lineStyle: LineStyle): void {
		settings.update((s) => ({ ...s, lineStyle }));
	},

	setShowMarkers(showMarkers: boolean): void {
		settings.update((s) => ({ ...s, showMarkers }));
	},

	setMarkerStyle(markerStyle: MarkerStyle): void {
		settings.update((s) => ({ ...s, markerStyle }));
	},

	setXAxisScale(xAxisScale: AxisScale): void {
		settings.update((s) => ({ ...s, xAxisScale }));
	},

	setYAxisScale(yAxisScale: AxisScale): void {
		settings.update((s) => ({ ...s, yAxisScale }));
	},

	setShowLegend(showLegend: boolean): void {
		settings.update((s) => ({ ...s, showLegend }));
	},

	reset(): void {
		settings.set({ ...DEFAULT_PLOT_SETTINGS });
	},

	get(): PlotSettings {
		return get(settings);
	}
};
