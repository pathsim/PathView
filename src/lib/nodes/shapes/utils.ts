/**
 * Shape utility functions
 * Uses the shape registry for data-driven shape handling
 */

import type { NodeTypeDefinition, NodeInstance } from '$lib/types';
import { NODE_TYPES } from '$lib/constants/nodeTypes';
import { getShape, getShapeForCategory } from './registry';

/**
 * Get CSS class for a node based on its type definition
 */
export function getShapeCssClass(typeDef: NodeTypeDefinition): string {
	// First check if type definition has explicit shape override
	if (typeDef.shape) {
		const shape = getShape(typeDef.shape);
		if (shape) {
			return shape.cssClass;
		}
	}

	// Fall back to category-based shape
	const shapeId = getShapeForCategory(typeDef.category);
	const shape = getShape(shapeId);
	return shape?.cssClass || 'shape-default';
}

/**
 * Check if a node type is a subsystem
 */
export function isSubsystem(node: NodeInstance | NodeTypeDefinition): boolean {
	const type = 'type' in node ? node.type : (node as NodeTypeDefinition).type;
	return type === NODE_TYPES.SUBSYSTEM;
}

/**
 * Check if a node type is an interface
 */
export function isInterface(node: NodeInstance | NodeTypeDefinition): boolean {
	const type = 'type' in node ? node.type : (node as NodeTypeDefinition).type;
	return type === NODE_TYPES.INTERFACE;
}
