# Performance & Memory Fix Plan

## Summary of Verified Issues

After thorough code review, I verified the original findings against the actual codebase. Several reported issues were **false positives** (code was already correct), while others are **confirmed issues** that need fixing.

---

## FALSE POSITIVES (No Fix Needed)

These were incorrectly identified and the code is already correct:

| Original Claim | Why It's False |
|----------------|----------------|
| FlowUpdater.svelte setInterval leak | Effect has proper `return () => clearInterval(interval)` cleanup and no reactive dependencies causing re-runs |
| PlotPanel.svelte ResizeObserver leak | Has proper cleanup via `return () => { resizeObserver?.disconnect(); }` in effect |
| ConsolePanel.svelte setTimeout stacking | Already clears previous timeout with `clearTimeout(scrollTimeout)` before setting new one |
| Tooltip.svelte shared timer race condition | Intentional singleton design - only one tooltip exists at a time |
| SignalPlot.svelte Plotly not purged | Already calls `Plotly.purge(plotDiv)` in onDestroy (line 104) |

---

## CONFIRMED ISSUES - Must Fix

### Priority 1: Subscription Leaks in Dialogs

These dialogs have store subscriptions without proper cleanup:

#### 1. BlockPropertiesDialog.svelte (Lines 27, 37)
```javascript
// Line 27 - NO unsubscribe
nodeDialogStore.subscribe((id) => { ... });

// Line 37 - NO unsubscribe
graphStore.nodesArray.subscribe((nodes) => { ... });
```
**Fix:** Store unsubscribe functions and call them in onDestroy.

#### 2. EventPropertiesDialog.svelte (Lines 25, 35)
```javascript
// Line 25 - NO unsubscribe
eventDialogStore.subscribe((id) => { ... });

// Line 35 - NO unsubscribe
eventStore.eventsArray.subscribe((events) => { ... });
```
**Fix:** Same as above.

#### 3. SearchDialog.svelte (Line 24)
```javascript
// Line 24 - NO unsubscribe, NO onDestroy at all
graphStore.currentPath.subscribe((path) => { ... });
```
**Fix:** Add onDestroy with unsubscribe.

#### 4. ExportDialog.svelte (Line 30)
```javascript
// Line 30 - NO unsubscribe
themeStore.subscribe((theme) => { ... });

// onDestroy exists but only calls destroyEditor()
```
**Fix:** Store unsubscribe and call it in onDestroy.

#### 5. CodePreviewDialog.svelte (Line 27)
```javascript
// Line 27 - NO unsubscribe
themeStore.subscribe((theme) => { ... });

// onDestroy exists but only calls destroyEditor()
```
**Fix:** Same as above.

#### 6. PlotOptionsDialog.svelte (Line 36)
```javascript
// Line 36 - Has unsubscribe variable but NO onDestroy
const unsubscribe = plotSettingsStore.subscribe((s) => { ... });
```
**Fix:** Add onDestroy that calls unsubscribe().

---

### Priority 2: Potential Event Listener Leak

#### ResizablePanel.svelte (Lines 118-161)
```javascript
function startResize(edge) {
    // Adds document listeners
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Cleanup only in onMouseUp - what if component unmounts mid-resize?
}
```
**Risk:** Low - requires component to unmount exactly during mouse drag
**Fix:** Track active listeners and clean up in component destroy

---

### Priority 3: Race Condition

#### +page.svelte handleRun (Lines 706-719)
```javascript
async function handleRun() {
    if (simRunning || isRunStarting || pyodideLoading) return;  // Line 706

    if (!pyodideReady) {
        await initPyodide();  // ASYNC GAP HERE - another call could pass line 706
    }

    isRunStarting = true;  // Line 719 - set AFTER async
}
```
**Fix:** Set `isRunStarting = true` BEFORE the async initPyodide call.

---

## LOW PRIORITY - Optimizations (Not Bugs)

These are performance optimizations, not bugs:

1. **history.ts** - Full state clones on every mutation
   - Required for undo/redo functionality
   - Could optimize with structural sharing but complex refactor

2. **graph/state.ts** - Derived stores recalculate on every change
   - Standard Svelte pattern
   - Could add memoization for large graphs

3. **FlowUpdater.svelte** - Position sync every 2 seconds even when idle
   - Minor inefficiency
   - Could optimize to only sync after actual drags

---

## Implementation Plan

### Phase 1: Fix Subscription Leaks (6 files)

Each fix follows this pattern:
```javascript
// Before
someStore.subscribe((value) => { ... });

// After
import { onDestroy } from 'svelte';

const unsubscribe = someStore.subscribe((value) => { ... });
onDestroy(() => unsubscribe());
```

Files to modify:
1. `src/lib/components/dialogs/BlockPropertiesDialog.svelte`
2. `src/lib/components/dialogs/EventPropertiesDialog.svelte`
3. `src/lib/components/dialogs/SearchDialog.svelte`
4. `src/lib/components/dialogs/ExportDialog.svelte`
5. `src/lib/components/dialogs/CodePreviewDialog.svelte`
6. `src/lib/components/dialogs/PlotOptionsDialog.svelte`

### Phase 2: Fix Race Condition (1 file)

File: `src/routes/+page.svelte`

Move `isRunStarting = true` to before the async call:
```javascript
async function handleRun() {
    if (simRunning || isRunStarting || pyodideLoading) return;

    isRunStarting = true;  // MOVE HERE

    try {
        if (!pyodideReady) {
            await initPyodide();
        }
        // ... rest of function
    } finally {
        isRunStarting = false;
    }
}
```

### Phase 3: Fix ResizablePanel Edge Case (1 file)

File: `src/lib/components/ResizablePanel.svelte`

Track active resize state and clean up on destroy:
```javascript
let activeCleanup: (() => void) | null = null;

function startResize(edge) {
    return (event) => {
        // ... existing code ...

        function cleanup() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            activeCleanup = null;
        }

        activeCleanup = cleanup;

        function onMouseUp() {
            cleanup();
            // ... rest
        }
    };
}

onDestroy(() => {
    activeCleanup?.();
});
```

---

## Testing Checklist

After implementing fixes, verify:

- [ ] Dialogs open/close multiple times without memory growth (Chrome DevTools Memory tab)
- [ ] Rapid Ctrl+Enter doesn't start multiple simulations
- [ ] Resizing panels then quickly closing them doesn't cause errors
- [ ] All existing functionality still works:
  - [ ] Block properties dialog
  - [ ] Event properties dialog
  - [ ] Search dialog (Ctrl+K)
  - [ ] Export dialog (Ctrl+E)
  - [ ] Code preview dialogs
  - [ ] Plot options dialog
  - [ ] Panel resizing
  - [ ] Simulation run/continue

---

## Risk Assessment

| Fix | Risk Level | Reason |
|-----|------------|--------|
| Subscription cleanups | Very Low | Adding cleanup doesn't change behavior |
| Race condition fix | Low | Moving flag earlier is safer |
| ResizablePanel cleanup | Very Low | Adds safety net, doesn't change normal flow |

All fixes are **additive safety measures** that don't change the normal code flow.
