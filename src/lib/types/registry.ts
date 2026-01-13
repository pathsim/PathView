/**
 * Registry-related type definitions
 * Types for block and event registries
 */

import type { NodeCategory } from './nodes';

/** Parameter extracted from PathSim block */
export interface ExtractedParam {
	type: string;
	default: string | null;
	description: string;
	min?: number;
	max?: number;
	options?: string[];
}

/** Block definition extracted from PathSim */
export interface ExtractedBlock {
	blockClass: string;
	description: string;
	docstringHtml: string;
	params: Record<string, ExtractedParam>;
	inputs: string[];
	outputs: string[];
}

/** UI overrides for block display */
export interface UIOverride {
	maxInputs?: number | null;
	maxOutputs?: number | null;
	defaultInputs?: string[];
	defaultOutputs?: string[];
	shape?: string;
}

/** Block category with ordering info */
export interface BlockCategory {
	name: NodeCategory;
	order: number;
	blocks: string[];
}

/** Event parameter extracted from PathSim */
export interface ExtractedEventParam {
	type: string;
	default: string | null;
	description: string;
	required?: boolean;
}

/** Event definition extracted from PathSim */
export interface ExtractedEvent {
	eventClass: string;
	description: string;
	docstringHtml: string;
	params: Record<string, ExtractedEventParam>;
}

/** Simulation parameter extracted from PathSim */
export interface ExtractedSimulationParam {
	type: string;
	default: string;
	description: string;
	min?: number;
	max?: number;
	options?: string[];
}
