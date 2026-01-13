/**
 * History store for undo/redo functionality
 *
 * Uses centralized mutation wrapper with state snapshots.
 * All mutations should go through mutate() or mutateAsync().
 * Drag operations use beginDrag/endDrag for coalescing.
 */

import { writable, get } from 'svelte/store';
import type { NodeInstance, Connection, Annotation } from '$lib/nodes/types';
import type { EventInstance } from '$lib/events/types';
import { graphStore } from './graph';
import { eventStore } from './events';

/**
 * Complete state snapshot for undo/redo
 */
interface HistoryState {
	graph: {
		nodes: NodeInstance[];
		connections: Connection[];
		annotations: Annotation[];
	};
	events: EventInstance[];
}

/**
 * Internal history state
 */
interface HistoryStore {
	undoStack: HistoryState[];
	redoStack: HistoryState[];
	canUndo: boolean;
	canRedo: boolean;
}

const MAX_HISTORY = 50;

// Internal state
let undoStack: HistoryState[] = [];
let redoStack: HistoryState[] = [];
let isDragging = false;
let dragStartState: HistoryState | null = null;
let isRestoring = false;

// Mutation tracking - for nested mutate() coalescing
let mutationDepth = 0;
let pendingSnapshot: HistoryState | null = null;

// Reactive store for UI binding
const store = writable<HistoryStore>({
	undoStack: [],
	redoStack: [],
	canUndo: false,
	canRedo: false
});

/**
 * Update the reactive store
 */
function updateStore(): void {
	store.set({
		undoStack,
		redoStack,
		canUndo: undoStack.length > 0,
		canRedo: redoStack.length > 0
	});
}

/**
 * Capture current state from all stores
 */
function captureState(): HistoryState {
	return {
		graph: graphStore.toJSON(),
		events: eventStore.toJSON()
	};
}

/**
 * Commit a snapshot to the undo stack
 */
function commitSnapshot(snapshot: HistoryState): void {
	undoStack.push(snapshot);

	// Enforce history limit
	if (undoStack.length > MAX_HISTORY) {
		undoStack.shift();
	}

	// Clear redo stack on new action
	redoStack = [];

	updateStore();
}

/**
 * Restore state to all stores
 */
function restoreState(state: HistoryState): void {
	// Signal that we're restoring (so FlowCanvas uses store positions)
	isRestoring = true;

	try {
		graphStore.fromJSON(
			state.graph.nodes,
			state.graph.connections,
			state.graph.annotations
		);
		eventStore.fromJSON(state.events);
	} finally {
		// Clear restoring flag after a microtask to let effects run
		queueMicrotask(() => {
			isRestoring = false;
		});
	}
}

/**
 * Check if currently restoring state (used by FlowCanvas to know when to use store positions)
 */
function isRestoringState(): boolean {
	return isRestoring;
}

/**
 * Execute a mutation with automatic undo support
 * Captures state before the mutation and commits on success.
 * Nested calls are coalesced - only the outermost captures/commits.
 *
 * @param fn - The mutation function to execute
 * @returns The return value of fn
 */
function mutate<T>(fn: () => T): T {
	// Don't capture during drag (drag has its own handling)
	if (isDragging) {
		return fn();
	}

	const isOutermost = mutationDepth === 0;

	if (isOutermost) {
		pendingSnapshot = captureState();
	}
	mutationDepth++;

	try {
		const result = fn();

		// Commit on success (only outermost)
		if (isOutermost && pendingSnapshot) {
			commitSnapshot(pendingSnapshot);
		}

		return result;
	} catch (error) {
		// Don't commit on error - mutation failed
		throw error;
	} finally {
		mutationDepth--;
		if (mutationDepth === 0) {
			pendingSnapshot = null;
		}
	}
}

/**
 * Execute an async mutation with automatic undo support
 * Same as mutate() but for async functions.
 *
 * @param fn - The async mutation function to execute
 * @returns Promise resolving to the return value of fn
 */
async function mutateAsync<T>(fn: () => Promise<T>): Promise<T> {
	// Don't capture during drag (drag has its own handling)
	if (isDragging) {
		return fn();
	}

	const isOutermost = mutationDepth === 0;

	if (isOutermost) {
		pendingSnapshot = captureState();
	}
	mutationDepth++;

	try {
		const result = await fn();

		// Commit on success (only outermost)
		if (isOutermost && pendingSnapshot) {
			commitSnapshot(pendingSnapshot);
		}

		return result;
	} catch (error) {
		// Don't commit on error - mutation failed
		throw error;
	} finally {
		mutationDepth--;
		if (mutationDepth === 0) {
			pendingSnapshot = null;
		}
	}
}

/**
 * Check if currently inside a mutation
 * Useful for store functions to warn about untracked mutations in dev mode
 */
function isInMutation(): boolean {
	return mutationDepth > 0 || isDragging;
}

/**
 * Begin a drag operation
 * Captures state and blocks further snapshots until endDrag()
 */
function beginDrag(): void {
	if (isDragging) return;

	isDragging = true;
	dragStartState = captureState();
}

/**
 * End a drag operation
 * Pushes the captured drag start state to the undo stack
 */
function endDrag(): void {
	if (!isDragging) return;

	isDragging = false;

	if (dragStartState) {
		commitSnapshot(dragStartState);
		dragStartState = null;
	}
}

/**
 * Cancel a drag operation without creating an undo entry
 */
function cancelDrag(): void {
	isDragging = false;
	dragStartState = null;
}

/**
 * Undo the last action
 * @returns true if undo was performed, false if nothing to undo
 */
function undo(): boolean {
	// Don't allow undo during drag or mutation
	if (isDragging || mutationDepth > 0) return false;

	if (undoStack.length === 0) return false;

	// Capture current state for redo
	const currentState = captureState();

	// Pop and restore previous state
	const previousState = undoStack.pop()!;
	redoStack.push(currentState);

	restoreState(previousState);
	updateStore();

	return true;
}

/**
 * Redo the last undone action
 * @returns true if redo was performed, false if nothing to redo
 */
function redo(): boolean {
	// Don't allow redo during drag or mutation
	if (isDragging || mutationDepth > 0) return false;

	if (redoStack.length === 0) return false;

	// Capture current state for undo
	const currentState = captureState();

	// Pop and restore next state
	const nextState = redoStack.pop()!;
	undoStack.push(currentState);

	restoreState(nextState);
	updateStore();

	return true;
}

/**
 * Clear all history
 * Call this when loading a new file or creating a new graph
 */
function clear(): void {
	undoStack = [];
	redoStack = [];
	isDragging = false;
	dragStartState = null;
	mutationDepth = 0;
	pendingSnapshot = null;
	updateStore();
}

/**
 * Check if currently in a drag operation
 */
function isInDrag(): boolean {
	return isDragging;
}

export const historyStore = {
	subscribe: store.subscribe,
	mutate,
	mutateAsync,
	isInMutation,
	beginDrag,
	endDrag,
	cancelDrag,
	undo,
	redo,
	clear,
	isInDrag,
	isRestoringState
};
