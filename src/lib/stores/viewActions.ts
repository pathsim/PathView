/**
 * View actions - re-exports from split modules for backwards compatibility
 *
 * Triggers (reactive stores): viewTriggers.ts
 * Utilities (functions): $lib/utils/viewUtils.ts
 */

// Re-export all triggers
export {
	fitViewTrigger,
	triggerFitView,
	fitViewPadding,
	setFitViewPadding,
	type FitViewPadding,
	zoomInTrigger,
	zoomOutTrigger,
	triggerZoomIn,
	triggerZoomOut,
	panTrigger,
	triggerPan,
	focusNodeTrigger,
	triggerFocusNode,
	clearSelectionTrigger,
	triggerClearSelection,
	nudgeTrigger,
	triggerNudge,
	selectNodeTrigger,
	triggerSelectNodes,
	editAnnotationTrigger,
	triggerEditAnnotation,
	flyInAnimationTrigger,
	triggerFlyInAnimation
} from './viewTriggers';

// Re-export all utilities
export {
	registerScreenToFlowConverter,
	screenToFlow,
	registerHasSelection,
	hasAnySelection,
	getViewportCenter
} from '$lib/utils/viewUtils';
