/**
 * Store exports - convenience re-exports from store modules
 */

// Core state stores
export { graphStore } from './graph';
export { eventStore } from './events';
export { settingsStore } from './settings';
export { themeStore } from './theme';
export { backendPreferenceStore } from './backendPreference'
export { consoleStore } from './console';
export { codeContextStore } from './codeContext';

// Dialog stores
export { nodeDialogStore, openNodeDialog, closeNodeDialog } from './nodeDialog';
export { eventDialogStore, openEventDialog, closeEventDialog } from './eventDialog';

// Unified event facade (simplifies event operations across root/subsystem)
export { unifiedEvents } from './eventFacade';

// UI state stores
export { contextMenuStore } from './contextMenu';
export { nodeUpdatesStore } from './nodeUpdates';
export { pinnedPreviewsStore } from './pinnedPreviews';
export { hoveredHandle, selectedNodeHighlight } from './hoveredHandle';

// View actions (re-exports triggers and utils)
export * from './viewActions';

// Drop target bridge (not a reactive store)
export { dropTargetBridge } from './dropTargetBridge';
