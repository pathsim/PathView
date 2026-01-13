/**
 * Shape Registry
 * Data-driven shape definitions for nodes
 */

import type { NodeCategory } from '$lib/types';

/** Shape definition */
export interface ShapeDefinition {
	id: string;
	name: string;
	cssClass: string;
	borderRadius: string;
}

/** Shape registry - maps shape IDs to definitions */
const shapes = new Map<string, ShapeDefinition>();

/** Register a shape */
export function registerShape(shape: ShapeDefinition): void {
	shapes.set(shape.id, shape);
}

/** Get a shape by ID */
export function getShape(id: string): ShapeDefinition | undefined {
	return shapes.get(id);
}

/** Get all registered shapes */
export function getAllShapes(): ShapeDefinition[] {
	return Array.from(shapes.values());
}

// Register built-in shapes
registerShape({
	id: 'pill',
	name: 'Pill',
	cssClass: 'shape-pill',
	borderRadius: '20px'
});

registerShape({
	id: 'rect',
	name: 'Rectangle',
	cssClass: 'shape-rect',
	borderRadius: '4px'
});

registerShape({
	id: 'circle',
	name: 'Circle',
	cssClass: 'shape-circle',
	borderRadius: '16px'
});

registerShape({
	id: 'diamond',
	name: 'Diamond',
	cssClass: 'shape-diamond',
	borderRadius: '4px'
});

registerShape({
	id: 'mixed',
	name: 'Mixed',
	cssClass: 'shape-mixed',
	borderRadius: '12px 4px 12px 4px'
});

registerShape({
	id: 'default',
	name: 'Default',
	cssClass: 'shape-default',
	borderRadius: '8px'
});

/** Category to shape mapping */
const categoryShapeMap: Record<string, string> = {
	Sources: 'pill',
	Dynamic: 'rect',
	Algebraic: 'rect',
	Mixed: 'mixed',
	Recording: 'pill',
	Subsystem: 'rect'
};

/** Get shape ID for a category */
export function getShapeForCategory(category: NodeCategory | string): string {
	return categoryShapeMap[category] || 'default';
}

/** Update category to shape mapping */
export function setCategoryShape(category: string, shapeId: string): void {
	categoryShapeMap[category] = shapeId;
}

/** Get the category-shape mapping (for UI/debugging) */
export function getCategoryShapeMapping(): Record<string, string> {
	return { ...categoryShapeMap };
}
