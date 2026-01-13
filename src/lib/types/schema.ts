/**
 * Schema type definitions for file I/O
 */

import type { NodeInstance, Connection, Annotation } from './nodes';
import type { EventInstance } from './events';
import type { SimulationSettings } from './simulation';

/** File metadata */
export interface FileMetadata {
	created: string;
	modified: string;
	name: string;
	description?: string;
}

/** Shared graph content structure (used by GraphFile and ModelContent) */
export interface GraphContent {
	graph: {
		nodes: NodeInstance[];
		connections: Connection[];
		annotations?: Annotation[];
	};
	events?: EventInstance[];
	codeContext: {
		code: string;
	};
	simulationSettings: SimulationSettings;
}

/** Graph file format */
export interface GraphFile extends GraphContent {
	version: string;
	metadata: FileMetadata;
}

/** Current graph file version */
export const GRAPH_FILE_VERSION = '1.0.0';
