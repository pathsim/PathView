# PathView

A web-based visual node editor for building and simulating dynamic systems using [PathSim](https://docs.pathsim.org). Runs entirely in the browser via Pyodide - no server required.

## Tech Stack

- [SvelteKit 5](https://kit.svelte.dev/) with Svelte 5 runes
- [SvelteFlow](https://svelteflow.dev/) for the node editor
- [Pyodide](https://pyodide.org/) for in-browser Python/NumPy/SciPy
- [Plotly.js](https://plotly.com/javascript/) for interactive plots
- [CodeMirror 6](https://codemirror.net/) for code editing

## Getting Started

```bash
npm install
npm run dev
```

For production:

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── lib/
│   ├── actions/           # Svelte actions (paramInput)
│   ├── animation/         # Graph loading animations
│   ├── components/        # UI components
│   │   ├── canvas/        # Flow editor utilities
│   │   ├── dialogs/       # Modal dialogs (BlockProperties, EventProperties, Export, Search, KeyboardShortcuts)
│   │   │   └── shared/    # Shared dialog components
│   │   ├── edges/         # SvelteFlow edge components
│   │   ├── icons/         # Centralized icon library
│   │   ├── nodes/         # Node components (BaseNode, EventNode, PlotPreview)
│   │   └── panels/        # Side panels (Simulation, NodeLibrary, Code, Plot, Console, Events)
│   ├── constants/         # Centralized constants (nodeTypes)
│   ├── events/            # Event system
│   │   └── generated/     # Auto-generated from PathSim
│   ├── nodes/             # Node type system
│   │   ├── features/      # Node feature flags
│   │   ├── generated/     # Auto-generated from PathSim
│   │   └── shapes/        # Node shape definitions
│   ├── plotting/          # Plot utilities
│   ├── pyodide/           # Python runtime (backend, bridge)
│   │   └── backend/       # Modular backend system (registry, state, types)
│   │       └── pyodide/   # Pyodide Web Worker implementation
│   ├── schema/            # File I/O (save/load, component export)
│   ├── simulation/        # Simulation metadata
│   │   └── generated/     # Auto-generated defaults
│   ├── stores/            # Svelte stores (state management)
│   │   └── graph/         # Graph state with subsystem navigation
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utilities (colors, download, svgExport, csvExport, codemirror)
├── routes/                # SvelteKit pages
└── app.css                # Global styles with CSS variables

scripts/
├── extract-blocks.py      # Extract block definitions from PathSim
├── extract-events.py      # Extract event definitions
└── ...
```

---

## Architecture Overview

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Graph Store    │────>│ pathsimRunner   │────>│ Python Code     │
│  (nodes, edges) │     │ (code gen)      │     │ (string)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        v
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Plot/Console   │<────│ bridge.ts       │<────│ REPL Worker     │
│  (results)      │     │ (queue + rAF)   │     │ (Pyodide)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Streaming Architecture

Simulations run in streaming mode for real-time visualization. The worker runs autonomously and pushes results without waiting for the UI:

```
Worker (10 Hz)              Main Thread                 UI (10 Hz)
┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│ Python loop  │ ────────> │ Result Queue │ ────────> │ Plotly       │
│ (autonomous) │  stream-  │ (accumulate) │    rAF    │ extendTraces │
│              │   data    │              │  batched  │              │
└──────────────┘           └──────────────┘           └──────────────┘
```

- **Decoupled rates**: Python generates data at 10 Hz, UI renders at 10 Hz max
- **Queue-based**: Results accumulate in queue, merged on each UI frame
- **Non-blocking**: Simulation never waits for plot rendering
- **extendTraces**: Scope plots append data incrementally instead of full re-render

### Key Abstractions

| Layer | Purpose | Key Files |
|-------|---------|-----------|
| **Main App** | Orchestrates panels, shortcuts, file ops | `routes/+page.svelte` |
| **Flow Canvas** | SvelteFlow wrapper, node/edge sync | `components/FlowCanvas.svelte` |
| **Flow Updater** | View control, animation triggers | `components/FlowUpdater.svelte` |
| **Context Menus** | Right-click menus for nodes/canvas | `components/ContextMenu.svelte`, `contextMenuBuilders.ts` |
| **Graph Store** | Node/edge state, subsystem navigation | `stores/graph/` |
| **View Actions** | Fit view, zoom, pan controls | `stores/viewActions.ts` |
| **Node Registry** | Block type definitions, parameters | `nodes/registry.ts` |
| **Code Generation** | Graph → Python code | `pyodide/pathsimRunner.ts` |
| **Backend** | Modular Python execution interface | `pyodide/backend/` |
| **Backend Registry** | Factory for swappable backends | `pyodide/backend/registry.ts` |
| **PyodideBackend** | Web Worker Pyodide implementation | `pyodide/backend/pyodide/` |
| **Simulation Bridge** | High-level simulation API | `pyodide/bridge.ts` |
| **Schema** | File/component save/load operations | `schema/fileOps.ts`, `schema/componentOps.ts` |
| **Export Utils** | SVG/CSV/Python file downloads | `utils/download.ts`, `utils/svgExport.ts`, `utils/csvExport.ts` |

### Centralized Constants

Use these imports instead of magic strings:

```typescript
import { NODE_TYPES } from '$lib/constants/nodeTypes';
// NODE_TYPES.SUBSYSTEM, NODE_TYPES.INTERFACE

import { PORT_COLORS, DIALOG_COLOR_PALETTE } from '$lib/utils/colors';
// PORT_COLORS.default, etc.
```

---

## Adding New Blocks

Blocks are extracted automatically from PathSim. To add a new block:

### 1. Ensure the block exists in PathSim

The block must be importable from `pathsim.blocks`:

```python
from pathsim.blocks import YourNewBlock
```

### 2. Add to block configuration

Edit `scripts/extract-blocks.py` and add the block to the appropriate category:

```python
BLOCK_CONFIG = {
    "Sources": [...],
    "Dynamic": [...],
    "Algebraic": [
        ...,
        "YourNewBlock",  # Add here
    ],
    ...
}
```

### 3. (Optional) Add UI overrides

If the block needs custom UI behavior (port limits, default ports), add to `UI_OVERRIDES`:

```python
UI_OVERRIDES = {
    "YourNewBlock": {
        "maxInputs": 4,           # Max number of input ports
        "maxOutputs": 1,          # Max number of output ports
        "defaultInputs": ["a", "b"],  # Default input port names
        "defaultOutputs": ["out"],    # Default output port names
    },
    ...
}
```

### 4. Run extraction

```bash
npm run extract-blocks
```

This generates `src/lib/nodes/generated/blocks.ts` with:
- Block metadata (parameters, descriptions)
- Pre-rendered docstring HTML
- Port configurations

### 5. Verify

Start the dev server and check that your block appears in the Block Library panel.

---

## Python Backend System

The Python runtime uses a modular backend architecture, allowing different execution environments (Pyodide, local Python, remote server) to be swapped without changing application code.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Backend Interface                          │
│  init(), exec(), evaluate(), startStreaming(), stopStreaming()...   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
              ┌───────────┐  ┌───────────┐  ┌───────────┐
              │ Pyodide   │  │ Local     │  │ Remote    │
              │ Backend   │  │ Backend   │  │ Backend   │
              │ (Worker)  │  │ (Flask)   │  │ (Server)  │
              └───────────┘  └───────────┘  └───────────┘
                   │              (future)      (future)
                   ▼
            ┌───────────┐
            │ Web Worker│
            │ (Pyodide) │
            └───────────┘
```

### Backend Registry

```typescript
import { getBackend, switchBackend } from '$lib/pyodide/backend';

// Get current backend (defaults to Pyodide)
const backend = getBackend();

// Switch to a different backend type (future)
// switchBackend('local');  // Use local Python via Flask
// switchBackend('remote'); // Use remote server
```

### REPL Protocol

**Requests** (Main → Worker):

```typescript
type REPLRequest =
  | { type: 'init' }
  | { type: 'exec'; id: string; code: string }      // Execute code (no return)
  | { type: 'eval'; id: string; expr: string }      // Evaluate expression (returns JSON)
  | { type: 'stream-start'; id: string; expr: string }  // Start streaming loop
  | { type: 'stream-stop' }                         // Stop streaming loop
  | { type: 'stream-exec'; code: string }           // Execute code during streaming
```

**Responses** (Worker → Main):

```typescript
type REPLResponse =
  | { type: 'ready' }
  | { type: 'ok'; id: string }                   // exec succeeded
  | { type: 'value'; id: string; value: string } // eval result (JSON)
  | { type: 'error'; id: string; error: string; traceback?: string }
  | { type: 'stdout'; value: string }
  | { type: 'stderr'; value: string }
  | { type: 'progress'; value: string }
  | { type: 'stream-data'; id: string; value: string }  // Streaming result
  | { type: 'stream-done'; id: string }                 // Streaming completed
```

### Usage Example

```typescript
import { init, exec, evaluate } from '$lib/pyodide/backend';

// Initialize backend (Pyodide by default)
await init();

// Execute Python code
await exec(`
import numpy as np
x = np.linspace(0, 10, 100)
`);

// Evaluate and get result
const result = await evaluate<number[]>('x.tolist()');
```

### High-Level API (bridge.ts)

For simulation, use the higher-level API in `bridge.ts`:

```typescript
import {
  runStreamingSimulation,
  continueStreamingSimulation,
  stopSimulation,
  execDuringStreaming
} from '$lib/pyodide/bridge';

// Run streaming simulation
const result = await runStreamingSimulation(pythonCode, duration, (partialResult) => {
  console.log('Progress:', partialResult.scopeData);
});
// result.scopeData, result.spectrumData, result.nodeNames

// Continue simulation from where it stopped
const moreResult = await continueStreamingSimulation('5.0');

// Stop simulation gracefully
await stopSimulation();

// Execute code during active simulation (queued between steps)
execDuringStreaming('source.amplitude = 2.0');
```

---

## State Management

### SvelteFlow vs Graph Store

SvelteFlow manages its own UI state (selection, viewport, node positions). The graph store manages application data:

| State Type | Managed By | Examples |
|------------|------------|----------|
| **UI State** | SvelteFlow | Selection, viewport, dragging |
| **App Data** | Graph Store | Node parameters, connections, subsystems |

Do not duplicate SvelteFlow state in custom stores. Use SvelteFlow's APIs (`useSvelteFlow`, event handlers) to interact with canvas state.

### Store Pattern

Stores use Svelte's writable with custom wrapper objects:

```typescript
const internal = writable<T>(initialValue);

export const myStore = {
    subscribe: internal.subscribe,

    // Custom methods
    doSomething() {
        internal.update(state => ({ ...state, ... }));
    }
};
```

**Important**: Do NOT wrap `.subscribe()` in `$effect()` - this causes infinite loops.

```svelte
<script>
// Correct
myStore.subscribe(value => { localState = value; });

// Wrong - causes infinite loop
$effect(() => {
    myStore.subscribe(value => { localState = value; });
});
</script>
```

### Subsystem Navigation

Subsystems are nested graphs with path-based navigation:

```typescript
graphStore.navigateInto(subsystemId);  // Drill into subsystem
graphStore.navigateOut();               // Go up one level
graphStore.currentPath                  // Current navigation path
```

The Interface node inside a subsystem mirrors its parent Subsystem's ports (with inverted direction).

---

## Keyboard Shortcuts

Press `?` to see all shortcuts in the app. Key shortcuts:

| Category | Shortcut | Action |
|----------|----------|--------|
| **File** | `Ctrl+O` | Open |
| | `Ctrl+S` | Save |
| | `Ctrl+E` | Export Python |
| **Edit** | `Ctrl+Z/Y` | Undo/Redo |
| | `Ctrl+D` | Duplicate |
| | `Ctrl+F` | Find |
| | `Del` | Delete |
| **Transform** | `R` | Rotate 90° |
| | `X` / `Y` | Flip H/V |
| | `Arrows` | Nudge selection |
| **View** | `F` | Fit view |
| | `H` | Go to root |
| | `T` | Toggle theme |
| **Panels** | `B` | Blocks |
| | `N` | Events |
| | `S` | Simulation |
| | `V` | Results |
| | `C` | Console |
| **Run** | `Ctrl+Enter` | Simulate |
| | `Shift+Enter` | Continue |

---

## File Formats

PathView uses JSON-based file formats for saving and sharing:

| Extension | Type | Description |
|-----------|------|-------------|
| `.pvm` | Model | Complete simulation model (graph, events, settings, code) |
| `.blk` | Block | Single block with parameters (for sharing/reuse) |
| `.sub` | Subsystem | Subsystem with internal graph (for sharing/reuse) |

### Export Options

- **File > Save** - Save complete model as `.pvm`
- **File > Export Python** - Generate standalone Python script
- **Right-click node > Export** - Save individual block/subsystem
- **Right-click canvas > Export SVG** - Export graph as vector image
- **Scope/Spectrum nodes** - Export simulation data as CSV

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run check` | TypeScript/Svelte type checking |
| `npm run extract-blocks` | Regenerate block definitions from PathSim |
| `npm run extract-events` | Regenerate event definitions |
| `npm run examples` | Generate examples manifest |

---

## Design Principles

1. **Python is first-class** - All node parameters are Python expressions stored as strings and passed verbatim to PathSim. PathSim handles all type checking and validation at runtime.

2. **Subsystems are nested graphs** - The Interface node inside a subsystem mirrors its parent's ports (inverted direction).

3. **No server required** - Everything runs client-side via Pyodide WebAssembly.

4. **Registry pattern** - Nodes and events are registered centrally for extensibility.

5. **Minimal state** - Derive where possible, avoid duplicating truth. SvelteFlow manages its own UI state.

6. **CSS for styling** - Use CSS variables from `app.css` and component `<style>` blocks, not JavaScript theme APIs.

7. **Svelte 5 runes** - Use `$state`, `$derived`, `$effect` exclusively.

---

## Performance Optimizations

### Streaming Simulation

- **Autonomous worker**: Python runs in a Web Worker loop, pushing results without waiting for UI acknowledgment
- **Queue-based updates**: Results accumulate in a queue, merged in batches via `requestAnimationFrame`
- **Decoupled rates**: Simulation @ 10 Hz, UI updates @ 10 Hz max - expensive plots don't slow simulation

### Plotly Rendering

- **extendTraces**: During streaming, scope plots append new data instead of full re-render
- **SVG mode**: Uses `scatter` (SVG) instead of `scattergl` (WebGL) for stability during streaming
- **Visibility API**: Pauses plot updates when browser tab is hidden

### Node Previews

- **Separate render queue**: Plot previews in nodes use SVG paths (not Plotly)
- **Min-max decimation**: Large datasets downsampled while preserving peaks/valleys
- **Deferred rendering**: Shared queue prevents preview updates from blocking main plots

---

## License

MIT
