<p align="center">
  <img src="https://raw.githubusercontent.com/pathsim/pathview/main/static/pathview_logo.png" width="300" alt="PathView Logo" />
</p>

------------


# PathView - System Modeling in the Browser

A web-based visual node editor for building and simulating dynamic systems with [PathSim](https://github.com/pathsim/pathsim) as the backend. Runs entirely in the browser via Pyodide by default — no server required. Optionally, a Flask backend enables server-side Python execution with any packages (including those with native dependencies that Pyodide can't run). The UI is hosted at [view.pathsim.org](https://view.pathsim.org), free to use for everyone.

## Tech Stack

- [SvelteKit 5](https://kit.svelte.dev/) with Svelte 5 runes
- [SvelteFlow](https://svelteflow.dev/) for the node editor
- [Pyodide](https://pyodide.org/) for in-browser Python/NumPy/SciPy
- [Plotly.js](https://plotly.com/javascript/) for interactive plots
- [CodeMirror 6](https://codemirror.net/) for code editing

## Installation

### pip install (recommended for users)

```bash
pip install pathview
pathview serve
```

This starts the PathView server with a local Python backend and opens your browser. No Node.js required.

**Options:**
- `--port PORT` — server port (default: 5000)
- `--host HOST` — bind address (default: 127.0.0.1)
- `--no-browser` — don't auto-open the browser
- `--debug` — debug mode with auto-reload

### Development setup

```bash
npm install
npm run dev
```

To use the Flask backend during development:

```bash
pip install flask flask-cors
npm run server   # Start Flask backend on port 5000
npm run dev      # Start Vite dev server (separate terminal)
# Open http://localhost:5173/?backend=flask
```

## Project Structure

```
src/
├── lib/
│   ├── actions/           # Svelte actions (paramInput)
│   ├── animation/         # Graph loading animations
│   ├── components/        # UI components
│   │   ├── canvas/        # Flow editor utilities (connection, transforms)
│   │   ├── dialogs/       # Modal dialogs
│   │   │   └── shared/    # Shared dialog components (ColorPicker, etc.)
│   │   ├── edges/         # SvelteFlow edge components (ArrowEdge)
│   │   ├── icons/         # Icon component (Icon.svelte)
│   │   ├── nodes/         # Node components (BaseNode, EventNode, AnnotationNode, PlotPreview)
│   │   └── panels/        # Side panels (Simulation, NodeLibrary, CodeEditor, Plot, Console, Events)
│   ├── constants/         # Centralized constants (nodeTypes, layout, handles)
│   ├── events/            # Event system
│   │   └── generated/     # Auto-generated from PathSim
│   ├── export/            # Export utilities
│   │   └── svg/           # SVG graph export (renderer, types)
│   ├── nodes/             # Node type system
│   │   ├── generated/     # Auto-generated from PathSim
│   │   └── shapes/        # Node shape definitions
│   ├── plotting/          # Plot system
│   │   ├── core/          # Constants, types, utilities
│   │   ├── processing/    # Data processing, render queue
│   │   └── renderers/     # Plotly and SVG renderers
│   ├── routing/           # Orthogonal wire routing (A* pathfinding)
│   ├── pyodide/           # Python runtime (backend, bridge)
│   │   └── backend/       # Modular backend system (registry, state, types)
│   │       ├── pyodide/   # Pyodide Web Worker implementation
│   │       └── flask/     # Flask HTTP/SSE backend implementation
│   ├── schema/            # File I/O (save/load, component export)
│   ├── simulation/        # Simulation metadata
│   │   └── generated/     # Auto-generated defaults
│   ├── stores/            # Svelte stores (state management)
│   │   └── graph/         # Graph state with subsystem navigation
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utilities (colors, download, csvExport, codemirror)
├── routes/                # SvelteKit pages
└── app.css                # Global styles with CSS variables

pathview_server/           # Python package (pip install pathview)
├── app.py                 # Flask server (subprocess management, HTTP routes)
├── worker.py              # REPL worker subprocess (Python execution)
├── cli.py                 # CLI entry point (pathview serve)
└── static/                # Bundled frontend (generated at build time)

scripts/
├── config/                # Configuration files for extraction
│   ├── schemas/           # JSON schemas for validation
│   ├── pathsim/           # Core PathSim blocks, events, simulation config
│   ├── pathsim-chem/      # Chemical toolbox blocks
│   ├── pyodide.json       # Pyodide version and preload packages
│   ├── requirements-pyodide.txt   # Runtime Python packages
│   └── requirements-build.txt     # Build-time Python packages
├── generated/             # Generated files (from extract.py)
│   └── registry.json      # Block/event registry with import paths
├── extract.py             # Unified extraction script
└── pvm2py.py              # Standalone .pvm to Python converter
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
│  Plot/Console   │<────│ bridge.ts       │<────│ Backend         │
│  (results)      │     │ (queue + rAF)   │     │ (Pyodide/Flask) │
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

### Wire Routing

PathView uses Simulink-style orthogonal wire routing with A* pathfinding:

- **Automatic routing**: Wires route around nodes with 90° bends only
- **User waypoints**: Press `\` on selected edge to add manual waypoints
- **Draggable waypoints**: Drag waypoint markers to reposition, double-click to delete
- **Segment dragging**: Drag segment midpoints to create new waypoints
- **Incremental updates**: Spatial indexing (O(1) node updates) for smooth dragging
- **Hybrid routing**: Routes through user waypoints: Source → A* → W1 → A* → Target

Key files: `src/lib/routing/` (pathfinder, grid builder, route calculator)

### Key Abstractions

| Layer | Purpose | Key Files |
|-------|---------|-----------|
| **Main App** | Orchestrates panels, shortcuts, file ops | `routes/+page.svelte` |
| **Flow Canvas** | SvelteFlow wrapper, node/edge sync | `components/FlowCanvas.svelte` |
| **Flow Updater** | View control, animation triggers | `components/FlowUpdater.svelte` |
| **Context Menus** | Right-click menus for nodes/canvas/plots | `components/ContextMenu.svelte`, `contextMenuBuilders.ts` |
| **Graph Store** | Node/edge state, subsystem navigation | `stores/graph/` |
| **View Actions** | Fit view, zoom, pan controls | `stores/viewActions.ts`, `stores/viewTriggers.ts` |
| **Clipboard** | Copy/paste/duplicate operations | `stores/clipboard.ts` |
| **Plot Settings** | Per-trace and per-block plot options | `stores/plotSettings.ts` |
| **Node Registry** | Block type definitions, parameters | `nodes/registry.ts` |
| **Code Generation** | Graph → Python code | `pyodide/pathsimRunner.ts` |
| **Backend** | Modular Python execution interface | `pyodide/backend/` |
| **Backend Registry** | Factory for swappable backends | `pyodide/backend/registry.ts` |
| **PyodideBackend** | Web Worker Pyodide implementation | `pyodide/backend/pyodide/` |
| **FlaskBackend** | HTTP/SSE Flask server implementation | `pyodide/backend/flask/` |
| **Simulation Bridge** | High-level simulation API | `pyodide/bridge.ts` |
| **Schema** | File/component save/load operations | `schema/fileOps.ts`, `schema/componentOps.ts` |
| **Export Utils** | SVG/CSV/Python file downloads | `utils/download.ts`, `export/svg/`, `utils/csvExport.ts` |

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

Blocks are extracted automatically from PathSim using the `Block.info()` classmethod. The extraction is config-driven for easy maintenance.

### 1. Ensure the block exists in PathSim

The block must be importable from `pathsim.blocks` (or toolbox module):

```python
from pathsim.blocks import YourNewBlock
```

### 2. Add to block configuration

Edit `scripts/config/pathsim/blocks.json` and add the block class name to the appropriate category:

```json
{
  "categories": {
    "Algebraic": [
      "Adder",
      "Multiplier",
      "YourNewBlock"
    ]
  }
}
```

Port configurations are automatically extracted from `Block.info()`:
- `None` → Variable/unlimited ports (UI allows add/remove)
- `{}` → No ports of this type
- `{"name": index}` → Fixed labeled ports (locked count)

### 3. Run extraction

```bash
npm run extract
```

This generates TypeScript files in `src/lib/*/generated/` with:
- Block metadata (parameters, descriptions, docstrings)
- Port configurations from `Block.info()`
- Pyodide runtime config

### 4. Verify

Start the dev server and check that your block appears in the Block Library panel.

### Port Synchronization

Some blocks process inputs as parallel paths where each input has a corresponding output (e.g., Integrator, Amplifier, Sin). For these blocks, the UI only shows input port controls and outputs auto-sync.

Configure in `src/lib/nodes/uiConfig.ts`:

```typescript
export const syncPortBlocks = new Set([
  'Integrator',
  'Differentiator',
  'Delay',
  'PID',
  'PID_Antiwindup',
  'Amplifier',
  'Sin', 'Cos', 'Tan', 'Tanh',
  'Abs', 'Sqrt', 'Exp', 'Log', 'Log10',
  'Mod', 'Clip', 'Pow',
  'SampleHold'
]);
```

### Port Labels from Parameters

Some blocks derive port names from a parameter (e.g., Scope and Spectrum use `labels` to name input traces). When the parameter changes, port names update automatically.

Configure in `src/lib/nodes/uiConfig.ts`:

```typescript
export const portLabelParams: Record<string, PortLabelConfig | PortLabelConfig[]> = {
  Scope: { param: 'labels', direction: 'input' },
  Spectrum: { param: 'labels', direction: 'input' },
  // Multiple directions supported:
  // SomeBlock: [
  //   { param: 'input_labels', direction: 'input' },
  //   { param: 'output_labels', direction: 'output' }
  // ]
};
```

---

## Adding New Toolboxes

To add a new PathSim toolbox (like `pathsim-chem`):

### 1. Add to requirements

Edit `scripts/config/requirements-pyodide.txt`:

```txt
--pre
pathsim
pathsim-chem>=0.2rc2  # optional
pathsim-controls      # optional - your new toolbox
```

The `# optional` comment means Pyodide will continue loading if this package fails to install.

### 2. Create toolbox config

Create `scripts/config/pathsim-controls/blocks.json`:

```json
{
  "$schema": "../schemas/blocks.schema.json",
  "toolbox": "pathsim-controls",
  "importPath": "pathsim_controls.blocks",

  "categories": {
    "Controls": [
      "PIDController",
      "StateEstimator"
    ]
  }
}
```

### 3. (Optional) Add events

Create `scripts/config/pathsim-controls/events.json` if the toolbox has custom events.

### 4. Run extraction and build

```bash
npm run extract
npm run build
```

No code changes needed - the extraction script automatically discovers toolbox directories.

For the full toolbox integration reference (Python package contract, config schemas, extraction pipeline, generated output), see [**docs/toolbox-spec.md**](docs/toolbox-spec.md).

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
              │ Pyodide   │  │ Flask     │  │ Remote    │
              │ Backend   │  │ Backend   │  │ Backend   │
              │ (default) │  │ (HTTP)    │  │ (future)  │
              └───────────┘  └───────────┘  └───────────┘
                   │              │
                   ▼              ▼
            ┌───────────┐  ┌───────────┐
            │ Web Worker│  │ Flask     │──> Python subprocess
            │ (Pyodide) │  │ Server   │    (one per session)
            └───────────┘  └───────────┘
```

### Backend Registry

```typescript
import { getBackend, switchBackend, setFlaskHost } from '$lib/pyodide/backend';

// Get current backend (defaults to Pyodide)
const backend = getBackend();

// Switch to Flask backend
setFlaskHost('http://localhost:5000');
switchBackend('flask');
```

Backend selection can also be controlled via URL parameters:

```
http://localhost:5173/?backend=flask                          # Flask on default port
http://localhost:5173/?backend=flask&host=http://myserver:5000  # Custom host
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

### Flask Backend

The Flask backend enables server-side Python execution for packages that Pyodide can't run (e.g., FESTIM or other packages with native C/Fortran dependencies). It mirrors the Web Worker architecture: one subprocess per session with the same REPL protocol.

```
Browser Tab                     Flask Server                  Worker Subprocess
┌──────────────┐               ┌──────────────────┐          ┌──────────────────┐
│ FlaskBackend │  HTTP/SSE     │ app.py           │  stdin   │ worker.py        │
│  exec()      │──POST────────→│  route → session │──JSON───→│  exec(code, ns)  │
│  eval()      │──POST────────→│  subprocess mgr  │──JSON───→│  eval(expr, ns)  │
│  stream()    │──POST (SSE)──→│  pipe SSE relay  │←─JSON────│  streaming loop  │
│  inject()    │──POST────────→│  → code queue    │──JSON───→│  queue drain     │
│  stop()      │──POST────────→│  → stop flag     │──JSON───→│  stop check      │
└──────────────┘               └──────────────────┘          └──────────────────┘
```

**Standalone (pip package):**

```bash
pip install pathview
pathview serve
```

**Development (separate servers):**

```bash
pip install flask flask-cors
npm run server   # Starts Flask API on port 5000
npm run dev      # Starts Vite dev server (separate terminal)
# Open http://localhost:5173/?backend=flask
```

**Key properties:**
- **Process isolation** — each session gets its own Python subprocess
- **Namespace persistence** — variables persist across exec/eval calls within a session
- **Dynamic packages** — packages from `PYTHON_PACKAGES` (the same config used by Pyodide) are pip-installed on first init
- **Session TTL** — stale sessions cleaned up after 1 hour of inactivity
- **Streaming** — simulations stream via SSE, with the same code injection support as Pyodide

For the full protocol reference (message types, HTTP routes, SSE format, streaming semantics, how to implement a new backend), see [**docs/backend-protocol-spec.md**](docs/backend-protocol-spec.md).

**API routes:**

| Route | Method | Action |
|-------|--------|--------|
| `/api/health` | GET | Health check |
| `/api/init` | POST | Initialize worker with packages |
| `/api/exec` | POST | Execute Python code |
| `/api/eval` | POST | Evaluate expression, return JSON |
| `/api/stream` | POST | Start streaming simulation (SSE) |
| `/api/stream/exec` | POST | Inject code during streaming |
| `/api/stream/stop` | POST | Stop streaming |
| `/api/session` | DELETE | Kill session subprocess |

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
graphStore.drillDown(subsystemId);  // Drill into subsystem
graphStore.drillUp();               // Go up one level
graphStore.navigateTo(level);       // Navigate to breadcrumb level
graphStore.currentPath              // Current navigation path
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
| **Wires** | `\` | Add waypoint to selected edge |
| **Labels** | `L` | Toggle port labels |
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

The `.pvm` format is fully documented in [**docs/pvm-spec.md**](docs/pvm-spec.md). Use this spec if you are building tools that read or write PathView models (e.g., code generators, importers). A reference Python code generator is available at `scripts/pvm2py.py`.

### Specification Documents

| Document | Audience |
|----------|----------|
| [**docs/pvm-spec.md**](docs/pvm-spec.md) | Building tools that read/write `.pvm` model files |
| [**docs/backend-protocol-spec.md**](docs/backend-protocol-spec.md) | Implementing a new execution backend (remote server, cloud worker, etc.) |
| [**docs/toolbox-spec.md**](docs/toolbox-spec.md) | Creating a third-party toolbox package for PathView |

### Export Options

- **File > Save** - Save complete model as `.pvm`
- **File > Export Python** - Generate standalone Python script
- **Right-click node > Export** - Save individual block/subsystem
- **Right-click canvas > Export SVG** - Export graph as vector image
- **Right-click plot > Download PNG/SVG** - Export plot as image
- **Right-click plot > Export CSV** - Export simulation data as CSV
- **Scope/Spectrum node context menu** - Export simulation data as CSV

---

## Sharing Models via URL

Models can be loaded directly from a URL using query parameters:

```
https://view.pathsim.org/?model=<url>
https://view.pathsim.org/?modelgh=<github-shorthand>
```

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `model` | Direct URL to a `.pvm` or `.json` file | `?model=https://example.com/mymodel.pvm` |
| `modelgh` | GitHub shorthand (expands to raw.githubusercontent.com) | `?modelgh=user/repo/path/to/model.pvm` |

### GitHub Shorthand

The `modelgh` parameter expands to a raw GitHub URL:

```
modelgh=user/repo/examples/demo.pvm
→ https://raw.githubusercontent.com/user/repo/main/examples/demo.pvm
```

### Examples

```
# Load from any URL
https://view.pathsim.org/?model=https://mysite.com/models/feedback.pvm

# Load from GitHub repository
https://view.pathsim.org/?modelgh=pathsim/pathview/static/examples/feedback-system.json
```

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Vite development server |
| `npm run server` | Start Flask backend server (port 5000) |
| `npm run build` | Production build (GitHub Pages) |
| `npm run build:package` | Build pip package (frontend + wheel) |
| `npm run preview` | Preview production build |
| `npm run check` | TypeScript/Svelte type checking |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run extract` | Regenerate all definitions from PathSim |
| `npm run extract:blocks` | Blocks only |
| `npm run extract:events` | Events only |
| `npm run extract:simulation` | Simulation params only |
| `npm run extract:deps` | Dependencies only |
| `npm run extract:validate` | Validate config files |
| `npm run pvm2py -- <file>` | Convert `.pvm` file to standalone Python script |

---

## Node Styling

Nodes are styled based on their category, with CSS-driven shapes and colors.

### Shapes by Category

| Category | Shape | Border Radius |
|----------|-------|---------------|
| Sources | Pill | 20px |
| Dynamic | Rectangle | 4px |
| Algebraic | Rectangle | 4px |
| Mixed | Asymmetric | 12px 4px 12px 4px |
| Recording | Pill | 20px |
| Subsystem | Rectangle | 4px |

Shapes are defined in `src/lib/nodes/shapes/registry.ts` and applied via CSS classes (`.shape-pill`, `.shape-rect`, etc.).

### Colors

- **Default node color**: CSS variable `--accent` (#0070C0 - PathSim blue)
- **Custom colors**: Right-click node → Properties → Color picker (12 colors available)
- **Port colors**: `PORT_COLORS.default` (#969696 gray), customizable per-port

Colors are CSS-driven - see `src/app.css` for variables and `src/lib/utils/colors.ts` for palettes.

### Port Labels

Port labels show the name of each input/output port alongside the node. Toggle globally with `L` key, or per-node via right-click menu.

- **Global toggle**: Press `L` to show/hide port labels for all nodes
- **Per-node override**: Right-click node → "Show Input Labels" / "Show Output Labels"
- **Truncation**: Labels are truncated to 5 characters for compact display
- **SVG export**: Port labels are included when exporting the graph as SVG

### Adding Custom Shapes

1. Register the shape in `src/lib/nodes/shapes/registry.ts`:
   ```typescript
   registerShape({
     id: 'hexagon',
     name: 'Hexagon',
     cssClass: 'shape-hexagon',
     borderRadius: '0px'
   });
   ```

2. Add CSS in `src/app.css` or component styles:
   ```css
   .shape-hexagon {
     clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
   }
   ```

3. Optionally map categories to the new shape:
   ```typescript
   setCategoryShape('MyCategory', 'hexagon');
   ```

---

## Design Principles

1. **Python is first-class** - All node parameters are Python expressions stored as strings and passed verbatim to PathSim. PathSim handles all type checking and validation at runtime.

2. **Subsystems are nested graphs** - The Interface node inside a subsystem mirrors its parent's ports (inverted direction).

3. **No server required by default** - Everything runs client-side via Pyodide. The optional Flask backend enables server-side execution for packages with native dependencies.

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

## Deployment

PathView has two deployment targets:

### GitHub Pages (web)

| Trigger | What happens | Deployed to |
|---------|--------------|-------------|
| Push to `main` | Build with base path `/dev` | [view.pathsim.org/dev/](https://view.pathsim.org/dev/) |
| Release published | Bump `package.json`, build, deploy | [view.pathsim.org/](https://view.pathsim.org/) |
| Manual dispatch | Choose `dev` or `release` | Respective path |

### PyPI (pip package)

| Trigger | What happens | Published to |
|---------|--------------|--------------|
| Release published | Build frontend + wheel, publish | [pypi.org/project/pathview](https://pypi.org/project/pathview/) |
| Manual dispatch | Choose `testpypi` or `pypi` | Respective index |

### How it works

1. Both versions deploy to the `deployment` branch using GitHub Actions
2. Dev builds update only the `/dev` folder, preserving the release at root
3. Release builds update root, preserving `/dev`
4. Version in `package.json` is automatically bumped from the release tag (e.g., `v0.4.0` → `0.4.0`)

### Creating a release

1. Create a GitHub release with a version tag (e.g., `v0.4.0`)
2. The workflow automatically:
   - Updates `package.json` to match the tag
   - Commits the version bump to `main`
   - Builds and deploys to production

---

## License

MIT
