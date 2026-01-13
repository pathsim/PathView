/**
 * UI-related type definitions
 */

import type { Position } from './common';

/** Theme options */
export type Theme = 'light' | 'dark';

/** Log entry for console output */
export interface LogEntry {
	id: number;
	timestamp: Date;
	level: 'info' | 'warning' | 'error' | 'output';
	message: string;
}

/** Context menu target types */
export type ContextMenuTarget =
	| { type: 'node'; nodeId: string }
	| { type: 'event'; eventId: string }
	| { type: 'edge'; edgeId: string }
	| { type: 'canvas' }
	| { type: 'selection'; nodeIds: string[] }
	| { type: 'annotation'; annotationId: string };

/** Context menu state */
export interface ContextMenuState {
	open: boolean;
	position: Position;
	target: ContextMenuTarget | null;
}

/** Dialog state base interface */
export interface DialogState<T = unknown> {
	open: boolean;
	data: T | null;
}

/** Node dialog state */
export interface NodeDialogState {
	open: boolean;
	nodeId: string | null;
}

/** Event dialog state */
export interface EventDialogState {
	open: boolean;
	eventId: string | null;
}

/** Search result item */
export interface SearchableNode {
	id: string;
	name: string;
	type: string;
	path: string[];
}
