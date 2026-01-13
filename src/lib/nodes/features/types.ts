/**
 * Block Feature Type Definitions
 *
 * Features are optional behaviors that blocks can have,
 * defined declaratively in metadata rather than hardcoded.
 */

/** Available feature types */
export type FeatureType = 'plot-preview' | 'data-display' | 'configurable-size' | 'live-update';

/** Base feature definition */
export interface FeatureDefinition {
	type: FeatureType;
	config?: Record<string, unknown>;
}

/** Plot preview feature configuration */
export interface PlotPreviewConfig extends Record<string, unknown> {
	plotType: 'time-series' | 'spectrum' | 'xy';
	dataSource: 'scope' | 'spectrum';
}

/** Plot preview feature */
export interface PlotPreviewFeature {
	type: 'plot-preview';
	config: PlotPreviewConfig;
}

/** Data display feature configuration */
export interface DataDisplayConfig extends Record<string, unknown> {
	format: 'number' | 'array' | 'matrix';
	precision?: number;
}

/** Data display feature */
export interface DataDisplayFeature {
	type: 'data-display';
	config: DataDisplayConfig;
}

/** Block with features */
export interface BlockFeatures {
	blockType: string;
	features: FeatureDefinition[];
}

/** Type guard for plot preview feature */
export function isPlotPreviewFeature(feature: FeatureDefinition): feature is PlotPreviewFeature {
	return feature.type === 'plot-preview';
}

/** Type guard for data display feature */
export function isDataDisplayFeature(feature: FeatureDefinition): feature is DataDisplayFeature {
	return feature.type === 'data-display';
}
