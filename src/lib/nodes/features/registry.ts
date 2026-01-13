/**
 * Block Feature Registry
 *
 * Maps block types to their features.
 * Features are registered here rather than hardcoded in components.
 */

import type { FeatureDefinition, BlockFeatures, PlotPreviewFeature } from './types';

/** Registry of block features */
const blockFeatures = new Map<string, FeatureDefinition[]>();

/** Register features for a block type */
export function registerBlockFeatures(blockType: string, features: FeatureDefinition[]): void {
	blockFeatures.set(blockType, features);
}

/** Get features for a block type */
export function getBlockFeatures(blockType: string): FeatureDefinition[] {
	return blockFeatures.get(blockType) || [];
}

/** Check if a block has a specific feature type */
export function hasFeature(blockType: string, featureType: FeatureDefinition['type']): boolean {
	const features = getBlockFeatures(blockType);
	return features.some((f) => f.type === featureType);
}

/** Get a specific feature from a block */
export function getFeature<T extends FeatureDefinition>(
	blockType: string,
	featureType: T['type']
): T | undefined {
	const features = getBlockFeatures(blockType);
	return features.find((f) => f.type === featureType) as T | undefined;
}

/** Get all registered block features */
export function getAllBlockFeatures(): BlockFeatures[] {
	return Array.from(blockFeatures.entries()).map(([blockType, features]) => ({
		blockType,
		features
	}));
}

// Register built-in block features
// These replace the hardcoded checks in BaseNode.svelte

registerBlockFeatures('Scope', [
	{
		type: 'plot-preview',
		config: {
			plotType: 'time-series',
			dataSource: 'scope'
		}
	} satisfies PlotPreviewFeature
]);

registerBlockFeatures('Spectrum', [
	{
		type: 'plot-preview',
		config: {
			plotType: 'spectrum',
			dataSource: 'spectrum'
		}
	} satisfies PlotPreviewFeature
]);
