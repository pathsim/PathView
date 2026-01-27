<script lang="ts">
	import { onMount } from 'svelte';
	import { useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
	import { graphStore } from '$lib/stores/graph';
	import { eventStore } from '$lib/stores/events';
	import { historyStore } from '$lib/stores/history';
	import { eventRegistry } from '$lib/events/registry';
	import type { EventInstance } from '$lib/events/types';
	import { fitViewTrigger, fitViewPadding, type FitViewPadding, zoomInTrigger, zoomOutTrigger, panTrigger, focusNodeTrigger, registerScreenToFlowConverter } from '$lib/stores/viewActions';
	import { get } from 'svelte/store';
	import { dropTargetBridge } from '$lib/stores/dropTargetBridge';
	import { assemblyAnimationTrigger, runAssemblyAnimation } from '$lib/animation/assemblyAnimation';
	import { importFile } from '$lib/schema/fileOps';
	import { ALL_COMPONENT_EXTENSIONS } from '$lib/types/component';

	interface Props {
		pendingUpdates: string[];
		onUpdatesProcessed: () => void;
		edges?: { id: string }[];
	}

	let { pendingUpdates, onUpdatesProcessed, edges = [] }: Props = $props();

	const { getNodes, getEdges, fitView, zoomIn, zoomOut, getViewport, setViewport, screenToFlowPosition } = useSvelteFlow();
	const updateNodeInternals = useUpdateNodeInternals();

	// Custom fit view that accounts for asymmetric panel padding
	function fitViewWithPadding(padding: FitViewPadding, duration: number = 300) {
		const nodes = getNodes();
		if (nodes.length === 0) {
			return;
		}

		// Calculate bounding box of all nodes, accounting for origin
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const node of nodes) {
			const width = node.measured?.width ?? node.width ?? 160;
			const height = node.measured?.height ?? node.height ?? 60;
			// Account for node origin (default center [0.5, 0.5], annotations use [0, 0])
			const origin = (node.origin as [number, number]) ?? [0.5, 0.5];
			const left = node.position.x - width * origin[0];
			const top = node.position.y - height * origin[1];
			minX = Math.min(minX, left);
			minY = Math.min(minY, top);
			maxX = Math.max(maxX, left + width);
			maxY = Math.max(maxY, top + height);
		}

		// Add some padding around the nodes themselves
		const nodePadding = 20;
		minX -= nodePadding;
		minY -= nodePadding;
		maxX += nodePadding;
		maxY += nodePadding;

		const nodesWidth = maxX - minX;
		const nodesHeight = maxY - minY;

		// Calculate available viewport area after panel padding
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const availableWidth = viewportWidth - padding.left - padding.right;
		const availableHeight = viewportHeight - padding.top - padding.bottom;

		if (availableWidth <= 0 || availableHeight <= 0) {
			// Fallback to standard fitView if no space
			fitView({ padding: 0.1, duration });
			return;
		}

		// Calculate zoom to fit nodes in available area
		const zoomX = availableWidth / nodesWidth;
		const zoomY = availableHeight / nodesHeight;
		const zoom = Math.min(zoomX, zoomY, 1.5); // Cap at 1.5x zoom

		// Calculate center of nodes in flow coordinates
		const nodesCenterX = (minX + maxX) / 2;
		const nodesCenterY = (minY + maxY) / 2;

		// Calculate center of available viewport area in screen coordinates
		const availableCenterX = padding.left + availableWidth / 2;
		const availableCenterY = padding.top + availableHeight / 2;

		// Calculate viewport position to center nodes in available area
		const x = availableCenterX - nodesCenterX * zoom;
		const y = availableCenterY - nodesCenterY * zoom;

		setViewport({ x, y, zoom }, { duration });
	}

	// Fit view on initial load and register screen-to-flow converter
	onMount(() => {
		// Wait for nodes to be rendered then fit view
		setTimeout(() => {
			const padding = get(fitViewPadding);
			fitViewWithPadding(padding, 300);
		}, 200);

		// Register screen-to-flow coordinate converter for use outside SvelteFlow context
		registerScreenToFlowConverter(screenToFlowPosition);

		// Register drop handler that has access to screenToFlowPosition
		dropTargetBridge.registerDropHandler(async (event: DragEvent) => {
			const position = screenToFlowPosition({
				x: event.clientX,
				y: event.clientY
			});

			// Check for file drop (import any supported file type)
			const files = event.dataTransfer?.files;
			if (files && files.length > 0) {
				const file = files[0];
				const extension = '.' + file.name.split('.').pop()?.toLowerCase();

				if (ALL_COMPONENT_EXTENSIONS.includes(extension)) {
					const result = await importFile(file, {
						position: {
							x: position.x - 80,
							y: position.y - 30
						},
						fileName: file.name
					});

					if (!result.success && !result.cancelled && result.error) {
						alert(`Failed to import: ${result.error}`);
					}
					return;
				}
			}

			// Check for node drop
			const nodeType = event.dataTransfer?.getData('application/pathview-node');
			if (nodeType) {
				// addNode uses current navigation context automatically
				historyStore.mutate(() => {
					graphStore.addNode(nodeType, {
						x: position.x - 80,
						y: position.y - 30
					});
				});
				return;
			}

			// Check for event drop (works at any level)
			const eventType = event.dataTransfer?.getData('application/pathview-event');
			if (eventType) {
				const eventPos = {
					x: position.x - 40,
					y: position.y - 40
				};

				historyStore.mutate(() => {
					if (graphStore.isAtRoot()) {
						// Root level: use eventStore
						eventStore.addEvent(eventType, eventPos);
					} else {
						// Subsystem level: use graphStore
						const typeDef = eventRegistry.get(eventType);
						if (typeDef) {
							const newEvent: EventInstance = {
								id: crypto.randomUUID(),
								type: eventType,
								name: typeDef.name,
								position: eventPos,
								params: {}
							};
							graphStore.addSubsystemEvent(newEvent);
						}
					}
				});
				return;
			}
		});
	});

	// Listen for fit view triggers from keyboard shortcuts
	let lastFitViewTrigger = 0;
	fitViewTrigger.subscribe((value) => {
		if (value > lastFitViewTrigger) {
			const padding = get(fitViewPadding);
			fitViewWithPadding(padding, 300);
			lastFitViewTrigger = value;
		}
	});

	// Listen for zoom triggers
	let lastZoomInTrigger = 0;
	zoomInTrigger.subscribe((value) => {
		if (value > lastZoomInTrigger) {
			zoomIn({ duration: 200 });
			lastZoomInTrigger = value;
		}
	});

	let lastZoomOutTrigger = 0;
	zoomOutTrigger.subscribe((value) => {
		if (value > lastZoomOutTrigger) {
			zoomOut({ duration: 200 });
			lastZoomOutTrigger = value;
		}
	});

	// Listen for pan triggers (no duration for instant keyboard response)
	let lastPanId = 0;
	panTrigger.subscribe((value) => {
		if (value.id > lastPanId) {
			const viewport = getViewport();
			setViewport({
				x: viewport.x + value.x,
				y: viewport.y + value.y,
				zoom: viewport.zoom
			});
			lastPanId = value.id;
		}
	});

	// Listen for focus node triggers
	let lastFocusNodeId = 0;
	focusNodeTrigger.subscribe((value) => {
		if (value.id > lastFocusNodeId && value.nodeId) {
			// Use fitView to center on the specific node
			fitView({
				nodes: [{ id: value.nodeId }],
				padding: 0.5,
				duration: 300,
				maxZoom: 1.5
			});
			lastFocusNodeId = value.id;
		}
	});

	// Process pending node internal updates
	$effect(() => {
		if (pendingUpdates.length > 0) {
			// Use setTimeout to ensure DOM has updated
			setTimeout(() => {
				pendingUpdates.forEach((id) => {
					if (typeof updateNodeInternals === 'function') {
						updateNodeInternals(id);
					}
				});
				onUpdatesProcessed();
			}, 10);
		}
	});

	// Sync positions from SvelteFlow to graph store periodically
	// This ensures positions are saved even without explicit drag stop
	$effect(() => {
		const interval = setInterval(() => {
			const flowNodes = getNodes();
			flowNodes.forEach((node) => {
				if (node.position) {
					const graphNode = graphStore.getNode(node.id);
					if (graphNode) {
						const posChanged =
							Math.abs(graphNode.position.x - node.position.x) > 1 ||
							Math.abs(graphNode.position.y - node.position.y) > 1;
						if (posChanged) {
							graphStore.updateNodePosition(node.id, node.position);
						}
					}
				}
			});
		}, 2000); // Sync every 2 seconds

		return () => clearInterval(interval);
	});

	// Listen for assembly animation trigger (when graph is loaded)
	let lastAnimationTrigger = 0;
	assemblyAnimationTrigger.subscribe((value) => {
		if (value > lastAnimationTrigger) {
			lastAnimationTrigger = value;

			const padding = get(fitViewPadding);
			runAssemblyAnimation(
				// Getter functions - called after delay when nodes are loaded
				() => getNodes().map(n => ({ id: n.id, x: n.position.x, y: n.position.y })),
				() => getEdges().map(e => ({ id: e.id, source: e.source, target: e.target })),
				() => fitViewWithPadding(padding, 0),
				() => {
					const vp = getViewport();
					const canvas = document.querySelector('.svelte-flow') as HTMLElement;
					return {
						zoom: vp.zoom,
						x: vp.x,
						y: vp.y,
						width: canvas?.clientWidth ?? window.innerWidth,
						height: canvas?.clientHeight ?? window.innerHeight
					};
				}
			);
		}
	});
</script>
