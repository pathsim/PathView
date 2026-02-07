# PathView Model (.pvm) File Specification

**Version:** 1.0.0
**Format:** JSON (UTF-8)

A `.pvm` file is a complete, self-contained description of a PathSim simulation model. It contains the block diagram (nodes, connections, subsystems), event definitions, user-defined Python code, simulation solver settings, and optional canvas annotations.

This document is the authoritative reference for anyone building tools that read or write `.pvm` files (e.g., code generators, importers, analyzers).

---

## Table of Contents

- [1. Root Structure](#1-root-structure)
- [2. Metadata](#2-metadata)
- [3. Graph](#3-graph)
  - [3.1 Nodes](#31-nodes)
  - [3.2 Ports](#32-ports)
  - [3.3 Parameters](#33-parameters)
  - [3.4 Connections](#34-connections)
  - [3.5 Annotations](#35-annotations)
- [4. Subsystems](#4-subsystems)
  - [4.1 Subsystem Node](#41-subsystem-node)
  - [4.2 Interface Node](#42-interface-node)
  - [4.3 Nesting](#43-nesting)
- [5. Events](#5-events)
- [6. Code Context](#6-code-context)
- [7. Simulation Settings](#7-simulation-settings)
- [8. Block Registry](#8-block-registry)
- [9. UI-Only Fields](#9-ui-only-fields)
- [10. Component Files (.blk, .sub)](#10-component-files-blk-sub)
- [11. Worked Example](#11-worked-example)

---

## 1. Root Structure

```json
{
  "version": "1.0.0",
  "metadata": { ... },
  "graph": {
    "nodes": [ ... ],
    "connections": [ ... ],
    "annotations": [ ... ]
  },
  "events": [ ... ],
  "codeContext": {
    "code": "..."
  },
  "simulationSettings": { ... }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | yes | File format version. Currently `"1.0.0"`. |
| `metadata` | object | yes | File metadata (name, timestamps). |
| `graph` | object | yes | The block diagram. |
| `graph.nodes` | array | yes | Block instances. |
| `graph.connections` | array | yes | Wires between ports. |
| `graph.annotations` | array | no | Canvas text labels. UI-only, no simulation semantics. |
| `events` | array | no | Root-level event instances. |
| `codeContext` | object | no | User-defined Python code executed before simulation. |
| `simulationSettings` | object | no | Solver and timestepping configuration. |

---

## 2. Metadata

```json
{
  "created": "2026-01-25T00:44:51.546Z",
  "modified": "2026-01-25T00:44:51.546Z",
  "name": "my-model",
  "description": "Optional description"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `created` | string | yes | ISO 8601 timestamp. |
| `modified` | string | yes | ISO 8601 timestamp. |
| `name` | string | yes | Model display name. |
| `description` | string | no | Free-text description. |

---

## 3. Graph

### 3.1 Nodes

Each node is an instance of a PathSim block class.

```json
{
  "id": "c03d0b76-28b8-4406-8f0a-ef81b732854d",
  "type": "Adder",
  "name": "Difference",
  "position": { "x": 840, "y": 400 },
  "inputs": [ ... ],
  "outputs": [ ... ],
  "params": { "operations": "\"+-\"" },
  "pinnedParams": ["operations"],
  "color": "#0070C0"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique node ID (typically UUID v4). |
| `type` | string | yes | PathSim block class name (e.g., `"Integrator"`, `"Adder"`, `"Scope"`). See [Block Registry](#8-block-registry). Special values: `"Subsystem"`, `"Interface"`. |
| `name` | string | yes | User-editable display name. Used as variable name in code generation (after sanitization). |
| `position` | object | yes | Canvas position `{ x: number, y: number }`. UI-only. |
| `inputs` | array | yes | Input port instances (can be empty `[]`). |
| `outputs` | array | yes | Output port instances (can be empty `[]`). |
| `params` | object | yes | Parameter values. Keys are parameter names, values are Python expressions stored as strings or numbers. See [Parameters](#33-parameters). |
| `pinnedParams` | array | no | Parameter names to show inline on the node. UI-only. |
| `color` | string | no | Custom node color (hex). UI-only. |
| `graph` | object | no | Only present on `Subsystem` nodes. See [Subsystems](#4-subsystems). |

### 3.2 Ports

Ports define the input/output connection points on a node.

```json
{
  "id": "c03d0b76-28b8-4406-8f0a-ef81b732854d-input-0",
  "nodeId": "c03d0b76-28b8-4406-8f0a-ef81b732854d",
  "name": "in 0",
  "direction": "input",
  "index": 0,
  "color": "#969696"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique port ID. Convention: `${nodeId}-${direction}-${index}`. |
| `nodeId` | string | yes | ID of the owning node. |
| `name` | string | yes | Port display name (e.g., `"in 0"`, `"out 0"`, or a custom label). |
| `direction` | string | yes | `"input"` or `"output"`. |
| `index` | number | yes | Zero-based port index within the direction. This is the index used by connections. |
| `color` | string | no | Port color (hex). Default: `"#969696"`. UI-only. |

**Port semantics for code generation:** The `index` field maps directly to PathSim's port indexing. In generated Python code, `node[0]` refers to the first output port, and connections use the syntax `Connection(source[sourcePortIndex], target[targetPortIndex])`.

### 3.3 Parameters

Parameter values are **Python expressions stored as JSON values** (usually strings, sometimes numbers or booleans). They are passed verbatim to PathSim constructors at runtime. PathSim handles all type checking and validation.

```json
{
  "gain": "2.5",
  "initial_value": "x0",
  "operations": "\"+-\"",
  "func": "lambda x: x**2",
  "amplitude": 1,
  "_rotation": 2
}
```

Key rules:
- **String values** are the most common: `"2.5"`, `"x0"`, `"np.pi"`. These are Python expressions.
- **Numeric values** may appear (e.g., `1`, `0.5`). Treat as equivalent to their string form.
- **Values can reference variables** defined in the Code Context (e.g., `"x0"`, `"g"`).
- **Values can be Python expressions**: `"np.random.rand()"`, `"lambda t: np.sin(t)"`.
- **String-typed params** are double-quoted inside the JSON string: `"\"+-\""` represents the Python string `"+-"`.
- **Empty string `""`** means "use PathSim default" (parameter not specified by the user).
- **Keys starting with `_`** are UI-internal (e.g., `_rotation`, `_color`). Code generators should **skip** these.

### 3.4 Connections

A connection is a directed wire from a source output port to a target input port.

```json
{
  "id": "c47a35bc-3030-4699-ab4a-d7aabca093d8",
  "sourceNodeId": "c03d0b76-28b8-4406-8f0a-ef81b732854d",
  "sourcePortIndex": 0,
  "targetNodeId": "353e895d-8dfa-4c17-a752-043d1fc38749",
  "targetPortIndex": 0,
  "waypoints": [ ... ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique connection ID. |
| `sourceNodeId` | string | yes | ID of the source node. |
| `sourcePortIndex` | number | yes | Index into the source node's `outputs` array. |
| `targetNodeId` | string | yes | ID of the target node. |
| `targetPortIndex` | number | yes | Index into the target node's `inputs` array. |
| `waypoints` | array | no | Route control points. UI-only, no simulation semantics. |

**Fan-out:** A single output port can connect to multiple input ports (multiple connections share the same `sourceNodeId`/`sourcePortIndex`).

**No fan-in:** Each input port receives at most one connection.

**Waypoints** (UI-only, can be ignored by code generators):

```json
{
  "id": "wp_001",
  "position": { "x": 150, "y": 100 },
  "isUserWaypoint": true
}
```

### 3.5 Annotations

Canvas text labels with Markdown/LaTeX support. **Purely visual** — no simulation semantics.

```json
{
  "id": "a0d9ddea-c4f8-4363-9c0a-5e19e6c52491",
  "position": { "x": 660, "y": 260 },
  "content": "# Linear Feedback System\n\nA description with $\\LaTeX$.",
  "width": 500,
  "height": 80,
  "color": "#0070C0",
  "fontSize": 12
}
```

Code generators should **ignore** annotations entirely.

---

## 4. Subsystems

Subsystems are nodes that contain a nested block diagram. They enable hierarchical model composition.

### 4.1 Subsystem Node

A node with `"type": "Subsystem"` has a `graph` field containing its internal block diagram:

```json
{
  "id": "sub1",
  "type": "Subsystem",
  "name": "PID Controller",
  "position": { "x": 300, "y": 150 },
  "inputs": [
    { "id": "sub1-input-0", "nodeId": "sub1", "name": "error", "direction": "input", "index": 0 }
  ],
  "outputs": [
    { "id": "sub1-output-0", "nodeId": "sub1", "name": "control", "direction": "output", "index": 0 }
  ],
  "params": {},
  "graph": {
    "nodes": [ ... ],
    "connections": [ ... ],
    "annotations": [],
    "events": []
  }
}
```

The subsystem's external `inputs` and `outputs` define its interface to the parent graph. Internal connections are fully contained in `graph.connections`.

### 4.2 Interface Node

Every subsystem graph contains exactly one `Interface` node. This node acts as the bridge between the subsystem's external ports and its internal graph.

**Port direction is inverted** relative to the parent subsystem:
- Parent subsystem's **inputs** become Interface's **outputs** (data flows into the subsystem, out of the Interface to internal blocks)
- Parent subsystem's **outputs** become Interface's **inputs** (data flows from internal blocks into the Interface, out of the subsystem)

```
Parent graph:                    Inside subsystem:
                                 ┌─────────────────────────┐
  ──[input 0]──> Subsystem       │  Interface ──[output 0]──> internal blocks
                                 │  Interface <──[input 0]── internal blocks
  <──[output 0]── Subsystem      │                           │
                                 └─────────────────────────┘
```

Interface node example:

```json
{
  "id": "iface1",
  "type": "Interface",
  "name": "Interface",
  "position": { "x": 50, "y": 50 },
  "inputs": [
    { "id": "iface1-input-0", "nodeId": "iface1", "name": "control", "direction": "input", "index": 0 }
  ],
  "outputs": [
    { "id": "iface1-output-0", "nodeId": "iface1", "name": "error", "direction": "output", "index": 0 }
  ],
  "params": {}
}
```

### 4.3 Nesting

Subsystems can be nested arbitrarily deep. A subsystem's `graph.nodes` can contain other `Subsystem` nodes, each with their own `graph` and `Interface`.

In PathSim Python code, subsystems map to `Subsystem(blocks=[...], connections=[...])` constructors. The Interface maps to `Interface()`. See `scripts/pvm2py.py` for a reference implementation.

---

## 5. Events

Events define discrete-time behavior (zero-crossing detection, scheduled actions, etc.).

Events can appear in two places:
- **Root level:** `file.events[]` — global events for the top-level simulation.
- **Inside subsystems:** `node.graph.events[]` — events scoped to that subsystem.

```json
{
  "id": "1455e789-9e7d-4139-8a4e-896feecff3d3",
  "type": "pathsim.events.ZeroCrossing",
  "name": "Bounce",
  "position": { "x": 1320, "y": 200 },
  "params": {
    "func_evt": "bounce_detect",
    "func_act": "bounce_resolve"
  },
  "color": "#FF6B6B"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique event ID. |
| `type` | string | yes | Fully qualified event type (e.g., `"pathsim.events.ZeroCrossing"`). The class name is the part after the last `.`. |
| `name` | string | yes | User-defined name. Used as variable name in code generation. |
| `position` | object | yes | Canvas position. UI-only. |
| `params` | object | yes | Event parameters (Python expressions). |
| `color` | string | no | Custom color. UI-only. |

**Common event types:**

| Type | Description | Key Parameters |
|------|-------------|----------------|
| `pathsim.events.ZeroCrossing` | Triggers when a function crosses zero (bidirectional) | `func_evt`, `func_act`, `tolerance` |
| `pathsim.events.ZeroCrossingUp` | Triggers on positive-going zero crossing | `func_evt`, `func_act`, `tolerance` |
| `pathsim.events.ZeroCrossingDown` | Triggers on negative-going zero crossing | `func_evt`, `func_act`, `tolerance` |
| `pathsim.events.Condition` | Triggers when a boolean condition becomes true | `func_evt`, `func_act` |
| `pathsim.events.Schedule` | Time-based periodic event | `func_act`, `t_start`, `t_end`, `t_period` |

Event parameters reference Python callables, typically defined in the Code Context. For example, `"func_evt": "bounce_detect"` references a function `bounce_detect` defined in `codeContext.code`.

---

## 6. Code Context

User-defined Python code that runs before the simulation. Used to define variables, helper functions, and event callbacks.

```json
{
  "code": "# gravity\ng = 9.81\n\n# event callback\ndef bounce_detect(t):\n    return pos.engine.state\n"
}
```

This code is executed in the simulation namespace and can:
- Define variables referenced by node parameters (e.g., a node param `"gain": "g"` references `g = 9.81`)
- Import additional libraries
- Define functions used by events
- Access block instances by their sanitized variable names

The code runs after `import numpy as np` and `import matplotlib.pyplot as plt` are already available.

---

## 7. Simulation Settings

```json
{
  "duration": "10",
  "dt": "0.01",
  "solver": "RKBS32",
  "adaptive": true,
  "atol": "1e-6",
  "rtol": "1e-4",
  "ftol": "1e-9",
  "dt_min": "",
  "dt_max": "0.1",
  "ghostTraces": 6,
  "plotResults": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `duration` | string | yes | Simulation duration. Python expression. |
| `dt` | string | yes | Initial/fixed time step. Python expression. |
| `solver` | string | yes | Solver type (see below). |
| `adaptive` | boolean | yes | Enable adaptive timestepping. |
| `atol` | string | yes | Absolute local truncation error tolerance. Python expression. |
| `rtol` | string | yes | Relative local truncation error tolerance. Python expression. |
| `ftol` | string | yes | Fixed-point iteration convergence tolerance. Python expression. |
| `dt_min` | string | yes | Minimum timestep (adaptive only). Python expression. |
| `dt_max` | string | yes | Maximum timestep (adaptive only). Python expression. |
| `ghostTraces` | number | no | Number of previous results to overlay. UI-only. |
| `plotResults` | boolean | no | Auto-open plot panel after simulation. UI-only. |

**Empty string `""`** means "use PathSim default." Default values used by pvm2py:

| Setting | Default |
|---------|---------|
| `duration` | `10.0` |
| `dt` | `0.01` |
| `solver` | `SSPRK22` |
| `atol` | `1e-6` |
| `rtol` | `1e-3` |
| `ftol` | `1e-12` |
| `dt_min` | `1e-12` |
| `dt_max` | (none) |

**Available solvers:**

| Solver | Type | Description |
|--------|------|-------------|
| `SSPRK22` | Explicit | Strong stability preserving Runge-Kutta (2,2). Default. |
| `RK4` | Explicit | Classic 4th-order Runge-Kutta. Fixed step only. |
| `RKBS32` | Explicit | Bogacki-Shampine (3,2). Adaptive capable. |
| `RKCK54` | Explicit | Cash-Karp (5,4). Adaptive capable. |
| `BDF2` | Implicit | Backward differentiation formula, 2nd order. For stiff systems. |
| `GEAR52A` | Implicit | Gear's method (5,2). For stiff systems. |
| `ESDIRK43` | Implicit | Explicit singly diagonally implicit Runge-Kutta (4,3). |

---

## 8. Block Registry

The file `scripts/generated/registry.json` maps block type names to their PathSim import paths and valid parameter names. It is generated from PathSim source by `npm run extract` (or `python scripts/extract.py`).

```json
{
  "blocks": {
    "Constant": {
      "blockClass": "Constant",
      "importPath": "pathsim.blocks",
      "params": ["value"]
    },
    "Integrator": {
      "blockClass": "Integrator",
      "importPath": "pathsim.blocks",
      "params": ["initial_value"]
    },
    "Adder": {
      "blockClass": "Adder",
      "importPath": "pathsim.blocks",
      "params": ["operations"]
    }
  },
  "events": {
    "ZeroCrossing": {
      "eventClass": "ZeroCrossing",
      "importPath": "pathsim.events",
      "params": ["func_evt", "func_act", "tolerance"]
    }
  }
}
```

**For code generators:** Use this registry to:
1. Resolve `node.type` to the correct PathSim class name and import path
2. Filter `node.params` to only include keys listed in `registry.blocks[type].params` (skip `_`-prefixed keys and any keys not in the list)

The full registry is checked into the repo at `scripts/generated/registry.json`.

---

## 9. UI-Only Fields

These fields are used by the PathView editor for layout and display. Code generators and analysis tools should **ignore** them:

| Field | Where | Description |
|-------|-------|-------------|
| `node.position` | nodes | Canvas x/y position |
| `node.color` | nodes | Custom node color |
| `node.pinnedParams` | nodes | Inline parameter display |
| `port.color` | ports | Port color |
| `connection.waypoints` | connections | Wire routing control points |
| `annotations` | graph | Canvas text labels |
| `event.position` | events | Canvas position |
| `event.color` | events | Custom color |
| `params._rotation` | params | Node rotation (0-3, quarter turns) |
| `params._color` | params | Node color (legacy) |
| `simulationSettings.ghostTraces` | settings | Ghost trace display count |
| `simulationSettings.plotResults` | settings | Auto-open plot panel |

---

## 10. Component Files (.blk, .sub)

PathView also supports single-component files for sharing individual blocks or subsystems.

### Block file (.blk)

```json
{
  "version": "1.0",
  "type": "block",
  "metadata": { "name": "MyBlock", "created": "...", "modified": "..." },
  "content": {
    "node": { ... }
  }
}
```

### Subsystem file (.sub)

```json
{
  "version": "1.0",
  "type": "subsystem",
  "metadata": { "name": "MySubsystem", "created": "...", "modified": "..." },
  "content": {
    "node": { ... }
  }
}
```

The `content.node` field contains a single `NodeInstance` in the same format as nodes in the `.pvm` graph. For subsystems, the node includes the `graph` field.

---

## 11. Worked Example

A minimal model with a step input feeding an integrator, recorded by a scope:

```json
{
  "version": "1.0.0",
  "metadata": {
    "created": "2026-01-01T00:00:00.000Z",
    "modified": "2026-01-01T00:00:00.000Z",
    "name": "step-response"
  },
  "graph": {
    "nodes": [
      {
        "id": "src1",
        "type": "StepSource",
        "name": "Step",
        "position": { "x": 100, "y": 200 },
        "inputs": [],
        "outputs": [
          { "id": "src1-output-0", "nodeId": "src1", "name": "out 0", "direction": "output", "index": 0 }
        ],
        "params": { "amplitude": "1.0", "tau": "1.0" }
      },
      {
        "id": "int1",
        "type": "Integrator",
        "name": "Integrator",
        "position": { "x": 300, "y": 200 },
        "inputs": [
          { "id": "int1-input-0", "nodeId": "int1", "name": "in 0", "direction": "input", "index": 0 }
        ],
        "outputs": [
          { "id": "int1-output-0", "nodeId": "int1", "name": "out 0", "direction": "output", "index": 0 }
        ],
        "params": { "initial_value": "0.0" }
      },
      {
        "id": "scope1",
        "type": "Scope",
        "name": "Output",
        "position": { "x": 500, "y": 200 },
        "inputs": [
          { "id": "scope1-input-0", "nodeId": "scope1", "name": "in 0", "direction": "input", "index": 0 }
        ],
        "outputs": [],
        "params": {}
      }
    ],
    "connections": [
      {
        "id": "conn1",
        "sourceNodeId": "src1",
        "sourcePortIndex": 0,
        "targetNodeId": "int1",
        "targetPortIndex": 0
      },
      {
        "id": "conn2",
        "sourceNodeId": "int1",
        "sourcePortIndex": 0,
        "targetNodeId": "scope1",
        "targetPortIndex": 0
      }
    ]
  },
  "events": [],
  "codeContext": { "code": "" },
  "simulationSettings": {
    "duration": "10",
    "dt": "0.01",
    "solver": "SSPRK22",
    "adaptive": false,
    "atol": "1e-6",
    "rtol": "1e-3",
    "ftol": "1e-12",
    "dt_min": "",
    "dt_max": "",
    "ghostTraces": 0,
    "plotResults": true
  }
}
```

The equivalent Python code generated by `pvm2py`:

```python
from pathsim import Simulation, Connection
from pathsim.blocks import StepSource, Integrator, Scope
from pathsim.solvers import SSPRK22

step = StepSource(amplitude=1.0, tau=1.0)
integrator = Integrator(initial_value=0.0)
output = Scope()

sim = Simulation(
    [step, integrator, output],
    [
        Connection(step[0], integrator[0]),
        Connection(integrator[0], output[0]),
    ],
    Solver=SSPRK22,
    dt=0.01,
)

sim.run(duration=10)
```

---

## Notes for Code Generator Authors

1. **Parameters are Python expressions.** The values in `params` are not guaranteed to be numeric literals. They can be variable references (`"x0"`), expressions (`"np.pi / 4"`), or callables (`"lambda t: np.sin(t)"`). A C code generator will need to either evaluate these at export time or map a supported subset.

2. **The registry is your friend.** Use `scripts/generated/registry.json` to know which parameters are valid for each block type, and to resolve import paths. Parameters not in the registry are either dead or UI-internal.

3. **Scope and Spectrum blocks are recording sinks.** They have inputs but no outputs. A C code generator might map these to data logging or output arrays.

4. **Source blocks have no inputs.** `Constant`, `StepSource`, `SinusoidalSource`, etc., are pure signal sources with only output ports.

5. **Reference implementation.** The `scripts/pvm2py.py` script is a complete, working `.pvm`-to-Python code generator. It demonstrates how to traverse the graph, handle subsystems, resolve imports, and generate simulation code.
