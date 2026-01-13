/**
 * Block Features Module
 *
 * Provides metadata-driven feature definitions for blocks.
 */

export type {
	FeatureType,
	FeatureDefinition,
	PlotPreviewConfig,
	PlotPreviewFeature,
	DataDisplayConfig,
	DataDisplayFeature,
	BlockFeatures
} from './types';

export { isPlotPreviewFeature, isDataDisplayFeature } from './types';

export {
	registerBlockFeatures,
	getBlockFeatures,
	hasFeature,
	getFeature,
	getAllBlockFeatures
} from './registry';
