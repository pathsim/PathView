<script lang="ts">
	import { get } from 'svelte/store';
	import { onDestroy, untrack } from 'svelte';
	import {
		SvelteFlow,
		Background,
		BackgroundVariant,
		type Node,
		type Edge,
		type Connection as FlowConnection,
		type NodeTypes,
		type EdgeTypes
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import BaseNode from './nodes/BaseNode.svelte';
	import EventNode from './nodes/EventNode.svelte';
	import AnnotationNode from './nodes/AnnotationNode.svelte';
	import OrthogonalEdge from './edges/OrthogonalEdge.svelte';
	import FlowUpdater from './FlowUpdater.svelte';
	import { graphStore } from '$lib/stores/graph';
	import { eventStore, setEventSelection } from '$lib/stores/events';
	import { selectedNodeIds as graphSelectedNodeIds } from '$lib/stores/graph/state';
	import { historyStore } from '$lib/stores/history';
	import { routingStore, buildRoutingContext } from '$lib/stores/routing';
	import { themeStore, type Theme } from '$lib/stores/theme';
	import { clearSelectionTrigger, nudgeTrigger, selectNodeTrigger, registerHasSelection, triggerFitView } from '$lib/stores/viewActions';
	import { dropTargetBridge } from '$lib/stores/dropTargetBridge';
	import { contextMenuStore } from '$lib/stores/contextMenu';
	import { nodeUpdatesStore } from '$lib/stores/nodeUpdates';
		import { nodeRegistry } from '$lib/nodes';
	import { NODE_TYPES } from '$lib/constants/nodeTypes';
	import { SNAP_GRID, BACKGROUND_GAP } from '$lib/constants/grid';
	import { calculateNodeDimensions } from '$lib/constants/dimensions';
	import type { NodeInstance, Connection, Annotation } from '$lib/nodes/types';
	import type { EventInstance } from '$lib/events/types';

	// Canvas utilities
	import {
		toFlowEdge,
		toEventNode,
		toAnnotationNode,
		rotateSelectedNodes,
		flipSelectedNodesHorizontal,
		flipSelectedNodesVertical,
		findFirstAvailableInputPort
	} from './canvas';

	// Theme for SvelteFlow
	let colorMode = $state<Theme>('dark');
	const unsubscribeTheme = themeStore.subscribe((theme) => {
		colorMode = theme;
	});

	
	// Keyboard shortcuts for node manipulation
	function handleKeydown(event: KeyboardEvent) {
		// Ignore if typing in an input field or code editor
		const isInputFocused =
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement ||
			(event.target as HTMLElement)?.closest?.('.cm-editor');
		if (isInputFocused) return;

		// Handle Delete key (SvelteFlow's deleteKeyCode doesn't work reliably for 'Delete')
		if (event.key === 'Delete') {
			const selectedNodes = nodes.filter(n => n.selected);
			const selectedEdges = edges.filter(e => e.selected);
			if (selectedNodes.length > 0 || selectedEdges.length > 0) {
				event.preventDefault();
				handleDelete({ nodes: selectedNodes, edges: selectedEdges });
			}
			return;
		}

		const hasSelection = nodes.some((n) => n.selected);
		if (!hasSelection) return;

		let updatedNodes: string[] = [];

		if (event.key === 'r' || event.key === 'R') {
			event.preventDefault();
			updatedNodes = rotateSelectedNodes(nodes);
		} else if (event.key === 'x' || event.key === 'X') {
			event.preventDefault();
			updatedNodes = flipSelectedNodesHorizontal(nodes);
		} else if (event.key === 'y' || event.key === 'Y') {
			event.preventDefault();
			updatedNodes = flipSelectedNodesVertical(nodes);
		}

		if (updatedNodes.length > 0) {
			pendingNodeUpdates = [...updatedNodes];
		}
	}

	// Track port counts to detect changes - used to force node re-renders
	let portCounts = new Map<string, { inputs: number; outputs: number }>();

	// Track nodes that need internal updates (will be processed by FlowUpdater)
	let pendingNodeUpdates: string[] = $state([]);

	// Subscribe to external node updates (e.g., from context menu rotation)
	const unsubscribeNodeUpdates = nodeUpdatesStore.subscribe((updates) => {
		if (updates.length > 0) {
			pendingNodeUpdates = [...pendingNodeUpdates, ...updates];
			nodeUpdatesStore.clear();
		}
	});

	// Register hasSelection function so +page.svelte can check SvelteFlow's selection state
	registerHasSelection(() => nodes.some(n => n.selected));

	// Subscribe to clear selection trigger - clears selection in SvelteFlow's nodes and edges
	let lastClearSelectionTrigger = 0;
	const unsubscribeClearSelection = clearSelectionTrigger.subscribe((trigger) => {
		if (trigger > lastClearSelectionTrigger) {
			lastClearSelectionTrigger = trigger;
			// Clear selection on all nodes and edges
			nodes = nodes.map(n => ({ ...n, selected: false }));
			edges = edges.map(e => ({ ...e, selected: false }));
			// Also clear store selection state using direct setters
			graphSelectedNodeIds.set(new Set());
			setEventSelection(new Set());
		}
	});

	// Subscribe to nudge trigger - nudges all selected nodes and syncs to stores
	let lastNudgeTrigger = 0;
	const unsubscribeNudge = nudgeTrigger.subscribe((trigger) => {
		if (trigger.id > lastNudgeTrigger) {
			lastNudgeTrigger = trigger.id;
			const delta = { x: trigger.x, y: trigger.y };

			// Update positions in SvelteFlow's nodes array
			nodes = nodes.map(n => {
				if (n.selected) {
					return { ...n, position: { x: n.position.x + delta.x, y: n.position.y + delta.y } };
				}
				return n;
			});

			// Sync positions to appropriate stores
			nodes.forEach(n => {
				if (n.selected) {
					if (n.type === 'eventNode') {
						if (graphStore.isAtRoot()) {
							eventStore.updateEventPosition(n.id, n.position);
						} else {
							graphStore.updateSubsystemEventPosition(n.id, n.position);
						}
					} else if (n.type === 'annotation') {
						graphStore.updateAnnotationPosition(n.id, n.position);
					} else {
						graphStore.updateNodePosition(n.id, n.position);
					}
				}
			});
		}
	});

	// Subscribe to select node trigger - selects specific nodes in SvelteFlow
	let lastSelectNodeTrigger = 0;
	const unsubscribeSelectNode = selectNodeTrigger.subscribe((trigger) => {
		if (trigger.id > lastSelectNodeTrigger) {
			lastSelectNodeTrigger = trigger.id;
			const nodeIdsToSelect = new Set(trigger.nodeIds);

			// Update selection in SvelteFlow's nodes array
			nodes = nodes.map(n => {
				if (nodeIdsToSelect.has(n.id)) {
					return { ...n, selected: true };
				} else if (!trigger.addToSelection) {
					return { ...n, selected: false };
				}
				return n;
			});

			// Clear edge selection when selecting nodes
			if (!trigger.addToSelection) {
				edges = edges.map(e => ({ ...e, selected: false }));
			}

			// Sync to stores - note: we update stores directly here to avoid triggering again
			syncSelectionToStores();
		}
	});

	// Helper to sync SvelteFlow selection state to stores
	// Uses direct setters to avoid triggering the selection trigger (which would loop)
	function syncSelectionToStores() {
		const selectedNodes = nodes.filter(n => n.selected);

		// Build sets of selected IDs by type
		const selectedBlockIds = new Set<string>();
		const selectedEventIdSet = new Set<string>();

		selectedNodes.forEach((node) => {
			if (node.type === 'eventNode') {
				selectedEventIdSet.add(node.id);
			} else if (node.type !== 'annotation') {
				selectedBlockIds.add(node.id);
			}
		});

		// Update stores directly (bypasses trigger-based functions)
		graphSelectedNodeIds.set(selectedBlockIds);
		setEventSelection(selectedEventIdSet);
	}

	// Cleanup function - will add subscriptions as they're defined
	const cleanups: (() => void)[] = [unsubscribeTheme, unsubscribeNodeUpdates, unsubscribeClearSelection, unsubscribeNudge, unsubscribeSelectNode];
	onDestroy(() => cleanups.forEach(fn => fn()));

	function clearPendingUpdates() {
		pendingNodeUpdates = [];
	}

	// Helper to get port position in world coordinates
	function getPortPosition(nodeId: string, portIndex: number, isOutput: boolean): { x: number; y: number } | null {
		const node = nodes.find(n => n.id === nodeId);
		if (!node) return null;

		const nodeData = node.data as NodeInstance;
		const ports = isOutput ? nodeData.outputs : nodeData.inputs;
		if (portIndex >= ports.length) return null;

		const rotation = (nodeData.params?.['_rotation'] as number) || 0;
		const width = node.measured?.width ?? node.width ?? 80;
		const height = node.measured?.height ?? node.height ?? 40;

		// Calculate port offset from center based on rotation
		const portCount = ports.length;
		const portSpacing = 20; // G.x2
		const span = (portCount - 1) * portSpacing;
		const offsetFromCenter = -span / 2 + portIndex * portSpacing;

		let x = node.position.x;
		let y = node.position.y;

		// Position based on rotation (output = right side for rotation 0)
		if (isOutput) {
			switch (rotation) {
				case 1: // outputs at bottom
					x += offsetFromCenter;
					y += height / 2;
					break;
				case 2: // outputs at left
					x -= width / 2;
					y += offsetFromCenter;
					break;
				case 3: // outputs at top
					x += offsetFromCenter;
					y -= height / 2;
					break;
				default: // rotation 0 - outputs at right
					x += width / 2;
					y += offsetFromCenter;
					break;
			}
		} else {
			// Inputs are opposite to outputs
			switch (rotation) {
				case 1: // inputs at top
					x += offsetFromCenter;
					y -= height / 2;
					break;
				case 2: // inputs at right
					x += width / 2;
					y += offsetFromCenter;
					break;
				case 3: // inputs at bottom
					x += offsetFromCenter;
					y += height / 2;
					break;
				default: // rotation 0 - inputs at left
					x -= width / 2;
					y += offsetFromCenter;
					break;
			}
		}

		return { x, y };
	}

	// Update routing context and recalculate all routes
	function updateRoutingContext() {
		// Only include block nodes (not events or annotations) for routing
		const blockNodesForRouting = nodes.filter(n => n.type === 'pathview');
		if (blockNodesForRouting.length === 0) {
			routingStore.clearRoutes();
			return;
		}

		const { nodeBounds, canvasBounds } = buildRoutingContext(blockNodesForRouting);
		routingStore.setContext(nodeBounds, canvasBounds);

		// Recalculate all routes
		const connections = get(graphStore.connections);
		routingStore.recalculateAllRoutes(connections, getPortPosition);
	}

	// Custom node types - will add more for different shapes
	const nodeTypes: NodeTypes = {
		pathview: BaseNode,
		eventNode: EventNode,
		annotation: AnnotationNode
	};

	// Custom edge types - orthogonal routing with arrow
	const edgeTypes: EdgeTypes = {
		orthogonal: OrthogonalEdge
	};

	// SvelteFlow state - this is the source of truth for visual state
	// Block nodes from graphStore
	let blockNodes = $state<Node[]>([]);
	// Event nodes from eventStore
	let eventNodes = $state<Node[]>([]);
	// Annotation nodes from graphStore
	let annotationNodes = $state<Node[]>([]);
	// Combined nodes for SvelteFlow
	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);

	// Merge block, event, and annotation nodes when any changes
	// Preserve position and selection from SvelteFlow's current state (except during undo/redo)
	$effect(() => {
		const currentNodes = untrack(() => new Map(nodes.map(n => [n.id, n])));
		const restoring = historyStore.isRestoringState();

		nodes = [...blockNodes, ...eventNodes, ...annotationNodes].map(n => {
			const existing = currentNodes.get(n.id);
			if (existing && !restoring) {
				// Preserve SvelteFlow-managed state (position during drag, selection)
				return { ...n, position: existing.position, selected: existing.selected };
			}
			return n;
		});
	});

	// Track if we're currently syncing to prevent loops
	let isSyncing = false;

	// Track if initial load is complete (positions from graph store should be used until first render)
	let initialLoadComplete = false;

	// Track previous node IDs to detect deletions via binding
	let prevNodeIds = new Set<string>();

	// Watch for node deletions (SvelteFlow updates nodes via binding, not always via callback)
	// Only delete nodes that are truly gone - not just filtered out by subsystem navigation
	$effect(() => {
		const currentNodeIds = new Set(nodes.map(n => n.id));

		// Find nodes that disappeared from view
		const disappearedIds = [...prevNodeIds].filter(id => !currentNodeIds.has(id));

		if (disappearedIds.length > 0 && !isSyncing) {
			isSyncing = true;
			// Only remove if the node is truly deleted (not in full store)
			// Nodes that are just filtered out by navigation should NOT be removed
			disappearedIds.forEach(id => {
				const stillInGraphStore = graphStore.getNode(id);
				const stillInEventStore = eventStore.getEvent(id);
				if (!stillInGraphStore && !stillInEventStore) {
					// Node was actually deleted by SvelteFlow, clean up
					portCounts.delete(id);
				}
			});
			isSyncing = false;
		}

		// Update previous node IDs
		prevNodeIds = currentNodeIds;
	});

	// Sync annotation dimensions when NodeResizer updates them
	$effect(() => {
		if (isSyncing) return;
		nodes.forEach(node => {
			if (node.type === 'annotation' && node.width && node.height) {
				const annotation = graphStore.getAnnotation(node.id);
				if (annotation && (annotation.width !== node.width || annotation.height !== node.height)) {
					isSyncing = true;
					graphStore.updateAnnotation(node.id, {
						width: node.width,
						height: node.height
					});
					isSyncing = false;
				}
			}
		});
	});

	// Subscribe to current nodes (filtered by current navigation context)
	cleanups.push(graphStore.nodes.subscribe((graphNodesMap: Map<string, NodeInstance>) => {
		if (isSyncing) return;

		// Convert Map to array for processing
		const filteredGraphNodes = Array.from(graphNodesMap.values());

		// Track nodes that need handle updates (port count changed)
		const nodesToUpdate: string[] = [];

		// Create a map of current nodes for quick lookup
		const currentNodesMap = new Map(nodes.map(n => [n.id, n]));

		// Find nodes to add, update, or remove
		const newNodeIds = new Set(filteredGraphNodes.map(n => n.id));
		const currentNodeIds = new Set(nodes.map(n => n.id));

		// Check if there are actual changes
		const hasAdditions = filteredGraphNodes.some(gn => !currentNodeIds.has(gn.id));
		const hasRemovals = nodes.some(n => !newNodeIds.has(n.id));
		const hasDataChanges = filteredGraphNodes.some(gn => {
			const current = currentNodesMap.get(gn.id);
			if (!current) return false;
			const currentData = current.data as NodeInstance;
			// Check if data actually changed (params, ports, name, color, pinnedParams)
			const prevCounts = portCounts.get(gn.id);
			const newCounts = { inputs: gn.inputs.length, outputs: gn.outputs.length };
			if (prevCounts && (prevCounts.inputs !== newCounts.inputs || prevCounts.outputs !== newCounts.outputs)) {
				return true;
			}
			if (currentData.name !== gn.name) return true;
			if (currentData.color !== gn.color) return true;
			if (JSON.stringify(currentData.params) !== JSON.stringify(gn.params)) return true;
			if (JSON.stringify(currentData.pinnedParams) !== JSON.stringify(gn.pinnedParams)) return true;
			return false;
		});

		// Only rebuild if there are actual changes
		if (!hasAdditions && !hasRemovals && !hasDataChanges && initialLoadComplete) {
			return;
		}

		// Build updated nodes array, preserving existing node objects where possible
		const updatedNodes = filteredGraphNodes.map((graphNode) => {
			const existingNode = currentNodesMap.get(graphNode.id);

			// Check if port counts changed
			const prevCounts = portCounts.get(graphNode.id);
			const newCounts = { inputs: graphNode.inputs.length, outputs: graphNode.outputs.length };

			if (prevCounts && (prevCounts.inputs !== newCounts.inputs || prevCounts.outputs !== newCounts.outputs)) {
				nodesToUpdate.push(graphNode.id);
			}
			portCounts.set(graphNode.id, newCounts);

			// Check if rotation changed - need to update internals for handle positions
			if (existingNode) {
				const existingData = existingNode.data as NodeInstance;
				const oldRotation = existingData?.params?.['_rotation'] ?? 0;
				const newRotation = graphNode.params?.['_rotation'] ?? 0;
				if (oldRotation !== newRotation) {
					nodesToUpdate.push(graphNode.id);
				}
			}

			// Use store position when restoring (undo/redo), otherwise preserve existing position
			const position = (existingNode && !historyStore.isRestoringState())
				? existingNode.position
				: { ...graphNode.position };

			// Interface blocks are not deletable
			const isInterface = graphNode.type === NODE_TYPES.INTERFACE;

			// Calculate node dimensions for SvelteFlow bounds
			const typeDef = nodeRegistry.get(graphNode.type);
			const pinnedParamCount = typeDef && graphNode.pinnedParams
				? graphNode.pinnedParams.filter(name => typeDef.params.some(p => p.name === name)).length
				: 0;
			const rotation = (graphNode.params?.['_rotation'] as number) || 0;
			const { width, height } = calculateNodeDimensions(
				graphNode.name,
				graphNode.inputs.length,
				graphNode.outputs.length,
				pinnedParamCount,
				rotation,
				typeDef?.name
			);

			// If node exists, update data but don't preserve selection here
			// Selection is managed by SvelteFlow, trigger subscriptions, and merge effect
			if (existingNode) {
				return {
					id: existingNode.id,
					type: existingNode.type,
					position,
					data: graphNode,
					width,
					height,
					// Explicit center origin for correct bounds calculation
					origin: [0.5, 0.5] as [number, number],
					selectable: existingNode.selectable,
					draggable: existingNode.draggable,
					deletable: !isInterface
					// NOTE: selected is intentionally NOT preserved here to avoid stale selection
				} as Node<NodeInstance>;
			}

			// New node
			return {
				id: graphNode.id,
				type: 'pathview',
				position,
				data: graphNode,
				width,
				height,
				// Explicit center origin for correct bounds calculation
				origin: [0.5, 0.5] as [number, number],
				selectable: true,
				draggable: true,
				deletable: !isInterface
			} as Node<NodeInstance>;
		});

		// Clean up port counts for removed nodes
		for (const id of portCounts.keys()) {
			if (!newNodeIds.has(id)) {
				portCounts.delete(id);
			}
		}

		blockNodes = updatedNodes;

		// Queue node internal updates for nodes with changed ports
		if (nodesToUpdate.length > 0) {
			pendingNodeUpdates = [...nodesToUpdate];
		}

		// Mark initial load as complete after first non-empty sync
		if (filteredGraphNodes.length > 0 && !initialLoadComplete) {
			setTimeout(() => {
				initialLoadComplete = true;
			}, 100);
		}
	}));

	// Track current path and events
	let currentPath: string[] = [];
	let rootEvents: EventInstance[] = [];
	let subsystemEvents: EventInstance[] = [];

	// Update event nodes - show root events at root, subsystem events inside subsystems
	// Note: No isSyncing check here - this only updates eventNodes array,
	// doesn't write to stores, so no risk of infinite loops
	function updateEventNodes() {
		const events = currentPath.length === 0 ? rootEvents : subsystemEvents;
		eventNodes = events.map(toEventNode);
	}

	// Subscribe to path changes
	cleanups.push(graphStore.currentPath.subscribe((path) => {
		currentPath = path;
		updateEventNodes();
	}));

	// Subscribe to root-level events (eventStore)
	cleanups.push(eventStore.eventsArray.subscribe((events: EventInstance[]) => {
		rootEvents = events;
		updateEventNodes();
	}));

	// Subscribe to subsystem events (graphStore)
	cleanups.push(graphStore.subsystemEvents.subscribe((eventsMap: Map<string, EventInstance>) => {
		subsystemEvents = Array.from(eventsMap.values());
		updateEventNodes();
	}));

	// Subscribe to annotations (filtered by current navigation context)
	cleanups.push(graphStore.annotations.subscribe((annotationsMap: Map<string, Annotation>) => {
		annotationNodes = Array.from(annotationsMap.values()).map(toAnnotationNode);
	}));

	// Subscribe to current connections (filtered by current navigation context)
	cleanups.push(graphStore.connections.subscribe((connections: Connection[]) => {
		if (isSyncing) return;
		edges = connections.map(toFlowEdge);
		// Recalculate routes when connections change
		// Use setTimeout to ensure nodes are updated first
		setTimeout(() => updateRoutingContext(), 0);
	}));

	// Handle node drag start - capture state for undo
	function handleNodeDragStart() {
		historyStore.beginDrag();
	}

	// Handle node drag end - sync position back to store and finalize undo entry
	function handleNodeDragStop({ targetNode }: { targetNode: Node | null; nodes: Node[]; event: MouseEvent | TouchEvent }) {
		if (targetNode?.id && targetNode?.position) {
			isSyncing = true;
			// Check node type and update appropriate store
			if (targetNode.type === 'eventNode') {
				if (graphStore.isAtRoot()) {
					eventStore.updateEventPosition(targetNode.id, targetNode.position);
				} else {
					graphStore.updateSubsystemEventPosition(targetNode.id, targetNode.position);
				}
			} else if (targetNode.type === 'annotation') {
				graphStore.updateAnnotationPosition(targetNode.id, targetNode.position);
			} else {
				graphStore.updateNodePosition(targetNode.id, targetNode.position);
			}
			isSyncing = false;
		}
		historyStore.endDrag();

		// Update routing context and recalculate routes
		updateRoutingContext();
	}

	// Handle node and edge delete
	function handleDelete({ nodes: deletedNodes, edges: deletedEdges }: { nodes: Node[]; edges: Edge[] }) {
		if (deletedNodes.length === 0 && deletedEdges.length === 0) return;

		isSyncing = true;

		// Wrap in historyStore.mutate for undo/redo support
		historyStore.mutate(() => {
			// Handle deleted nodes - distinguish between blocks, events, and annotations
			// Only remove if the item actually exists in the store (guards against false deletions from navigation)
			deletedNodes.forEach((node) => {
				if (node.type === 'eventNode') {
					if (graphStore.isAtRoot()) {
						if (eventStore.getEvent(node.id)) {
							eventStore.removeEvent(node.id);
						}
					} else {
						if (graphStore.getSubsystemEvent(node.id)) {
							graphStore.removeSubsystemEvent(node.id);
						}
					}
				} else if (node.type === 'annotation') {
					if (graphStore.getAnnotation(node.id)) {
						graphStore.removeAnnotation(node.id);
					}
				} else {
					if (graphStore.getNode(node.id)) {
						graphStore.removeNode(node.id);
						portCounts.delete(node.id);
					}
				}
			});

			// Handle deleted edges
			deletedEdges.forEach((edge) => {
				const currentConnections = get(graphStore.connections);
				let conn = currentConnections.find((c) => c.id === edge.id);

				// If ID doesn't match, try to find by source/target handles
				if (!conn && edge.sourceHandle && edge.targetHandle) {
					const sourceMatch = edge.sourceHandle.match(/-output-(\d+)$/);
					const targetMatch = edge.targetHandle.match(/-input-(\d+)$/);
					if (sourceMatch && targetMatch) {
						const sourcePortIndex = parseInt(sourceMatch[1], 10);
						const targetPortIndex = parseInt(targetMatch[1], 10);
						conn = currentConnections.find(
							(c) =>
								c.sourceNodeId === edge.source &&
								c.sourcePortIndex === sourcePortIndex &&
								c.targetNodeId === edge.target &&
								c.targetPortIndex === targetPortIndex
						);
					}
				}

				if (conn) {
					graphStore.removeConnection(conn.id);
				}
			});
		});

		// Filter out deleted nodes from current node arrays
		const deletedIds = new Set(deletedNodes.map(n => n.id));
		blockNodes = blockNodes.filter(n => !deletedIds.has(n.id));
		eventNodes = eventNodes.filter(n => !deletedIds.has(n.id));
		annotationNodes = annotationNodes.filter(n => !deletedIds.has(n.id));

		// Force sync edges from store after deletion
		const afterConnections = get(graphStore.connections);
		edges = afterConnections.map(toFlowEdge);

		isSyncing = false;
	}

	// Handle new connections
	function handleConnect(connection: FlowConnection) {
		if (!connection.source || !connection.target) return;
		if (!connection.sourceHandle || !connection.targetHandle) return;

		const sourceMatch = connection.sourceHandle.match(/-output-(\d+)$/);
		const targetMatch = connection.targetHandle.match(/-input-(\d+)$/);

		if (sourceMatch && targetMatch) {
			const sourcePortIndex = parseInt(sourceMatch[1], 10);
			let targetPortIndex = parseInt(targetMatch[1], 10);

			// Check if the target port is already connected
			const currentConnections = get(graphStore.connections);
			const isPortOccupied = currentConnections.some(
				(c) => c.targetNodeId === connection.target && c.targetPortIndex === targetPortIndex
			);

			if (isPortOccupied) {
				// Find the first available port instead
				const availablePort = findFirstAvailableInputPort(connection.target);

				if (availablePort !== null) {
					// Use the first available port
					targetPortIndex = availablePort;
				} else {
					// No available port - check if we can create a new one
					const graphNodes = get(graphStore.nodesArray);
					const targetNode = graphNodes.find((n) => n.id === connection.target);
					if (!targetNode) return;

					const typeDef = nodeRegistry.get(targetNode.type);
					if (!typeDef || typeDef.ports.maxInputs !== null) {
						// Can't create new port, abort
						return;
					}

					// Create a new port and use it
					graphStore.addInputPort(connection.target);
					targetPortIndex = targetNode.inputs.length; // The new port index
				}
			}

			// addConnection uses current navigation context automatically
			graphStore.addConnection(
				connection.source,
				sourcePortIndex,
				connection.target,
				targetPortIndex
			);
		}
	}

	// Handle selection changes - sync from SvelteFlow to stores
	// Uses direct setters to avoid triggering back to SvelteFlow
	function handleSelectionChange({ nodes: selectedNodes }: { nodes: Node[]; edges: Edge[] }) {
		const selectedBlockIds = new Set<string>();
		const selectedEventIdSet = new Set<string>();

		selectedNodes?.forEach((node) => {
			if (node.type === 'eventNode') {
				selectedEventIdSet.add(node.id);
			} else {
				// Both regular nodes and annotations go into selectedBlockIds
				selectedBlockIds.add(node.id);
			}
		});

		// Update stores directly (bypasses trigger-based functions)
		graphSelectedNodeIds.set(selectedBlockIds);
		setEventSelection(selectedEventIdSet);
	}

	// Track file drag state for drop zone indicator
	let isFileDragOver = $state(false);
	let dragCounter = 0; // Counter to handle nested elements

	function hasFiles(event: DragEvent): boolean {
		return event.dataTransfer?.types.includes('Files') ?? false;
	}

	function handleDragEnter(event: DragEvent) {
		if (hasFiles(event)) {
			dragCounter++;
			isFileDragOver = true;
		}
	}

	function handleDragLeave(event: DragEvent) {
		if (hasFiles(event)) {
			dragCounter--;
			if (dragCounter === 0) {
				isFileDragOver = false;
			}
		}
	}

	// Handle drop from node library - delegates to registered handler inside SvelteFlow context
	function handleDrop(event: DragEvent) {
		event.preventDefault();
		// Reset file drag state
		dragCounter = 0;
		isFileDragOver = false;
		dropTargetBridge.handleDrop(event);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
	}

	// Reference to flow canvas for coordinate conversion
	let canvasEl: HTMLDivElement;

	// Context menu handlers - SvelteFlow passes { event, node/edge } objects
	function handleNodeContextMenu({ event, node }: { event: MouseEvent; node: Node }) {
		event.preventDefault();

		// Check if this is an event node
		if (node.type === 'eventNode') {
			contextMenuStore.openForEvent(node.id, { x: event.clientX, y: event.clientY });
			return;
		}

		// Check if this is an annotation
		if (node.type === 'annotation') {
			contextMenuStore.openForAnnotation(node.id, { x: event.clientX, y: event.clientY });
			return;
		}

		// Check if there are multiple selected nodes
		const selectedNodes = nodes.filter(n => n.selected);
		if (selectedNodes.length > 1 && selectedNodes.some(n => n.id === node.id)) {
			// Multiple selection - show selection context menu
			contextMenuStore.openForSelection(
				selectedNodes.map(n => n.id),
				{ x: event.clientX, y: event.clientY }
			);
		} else {
			// Single node context menu
			contextMenuStore.openForNode(node.id, { x: event.clientX, y: event.clientY });
		}
	}

	function handleEdgeContextMenu({ event, edge }: { event: MouseEvent; edge: Edge }) {
		event.preventDefault();
		contextMenuStore.openForEdge(edge.id, { x: event.clientX, y: event.clientY });
	}

	function handlePaneContextMenu({ event }: { event: MouseEvent }) {
		event.preventDefault();
		contextMenuStore.openForCanvas({ x: event.clientX, y: event.clientY });
	}

	function handleCanvasDoubleClick(event: MouseEvent) {
		// Only trigger fit view if clicking on the canvas background (not on nodes/edges)
		const target = event.target as HTMLElement;
		if (target.closest('.svelte-flow__pane')) {
			triggerFitView();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	bind:this={canvasEl}
	class="flow-canvas"
	role="application"
	aria-label="Flow canvas"
	ondragover={handleDragOver}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondblclick={handleCanvasDoubleClick}
>
	{#if isFileDragOver}
		<div class="drop-zone-overlay">
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
				<polyline points="7 10 12 15 17 10"/>
				<line x1="12" y1="15" x2="12" y2="3"/>
			</svg>
		</div>
	{/if}
	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		{edgeTypes}
		onconnect={handleConnect}
		onnodedragstart={handleNodeDragStart}
		onnodedragstop={handleNodeDragStop}
		ondelete={handleDelete}
		onselectionchange={handleSelectionChange}
		ondrop={(e: any) => handleDrop(e.event || e)}
		ondragover={(e: any) => handleDragOver(e.event || e)}
		onnodecontextmenu={handleNodeContextMenu}
		onedgecontextmenu={handleEdgeContextMenu}
		onpanecontextmenu={handlePaneContextMenu}
		nodeOrigin={[0.5, 0.5]}
		{...{ snapToGrid: true, snapGrid: SNAP_GRID } as any}
		deleteKeyCode={['Delete', 'Backspace']}
		selectionKeyCode={['Shift']}
		multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
		{colorMode}
		connectOnClick
		edgesReconnectable
		edgesFocusable
		edgesSelectable={false}
		zoomOnDoubleClick={false}
		proOptions={{ hideAttribution: true }}
	>
		<FlowUpdater pendingUpdates={pendingNodeUpdates} onUpdatesProcessed={clearPendingUpdates} />
		<Background variant={BackgroundVariant.Dots} gap={BACKGROUND_GAP} size={1} />
	</SvelteFlow>
</div>

<style>
	.flow-canvas {
		width: 100%;
		height: 100%;
		position: relative;
	}

	.drop-zone-overlay {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		color: var(--accent);
	}

	/* Modern dark theme */
	:global(.svelte-flow) {
		--xy-background-color: var(--surface);
		--xy-node-background-color: var(--surface-raised);
		--xy-node-border-radius: 12px;
		--xy-handle-background-color: var(--edge);
		--xy-edge-stroke: var(--edge);
		--xy-edge-stroke-selected: var(--accent);
		--xy-edge-stroke-width: 1;
		--xy-connectionline-stroke: var(--accent);
		--xy-connectionline-stroke-width: 1;
	}

	:global(.svelte-flow__background) {
		background: var(--surface);
	}

	:global(.svelte-flow__background pattern circle) {
		fill: var(--grid-dot);
	}

	/* Edge styling */
	:global(.svelte-flow__edge-path) {
		stroke: var(--edge);
		stroke-width: 1;
		transition: stroke 0.15s ease;
		cursor: pointer;
	}

	/* Invisible wider path for easier clicking */
	:global(.svelte-flow__edge-interaction) {
		stroke-width: 20;
		stroke: transparent;
		cursor: pointer;
	}

	:global(.svelte-flow__edge:hover .svelte-flow__edge-path) {
		stroke: var(--accent, #0070C0);
		stroke-width: 1;
	}

	:global(.svelte-flow__edge.selected .svelte-flow__edge-path) {
		stroke: var(--accent, #0070C0);
		stroke-width: 1.5;
	}

	/* Connection line */
	:global(.svelte-flow__connection-path) {
		stroke: var(--accent, #0070C0);
		stroke-width: 1;
		stroke-dasharray: 5 5;
		animation: dash 0.5s linear infinite;
	}

	@keyframes dash {
		to {
			stroke-dashoffset: -10;
		}
	}

	/* Selection box (drag-to-select rectangle) */
	:global(.svelte-flow__selection) {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		border: 1px solid var(--accent);
		border-radius: 4px;
	}

	/* Hide the bounding box around selected nodes (but keep drag-select rectangle) */
	:global(.svelte-flow__selection-wrapper .svelte-flow__selection) {
		background: transparent !important;
		border: none !important;
	}
</style>
