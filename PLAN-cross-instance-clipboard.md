# Cross-Instance Clipboard Implementation Plan

## Current State

The clipboard uses an **in-memory Svelte store** (`writable<ClipboardContent>`). Each browser tab is isolated, so copy/paste only works within the same tab.

## Goal

Enable copy/paste between multiple PathView instances using the **System Clipboard API** (`navigator.clipboard`).

---

## Refactoring Opportunity: Duplicate Code

The same "clone node with new ID" logic exists in **3 places**:

1. `clipboard.ts` paste() - lines 139-167
2. `fileOps.ts` importBlock() - lines 507-521
3. `fileOps.ts` importSubsystem() - lines 549-568

All three do:
```typescript
const newNode: NodeInstance = {
    ...node,
    id: newId,
    position: { ...position },
    inputs: node.inputs.map((port, index) => ({
        ...port,
        id: `${newId}-input-${index}`,
        nodeId: newId
    })),
    outputs: node.outputs.map((port, index) => ({
        ...port,
        id: `${newId}-output-${index}`,
        nodeId: newId
    }))
};
if (newNode.graph) {
    newNode.graph = regenerateGraphIds(newNode.graph);
}
```

### Consolidation

Extract to a shared utility:

```typescript
// In src/lib/stores/graph/utils.ts or similar
export function cloneNodeWithNewId(
    node: NodeInstance,
    position: Position,
    newId?: string
): NodeInstance {
    const id = newId ?? generateId();
    const newNode: NodeInstance = {
        ...node,
        id,
        position: { ...position },
        inputs: node.inputs.map((port, index) => ({
            ...port,
            id: `${id}-input-${index}`,
            nodeId: id
        })),
        outputs: node.outputs.map((port, index) => ({
            ...port,
            id: `${id}-output-${index}`,
            nodeId: id
        }))
    };

    // Recursively regenerate IDs in subsystem graphs
    if (newNode.graph) {
        newNode.graph = regenerateGraphIds(newNode.graph);
    }

    return newNode;
}
```

This also lets us **merge `importBlock` and `importSubsystem`** into a single function since the only difference was the subsystem graph handling (now automatic).

---

## System Clipboard Implementation

### 1. Data Format

Wrap clipboard content with metadata for identification:

```typescript
// In src/lib/stores/clipboard.ts
interface SystemClipboardPayload {
    type: 'pathview-clipboard';
    version: string;  // e.g., '1.0'
    content: ClipboardContent;
}

const CLIPBOARD_TYPE = 'pathview-clipboard';
const CLIPBOARD_VERSION = '1.0';
```

### 2. Validation

Type guard to safely parse clipboard data:

```typescript
function isValidPayload(data: unknown): data is SystemClipboardPayload {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return (
        obj.type === CLIPBOARD_TYPE &&
        typeof obj.version === 'string' &&
        typeof obj.content === 'object' &&
        obj.content !== null
    );
}
```

### 3. System Clipboard Functions

```typescript
async function writeToSystemClipboard(content: ClipboardContent): Promise<boolean> {
    try {
        const payload: SystemClipboardPayload = {
            type: CLIPBOARD_TYPE,
            version: CLIPBOARD_VERSION,
            content
        };
        await navigator.clipboard.writeText(JSON.stringify(payload));
        return true;
    } catch (error) {
        console.warn('Failed to write to system clipboard:', error);
        return false;
    }
}

async function readFromSystemClipboard(): Promise<ClipboardContent | null> {
    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);

        if (!isValidPayload(data)) {
            return null; // Not PathView data
        }

        // Version check (for future compatibility)
        if (data.version !== CLIPBOARD_VERSION) {
            console.warn(`Clipboard version mismatch: ${data.version} vs ${CLIPBOARD_VERSION}`);
            // For now, still try to use it
        }

        return data.content;
    } catch (error) {
        // Permission denied, parse error, or no clipboard access
        return null;
    }
}
```

### 4. Updated copy() Function

```typescript
async function copy(): Promise<boolean> {
    // ... existing selection gathering logic ...

    const content: ClipboardContent = {
        nodes: copiedNodes,
        connections: copiedConnections,
        events: copiedEvents,
        center
    };

    // Always store in memory (guaranteed to work)
    clipboard.set(content);

    // Also write to system clipboard (best effort)
    await writeToSystemClipboard(content);

    return true;
}
```

### 5. Updated paste() Function

```typescript
async function paste(targetPosition: Position): Promise<{ nodeIds: string[]; eventIds: string[] }> {
    // Try system clipboard first (enables cross-instance paste)
    let content = await readFromSystemClipboard();

    // Fall back to in-memory clipboard
    if (!content) {
        content = get(clipboard);
    }

    if (!content || (content.nodes.length === 0 && content.events.length === 0)) {
        return { nodeIds: [], eventIds: [] };
    }

    // ... existing paste logic using content ...
}
```

### 6. Caller Updates

The keyboard shortcuts in `+page.svelte` call `clipboardStore.copy()` and `clipboardStore.paste()` without awaiting. Since these are fire-and-forget operations, making them async is seamless:

```typescript
// Before (still works - just doesn't await)
clipboardStore.copy();
clipboardStore.paste(flowPosition);

// The return values aren't used, so async is transparent
```

---

## Implementation Steps

### Phase 1: Extract shared utility (consolidation)
1. Create `cloneNodeWithNewId()` in `src/lib/stores/graph/utils.ts`
2. Update `clipboard.ts` to use it
3. Update `fileOps.ts` to use it
4. Merge `importBlock` and `importSubsystem` into single `importComponent` function
5. Run tests / manual verification

### Phase 2: Add system clipboard support
1. Add types: `SystemClipboardPayload`, validation function
2. Add `writeToSystemClipboard()` function
3. Add `readFromSystemClipboard()` function
4. Update `copy()` to write to system clipboard
5. Update `paste()` to read from system clipboard first
6. Update function signatures to async

### Phase 3: Validation & edge cases
1. Test same-tab copy/paste (should still work)
2. Test cross-tab copy/paste
3. Test with non-PathView clipboard content (should gracefully fall back)
4. Test permission denied scenarios
5. Test node type validation (pasting blocks that don't exist in target instance)

---

## Edge Cases to Handle

1. **Invalid node types**: When pasting, some block types might not exist in the target instance (e.g., different PathSim versions). Use existing `validateNodeTypes()` from fileOps.ts.

2. **Permission denied**: `readText()` may fail silently in some browsers. Fall back to in-memory clipboard.

3. **Non-JSON clipboard content**: User copied text from another app. `JSON.parse` fails, return null.

4. **Version mismatch**: Future versions might have different format. Log warning but attempt to use.

5. **Very large selections**: System clipboard has no practical limit, but consider performance for huge graphs.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/stores/graph/utils.ts` | Add `cloneNodeWithNewId()` |
| `src/lib/stores/clipboard.ts` | Add system clipboard support, use shared utility |
| `src/lib/schema/fileOps.ts` | Use shared utility, merge import functions |

---

## Benefits

1. **Cross-instance paste**: Copy in one tab, paste in another
2. **Cross-browser paste**: Copy in Chrome, paste in Firefox
3. **Export to text**: Users can paste PathView data into text editors
4. **Import from text**: Power users can craft/edit clipboard JSON
5. **Reduced code duplication**: Single source of truth for node cloning
