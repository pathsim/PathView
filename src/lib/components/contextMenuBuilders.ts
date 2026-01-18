/**
 * Context menu item builders
 * Pure functions that build menu items for different targets
 */

import { get } from 'svelte/store';
import type { MenuItemType } from './ContextMenu.svelte';
import type { ContextMenuTarget } from '$lib/stores/contextMenu';
import { graphStore } from '$lib/stores/graph';
import { eventStore } from '$lib/stores/events';
import { clipboardStore } from '$lib/stores/clipboard';
import { codePreviewStore } from '$lib/stores/codePreview';
import { codeContextStore } from '$lib/stores/codeContext';
import { openNodeDialog } from '$lib/stores/nodeDialog';
import { openEventDialog } from '$lib/stores/eventDialog';
import { NODE_TYPES } from '$lib/constants/nodeTypes';
import { triggerFitView, screenToFlow } from '$lib/stores/viewActions';
import { generateBlockCode, generateSingleEventCode } from '$lib/pyodide/pathsimRunner';
import { generateBlockCodeHeader, generateEventCodeHeader } from '$lib/utils/codePreviewHeader';
import { exportComponent } from '$lib/schema/componentOps';
import { openImportDialog } from '$lib/schema/fileOps';
import { hasExportableData, exportRecordingData } from '$lib/utils/csvExport';
import { exportToSVG } from '$lib/export/svg';
import { downloadSvg } from '$lib/utils/download';

/** Divider menu item */
const DIVIDER: MenuItemType = { label: '', action: () => {}, divider: true };

/** Show block code in preview dialog */
function showBlockCode(nodeId: string): void {
	const node = graphStore.getNode(nodeId);
	if (!node) return;
	// Use getAllNodes() to include parent subsystems in the search
	const allNodes = graphStore.getAllNodes();
	const allConnections = graphStore.getAllConnections().map(c => c.connection);
	const codeContext = codeContextStore.getCode();
	const header = generateBlockCodeHeader(node, codeContext);
	const blockCode = generateBlockCode(node, allNodes, allConnections);
	codePreviewStore.open(header + blockCode, 'Block Python Code');
}

/** Show event code in preview dialog */
function showEventCode(eventId: string): void {
	const event = eventStore.getEvent(eventId);
	if (!event) return;
	const codeContext = codeContextStore.getCode();
	const header = generateEventCodeHeader(event, codeContext);
	const eventCode = generateSingleEventCode(event);
	codePreviewStore.open(header + eventCode, 'Event Python Code');
}

/**
 * Callbacks required for context menu actions
 */
export interface ContextMenuCallbacks {
	toggleNodeLibrary: () => void;
	toggleEventsPanel: () => void;
	deleteNodes: (nodeIds: string[]) => void;
}

/**
 * Build context menu items for a node
 */
function buildNodeMenu(nodeId: string): MenuItemType[] {
	const node = graphStore.getNode(nodeId);
	if (!node) return [];

	const isSubsystem = node.type === NODE_TYPES.SUBSYSTEM;
	const isInterface = node.type === NODE_TYPES.INTERFACE;

	// Interface blocks have limited options
	if (isInterface) {
		return [
			{
				label: 'Properties',
				icon: 'settings',
				shortcut: 'Dbl-click',
				action: () => openNodeDialog(nodeId)
			},
			{
				label: 'Exit Subsystem',
				icon: 'exit',
				action: () => graphStore.drillUp()
			},
			DIVIDER,
			{
				label: 'View Code',
				icon: 'braces',
				action: () => showBlockCode(nodeId)
			}
		];
	}

	// Subsystem blocks get "Enter" option
	if (isSubsystem) {
		return [
			{
				label: 'Properties',
				icon: 'settings',
				action: () => openNodeDialog(nodeId)
			},
			{
				label: 'Enter Subsystem',
				icon: 'enter',
				shortcut: 'Dbl-click',
				action: () => graphStore.drillDown(nodeId)
			},
			DIVIDER,
			{
				label: 'View Code',
				icon: 'braces',
				action: () => showBlockCode(nodeId)
			},
			{
				label: 'Export',
				icon: 'upload',
				action: () => exportComponent('subsystem', nodeId)
			},
			DIVIDER,
			{
				label: 'Duplicate',
				icon: 'copy',
				shortcut: 'Ctrl+D',
				action: () => {
					graphStore.selectNode(nodeId, false);
					graphStore.duplicateSelected();
				}
			},
			{
				label: 'Copy',
				icon: 'clipboard',
				shortcut: 'Ctrl+C',
				action: () => {
					graphStore.selectNode(nodeId, false);
					clipboardStore.copy();
				}
			},
			DIVIDER,
			{
				label: 'Delete',
				icon: 'trash',
				shortcut: 'Del',
				action: () => graphStore.removeNode(nodeId)
			}
		];
	}

	// Check if this is a recording node (Scope or Spectrum)
	const isRecordingNode = node.type === 'Scope' || node.type === 'Spectrum';
	const dataSource = node.type === 'Scope' ? 'scope' : 'spectrum';

	// Regular blocks
	const items: MenuItemType[] = [
		{
			label: 'Properties',
			icon: 'settings',
			shortcut: 'Dbl-click',
			action: () => openNodeDialog(nodeId)
		},
		DIVIDER,
		{
			label: 'View Code',
			icon: 'braces',
			action: () => showBlockCode(nodeId)
		}
	];

	// Add CSV export for recording nodes
	if (isRecordingNode) {
		const canExport = hasExportableData(nodeId, dataSource as 'scope' | 'spectrum');
		items.push({
			label: 'Export CSV',
			icon: 'table',
			action: () => exportRecordingData(nodeId, node.name, node.type),
			disabled: !canExport
		});
	}

	items.push(
		{
			label: 'Export',
			icon: 'upload',
			action: () => exportComponent('block', nodeId)
		},
		DIVIDER,
		{
			label: 'Duplicate',
			icon: 'copy',
			shortcut: 'Ctrl+D',
			action: () => {
				graphStore.selectNode(nodeId, false);
				graphStore.duplicateSelected();
			}
		},
		{
			label: 'Copy',
			icon: 'clipboard',
			shortcut: 'Ctrl+C',
			action: () => {
				graphStore.selectNode(nodeId, false);
				clipboardStore.copy();
			}
		},
		DIVIDER,
		{
			label: 'Delete',
			icon: 'trash',
			shortcut: 'Del',
			action: () => graphStore.removeNode(nodeId)
		}
	);

	return items;
}

/**
 * Build context menu items for a multi-selection
 */
function buildSelectionMenu(
	nodeIds: string[],
	deleteNodes: (ids: string[]) => void
): MenuItemType[] {
	const count = nodeIds.length;
	return [
		{
			label: `Duplicate ${count} nodes`,
			icon: 'copy',
			shortcut: 'Ctrl+D',
			action: () => graphStore.duplicateSelected()
		},
		{
			label: `Copy ${count} nodes`,
			icon: 'clipboard',
			shortcut: 'Ctrl+C',
			action: () => clipboardStore.copy()
		},
		DIVIDER,
		{
			label: `Delete ${count} nodes`,
			icon: 'trash',
			shortcut: 'Del',
			action: () => deleteNodes(nodeIds)
		}
	];
}

/**
 * Build context menu items for an event
 */
function buildEventMenu(eventId: string): MenuItemType[] {
	return [
		{
			label: 'Properties',
			icon: 'settings',
			shortcut: 'Dbl-click',
			action: () => openEventDialog(eventId)
		},
		DIVIDER,
		{
			label: 'View Code',
			icon: 'braces',
			action: () => showEventCode(eventId)
		},
		DIVIDER,
		{
			label: 'Duplicate',
			icon: 'copy',
			shortcut: 'Ctrl+D',
			action: () => {
				eventStore.selectEvent(eventId, false);
				eventStore.duplicateSelected();
			}
		},
		{
			label: 'Copy',
			icon: 'clipboard',
			shortcut: 'Ctrl+C',
			action: () => {
				eventStore.selectEvent(eventId, false);
				clipboardStore.copy();
			}
		},
		DIVIDER,
		{
			label: 'Delete',
			icon: 'trash',
			shortcut: 'Del',
			action: () => eventStore.removeEvent(eventId)
		}
	];
}

/**
 * Build context menu items for an edge (connection)
 */
function buildEdgeMenu(edgeId: string): MenuItemType[] {
	return [
		{
			label: 'Delete',
			icon: 'trash',
			shortcut: 'Del',
			action: () => graphStore.removeConnection(edgeId)
		}
	];
}

/**
 * Build context menu items for the canvas
 */
function buildCanvasMenu(
	screenPosition: { x: number; y: number },
	callbacks: Pick<ContextMenuCallbacks, 'toggleNodeLibrary' | 'toggleEventsPanel'>
): MenuItemType[] {
	const hasClipboardContent = clipboardStore.hasContent();
	const items: MenuItemType[] = [
		{
			label: 'Add Block',
			icon: 'grid',
			shortcut: 'B',
			action: () => callbacks.toggleNodeLibrary()
		},
		{
			label: 'Add Event',
			icon: 'zap',
			shortcut: 'N',
			action: () => callbacks.toggleEventsPanel()
		},
		{
			label: 'Add Annotation',
			icon: 'type',
			action: () => {
				const flowPos = screenToFlow(screenPosition);
				graphStore.addAnnotation(flowPos);
			}
		},
		DIVIDER,
		{
			label: 'Open/Import',
			icon: 'download',
			action: () => {
				const flowPos = screenToFlow(screenPosition);
				openImportDialog(flowPos);
			}
		},
		{
			label: 'Export SVG',
			icon: 'image',
			action: () => downloadSvg(exportToSVG(), 'pathview-graph.svg')
		}
	];

	// Add Paste option if clipboard has content
	if (hasClipboardContent) {
		items.push(
			DIVIDER,
			{
				label: 'Paste',
				icon: 'clipboard',
				shortcut: 'Ctrl+V',
				action: () => {
					const flowPos = screenToFlow(screenPosition);
					clipboardStore.paste(flowPos);
				}
			}
		);
	}

	items.push(
		DIVIDER,
		{
			label: 'Fit View',
			icon: 'maximize',
			shortcut: 'F',
			action: () => triggerFitView()
		}
	);

	return items;
}

/**
 * Build context menu items for an annotation
 */
function buildAnnotationMenu(annotationId: string): MenuItemType[] {
	return [
		{
			label: 'Delete',
			icon: 'trash',
			action: () => graphStore.removeAnnotation(annotationId)
		}
	];
}

/**
 * Build context menu items based on target
 */
export function buildContextMenuItems(
	target: ContextMenuTarget | null,
	screenPosition: { x: number; y: number },
	callbacks: ContextMenuCallbacks
): MenuItemType[] {
	if (!target) return [];

	switch (target.type) {
		case 'node':
			return buildNodeMenu(target.nodeId);
		case 'selection':
			return buildSelectionMenu([...target.nodeIds], callbacks.deleteNodes);
		case 'event':
			return buildEventMenu(target.eventId);
		case 'edge':
			return buildEdgeMenu(target.edgeId);
		case 'canvas':
			return buildCanvasMenu(screenPosition, callbacks);
		case 'annotation':
			return buildAnnotationMenu(target.annotationId);
		default:
			return [];
	}
}
