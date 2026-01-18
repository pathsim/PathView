/**
 * Graph store - Main entry point
 *
 * Nested structure with path-based navigation.
 * Subsystems contain their own graph, Interface derives from parent.
 */

// Re-export types
export type { SearchableNode } from './state';

// Re-export constants
export { ANNOTATION_FONT_SIZE } from './annotations';

// Import stores for subscriptions
import {
	currentNodes,
	currentConnections,
	currentAnnotations,
	currentSubsystemEvents,
	selectedNodeIds,
	nodesArray,
	selectedNodes,
	currentPath,
	breadcrumbs
} from './state';

// Import all operations
import * as navigation from './navigation';
import * as nodes from './nodes';
import * as connections from './connections';
import * as ports from './ports';
import * as annotations from './annotations';
import * as subsystemEvents from './subsystemEvents';
import * as selection from './selection';
import * as serialization from './serialization';

/**
 * Graph store - unified API
 */
export const graphStore = {
	// ==================== SUBSCRIPTIONS ====================
	nodes: { subscribe: currentNodes.subscribe },
	connections: { subscribe: currentConnections.subscribe },
	annotations: { subscribe: currentAnnotations.subscribe },
	subsystemEvents: { subscribe: currentSubsystemEvents.subscribe },
	selectedNodeIds: { subscribe: selectedNodeIds.subscribe },
	nodesArray: { subscribe: nodesArray.subscribe },
	selectedNodes: { subscribe: selectedNodes.subscribe },
	currentPath: { subscribe: currentPath.subscribe },
	breadcrumbs: { subscribe: breadcrumbs.subscribe },

	// ==================== NAVIGATION ====================
	drillDown: navigation.drillDown,
	drillUp: navigation.drillUp,
	navigateTo: navigation.navigateTo,
	navigateToPath: navigation.navigateToPath,
	isAtRoot: navigation.isAtRoot,
	getCurrentPath: navigation.getCurrentPath,

	// ==================== NODE OPERATIONS ====================
	addNode: nodes.addNode,
	removeNode: nodes.removeNode,
	updateNodePosition: nodes.updateNodePosition,
	updateNodeName: nodes.updateNodeName,
	updateNodeColor: nodes.updateNodeColor,
	updateNodeParams: nodes.updateNodeParams,
	updateNode: nodes.updateNode,
	getNode: nodes.getNode,
	getAllNodes: nodes.getAllNodes,
	duplicateSelected: nodes.duplicateSelected,
	nudgeSelectedNodes: nodes.nudgeSelectedNodes,
	pasteNodes: nodes.pasteNodes,

	// ==================== CONNECTION OPERATIONS ====================
	addConnection: connections.addConnection,
	removeConnection: connections.removeConnection,
	getAllConnections: connections.getAllConnections,

	// ==================== PORT OPERATIONS ====================
	addInputPort: ports.addInputPort,
	removeInputPort: ports.removeInputPort,
	addOutputPort: ports.addOutputPort,
	removeOutputPort: ports.removeOutputPort,

	// ==================== ANNOTATION OPERATIONS ====================
	addAnnotation: annotations.addAnnotation,
	updateAnnotation: annotations.updateAnnotation,
	updateAnnotationPosition: annotations.updateAnnotationPosition,
	removeAnnotation: annotations.removeAnnotation,
	getAnnotation: annotations.getAnnotation,

	// ==================== SUBSYSTEM EVENT OPERATIONS ====================
	addSubsystemEvent: subsystemEvents.addSubsystemEvent,
	removeSubsystemEvent: subsystemEvents.removeSubsystemEvent,
	updateSubsystemEventPosition: subsystemEvents.updateSubsystemEventPosition,
	updateSubsystemEventName: subsystemEvents.updateSubsystemEventName,
	updateSubsystemEventParams: subsystemEvents.updateSubsystemEventParams,
	updateSubsystemEventColor: subsystemEvents.updateSubsystemEventColor,
	getSubsystemEvent: subsystemEvents.getSubsystemEvent,
	getSubsystemEvents: subsystemEvents.getSubsystemEvents,

	// ==================== SELECTION ====================
	selectNode: selection.selectNode,
	deselectNode: selection.deselectNode,
	clearSelection: selection.clearSelection,
	hasSelection: selection.hasSelection,
	selectAll: selection.selectAll,

	// ==================== SERIALIZATION ====================
	clear: serialization.clear,
	toJSON: serialization.toJSON,
	fromJSON: serialization.fromJSON,
	getAllNodesWithPaths: serialization.getAllNodesWithPaths
};

// Export helper utilities (can be used independently)
export {
	generateId,
	createPorts,
	getSubsystemByPath,
	deriveInterfaceNode,
	collectAllNodes,
	collectAllConnections,
	isSubsystemNode,
	isInterfaceNode,
	findParentSubsystem,
	cloneNode,
	cloneNodeForPaste,
	resizePorts,
	regenerateGraphIds
} from './helpers';
