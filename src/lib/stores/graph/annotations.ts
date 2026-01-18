/**
 * Graph store - Annotation operations
 */

import { get } from 'svelte/store';
import type { Annotation } from '$lib/nodes/types';
import type { Position } from '$lib/types';
import {
	selectedNodeIds,
	generateId,
	getCurrentGraph,
	updateCurrentAnnotations
} from './state';

// Font size constants for annotations
export const ANNOTATION_FONT_SIZE = {
	DEFAULT: 11,
	MIN: 8,
	MAX: 24,
	STEP: 1
} as const;

/**
 * Add an annotation to the current graph context
 */
export function addAnnotation(position: Position): string {
	const id = generateId();
	const annotation: Annotation = {
		id,
		position,
		content: '',
		width: 200,
		height: 100,
		fontSize: ANNOTATION_FONT_SIZE.DEFAULT
	};

	updateCurrentAnnotations(
		// Map updater (root)
		a => {
			const newMap = new Map(a);
			newMap.set(id, annotation);
			return newMap;
		},
		// Array updater (subsystem)
		a => [...a, annotation]
	);

	return id;
}

/**
 * Update an annotation's content, size, or position
 * Note: Position updates during drag are blocked by historyStore.isDragging
 */
export function updateAnnotation(id: string, updates: Partial<Annotation>): void {
	updateCurrentAnnotations(
		// Map updater (root)
		a => {
			const annotation = a.get(id);
			if (annotation) {
				const newMap = new Map(a);
				newMap.set(id, { ...annotation, ...updates });
				return newMap;
			}
			return a;
		},
		// Array updater (subsystem)
		a => a.map(ann => ann.id === id ? { ...ann, ...updates } : ann)
	);
}

/**
 * Update an annotation's position
 */
export function updateAnnotationPosition(id: string, position: Position): void {
	updateAnnotation(id, { position });
}

/**
 * Remove an annotation
 */
export function removeAnnotation(id: string): void {
	updateCurrentAnnotations(
		// Map updater (root)
		a => {
			const newMap = new Map(a);
			newMap.delete(id);
			return newMap;
		},
		// Array updater (subsystem)
		a => a.filter(ann => ann.id !== id)
	);
}

/**
 * Get an annotation by ID
 */
export function getAnnotation(id: string): Annotation | undefined {
	return getCurrentGraph().annotations.get(id);
}

/**
 * Nudge selected annotations by a delta
 */
export function nudgeSelectedAnnotations(delta: Position): void {
	const selected = get(selectedNodeIds);
	if (selected.size === 0) return;

	const nudgePosition = (annotation: Annotation) => ({
		...annotation,
		position: {
			x: annotation.position.x + delta.x,
			y: annotation.position.y + delta.y
		}
	});

	updateCurrentAnnotations(
		// Map updater (root)
		a => {
			const newMap = new Map(a);
			selected.forEach(id => {
				const annotation = newMap.get(id);
				if (annotation) {
					newMap.set(id, nudgePosition(annotation));
				}
			});
			return newMap;
		},
		// Array updater (subsystem)
		a => a.map(ann => selected.has(ann.id) ? nudgePosition(ann) : ann)
	);
}
