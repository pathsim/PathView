/**
 * Component file types for saving/loading individual blocks, subsystems, and models
 */

import type { NodeInstance } from './nodes';
import type { GraphContent } from './schema';

/** Component types that can be saved/loaded */
export type ComponentType = 'block' | 'subsystem' | 'model';

/** Unified component file format */
export interface ComponentFile {
	version: string;
	type: ComponentType;
	metadata: {
		name: string;
		created: string;
		modified: string;
		description?: string;
	};
	content: BlockContent | SubsystemContent | ModelContent;
}

/** Single block (no connections) */
export interface BlockContent {
	node: NodeInstance;
}

/** Subsystem (nested graph) */
export interface SubsystemContent {
	node: NodeInstance; // The subsystem node (includes .graph)
}

/** Full model - uses shared GraphContent structure */
export type ModelContent = GraphContent;

/** File extension mapping */
export const COMPONENT_EXTENSIONS: Record<ComponentType, string> = {
	block: '.blk',
	subsystem: '.sub',
	model: '.pvm'
};

/** MIME types for file dialogs */
export const COMPONENT_MIME_TYPES = {
	block: { 'application/json': ['.blk'] },
	subsystem: { 'application/json': ['.sub'] },
	model: { 'application/json': ['.pvm', '.json'] } // .json for legacy
};

/** All accepted component file extensions */
export const ALL_COMPONENT_EXTENSIONS = ['.blk', '.sub', '.pvm', '.json'];
