/**
 * Node shapes module
 *
 * Provides shape definitions and utilities for node rendering.
 */

export {
	type ShapeDefinition,
	registerShape,
	getShape,
	getAllShapes,
	getShapeForCategory,
	setCategoryShape,
	getCategoryShapeMapping
} from './registry';

export { getShapeCssClass, isSubsystem, isInterface } from './utils';
