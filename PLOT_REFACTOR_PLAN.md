# Plot Infrastructure Refactoring Plan

## Goal
Separate data processing from rendering to create a unified, maintainable, and high-performance plotting system.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SimulationState                                                          │
│   result: { scopeData, spectrumData, nodeNames }                        │
│   resultHistory: SimulationResult[]                                      │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PlotPanel.svelte                                                         │
│   - Derives scopePlots[], spectrumPlots[] from result                   │
│   - Derives ghostDataMaps from resultHistory                            │
│   - Passes raw data to SignalPlot components                            │
└─────────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│ SignalPlot.svelte       │           │ PlotPreview.svelte      │
│ - Subscribes settings   │           │ - Subscribes settings   │
│ - Resolves styles       │           │ - Resolves styles       │
│ - Checks visibility     │           │ - Checks visibility     │
│ - plotQueue (15fps)     │           │ - previewQueue (10fps)  │
│ - Creates Plotly traces │           │ - Decimates data        │
│ - Renders via Plotly    │           │ - Computes SVG paths    │
└─────────────────────────┘           └─────────────────────────┘
```

### Problems
1. **Duplicated logic**: Style resolution, visibility checks, ghost opacity in both components
2. **Two queues**: Different tick rates, duplicated queue implementation
3. **Coupled processing & rendering**: Can't reuse processed data
4. **Inconsistencies**: Different ghost opacity ranges, color handling differences

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SimulationState                                                          │
│   result: { scopeData, spectrumData, nodeNames }                        │
│   resultHistory: SimulationResult[]                                      │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ plotDataStore (NEW)                                                      │
│   - Subscribes to simulationState + plotSettingsStore                   │
│   - Single renderQueue (configurable fps)                               │
│   - Processes all plots: style resolution, visibility, decimation       │
│   - Outputs: Map<nodeId, ProcessedPlotData>                             │
└─────────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│ SignalPlot.svelte       │           │ PlotPreview.svelte      │
│ - Receives processed    │           │ - Receives processed    │
│   data as prop          │           │   data as prop          │
│ - Maps to Plotly format │           │ - Maps to SVG paths     │
│ - Renders (no queue)    │           │ - Renders (no queue)    │
└─────────────────────────┘           └─────────────────────────┘
```

---

## New File Structure

```
src/lib/plotting/
├── core/
│   ├── types.ts           # All shared types and interfaces
│   ├── constants.ts       # Colors, defaults, configuration
│   └── utils.ts           # Pure utility functions
│
├── processing/
│   ├── renderQueue.ts     # Single unified queue (factory)
│   ├── dataProcessor.ts   # Data processing logic
│   └── plotDataStore.ts   # Reactive store combining everything
│
├── renderers/
│   ├── plotly.ts          # Plotly trace/layout builders
│   └── svg.ts             # SVG path generation
│
└── index.ts               # Public API exports
```

---

## Phase 1: Core Types & Constants

### 1.1 Create `src/lib/plotting/core/types.ts`

```typescript
// ============================================================
// STYLE TYPES (moved from plotSettings.ts)
// ============================================================

export type LineStyle = 'solid' | 'dash' | 'dot';
export type MarkerStyle = 'circle' | 'square' | 'triangle-up';
export type AxisScale = 'linear' | 'log';

export interface TraceStyle {
  lineStyle: LineStyle | null;
  markerStyle: MarkerStyle | null;
  color: string;
  visible: boolean;
}

export interface LayoutStyle {
  xAxisScale: AxisScale;
  yAxisScale: AxisScale;
  showLegend: boolean;
}

// ============================================================
// RAW DATA TYPES (input from simulation)
// ============================================================

export interface RawScopeData {
  time: number[];
  signals: number[][];
  labels?: string[];
}

export interface RawSpectrumData {
  frequency: number[];
  magnitude: number[][];
  labels?: string[];
}

export type RawPlotData = RawScopeData | RawSpectrumData;

// ============================================================
// PROCESSED DATA TYPES (output from processor)
// ============================================================

export interface ProcessedTrace {
  // Identity
  signalIndex: number;
  label: string;

  // Data (full resolution for Plotly)
  x: number[];
  y: number[];

  // Data (decimated for previews)
  xDecimated: number[];
  yDecimated: number[];

  // Resolved style
  style: TraceStyle;

  // Ghost properties (null for main traces)
  ghost: {
    index: number;      // 0 = most recent ghost
    total: number;      // total ghost count
    opacity: number;    // pre-calculated opacity
  } | null;
}

export interface ProcessedPlot {
  // Identity
  nodeId: string;
  type: 'scope' | 'spectrum';
  title: string;

  // All traces (ghosts first, then main)
  traces: ProcessedTrace[];

  // Layout settings
  layout: LayoutStyle;

  // Pre-computed bounds (for consistent axis scaling)
  bounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };

  // Spectrum-specific (for tick labels)
  frequencies?: number[];
}

// ============================================================
// STORE STATE TYPE
// ============================================================

export interface PlotDataState {
  plots: Map<string, ProcessedPlot>;  // keyed by nodeId
  isStreaming: boolean;
  lastUpdateTime: number;
}
```

### 1.2 Create `src/lib/plotting/core/constants.ts`

```typescript
// ============================================================
// RENDER QUEUE CONFIGURATION
// ============================================================

export const RENDER_QUEUE_FPS = 15;  // Single tick rate for all rendering
export const RENDER_QUEUE_INTERVAL = 1000 / RENDER_QUEUE_FPS;

// ============================================================
// DECIMATION CONFIGURATION
// ============================================================

export const PREVIEW_TARGET_POINTS = 400;  // ~800 points after min-max

// ============================================================
// GHOST TRACE CONFIGURATION
// ============================================================

export const GHOST_OPACITY_MAX = 0.5;   // Most recent ghost
export const GHOST_OPACITY_MIN = 0.2;   // Oldest ghost

export function calculateGhostOpacity(ghostIndex: number, totalGhosts: number): number {
  if (totalGhosts === 1) return GHOST_OPACITY_MAX;
  const range = GHOST_OPACITY_MAX - GHOST_OPACITY_MIN;
  return GHOST_OPACITY_MAX - (ghostIndex / (totalGhosts - 1)) * range;
}

// ============================================================
// COLORS
// ============================================================

export const TRACE_COLORS = [
  '#E57373', // Red
  '#81C784', // Green
  '#64B5F6', // Blue
  '#BA68C8', // Purple
  '#4DD0E1', // Cyan
  '#FFB74D', // Orange
  '#F06292', // Pink
  '#4DB6AC', // Teal
  '#90A4AE', // Grey
];

export function getTraceColor(index: number, accentColor: string): string {
  if (index === 0) return accentColor;
  return TRACE_COLORS[(index - 1) % TRACE_COLORS.length];
}

// ============================================================
// LINE DASH PATTERNS
// ============================================================

import type { LineStyle } from './types';

export const LINE_DASH_PLOTLY: Record<LineStyle, string> = {
  solid: 'solid',
  dash: 'dash',
  dot: 'dot',
};

export const LINE_DASH_SVG: Record<LineStyle, string> = {
  solid: '',
  dash: '6,3',
  dot: '2,2',
};

// ============================================================
// MARKER SYMBOLS
// ============================================================

import type { MarkerStyle } from './types';

export const MARKER_SYMBOL_PLOTLY: Record<MarkerStyle, string> = {
  circle: 'circle',
  square: 'square',
  'triangle-up': 'triangle-up',
};
```

### 1.3 Create `src/lib/plotting/core/utils.ts`

```typescript
import type { TraceStyle } from './types';

/**
 * Check if a trace should be rendered (has line or marker)
 */
export function isTraceVisible(style: TraceStyle): boolean {
  return style.lineStyle !== null || style.markerStyle !== null;
}

/**
 * Min-max decimation: preserves peaks and valleys
 * O(n) single pass, outputs ~2*buckets points
 */
export function decimateMinMax(
  x: number[],
  y: number[],
  targetBuckets: number
): { x: number[]; y: number[]; xMin: number; xMax: number; yMin: number; yMax: number } {
  const len = x.length;

  if (len === 0) {
    return { x: [], y: [], xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  }

  // If data is small enough, return as-is with bounds
  if (len <= targetBuckets * 2) {
    let yMin = y[0], yMax = y[0];
    for (let i = 1; i < len; i++) {
      if (y[i] < yMin) yMin = y[i];
      if (y[i] > yMax) yMax = y[i];
    }
    return { x, y, xMin: x[0], xMax: x[len - 1], yMin, yMax };
  }

  const bucketSize = len / targetBuckets;
  const outX: number[] = [];
  const outY: number[] = [];
  let globalYMin = Infinity, globalYMax = -Infinity;

  for (let bucket = 0; bucket < targetBuckets; bucket++) {
    const startIdx = Math.floor(bucket * bucketSize);
    const endIdx = Math.floor((bucket + 1) * bucketSize);

    let minIdx = startIdx, maxIdx = startIdx;
    let minVal = y[startIdx], maxVal = y[startIdx];

    for (let i = startIdx + 1; i < endIdx && i < len; i++) {
      if (y[i] < minVal) { minVal = y[i]; minIdx = i; }
      if (y[i] > maxVal) { maxVal = y[i]; maxIdx = i; }
    }

    // Add in chronological order
    if (minIdx <= maxIdx) {
      outX.push(x[minIdx]); outY.push(y[minIdx]);
      if (maxIdx !== minIdx) { outX.push(x[maxIdx]); outY.push(y[maxIdx]); }
    } else {
      outX.push(x[maxIdx]); outY.push(y[maxIdx]);
      outX.push(x[minIdx]); outY.push(y[minIdx]);
    }

    if (minVal < globalYMin) globalYMin = minVal;
    if (maxVal > globalYMax) globalYMax = maxVal;
  }

  // Always include last point
  if (outX[outX.length - 1] !== x[len - 1]) {
    outX.push(x[len - 1]);
    outY.push(y[len - 1]);
  }

  return {
    x: outX,
    y: outY,
    xMin: x[0],
    xMax: x[len - 1],
    yMin: globalYMin,
    yMax: globalYMax,
  };
}

/**
 * Compute bounds from multiple data arrays
 */
export function computeBounds(
  dataArrays: { x: number[]; y: number[] }[]
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;

  for (const { x, y } of dataArrays) {
    for (let i = 0; i < x.length; i++) {
      if (x[i] < xMin) xMin = x[i];
      if (x[i] > xMax) xMax = x[i];
      if (y[i] < yMin) yMin = y[i];
      if (y[i] > yMax) yMax = y[i];
    }
  }

  // Handle empty/invalid bounds
  if (!isFinite(xMin)) xMin = 0;
  if (!isFinite(xMax)) xMax = 1;
  if (!isFinite(yMin)) yMin = 0;
  if (!isFinite(yMax)) yMax = 1;

  return { xMin, xMax, yMin, yMax };
}
```

---

## Phase 2: Unified Render Queue

### 2.1 Create `src/lib/plotting/processing/renderQueue.ts`

```typescript
type RenderTask = () => void;

interface RenderQueueOptions {
  fps: number;
  name?: string;  // For debugging
}

interface RenderQueue {
  enqueue: (id: symbol, task: RenderTask) => void;
  cancel: (id: symbol) => void;
  isVisible: () => boolean;
  destroy: () => void;
}

/**
 * Factory function to create a render queue with configurable FPS
 */
export function createRenderQueue(options: RenderQueueOptions): RenderQueue {
  const { fps, name = 'RenderQueue' } = options;
  const minInterval = 1000 / fps;

  const taskQueue = new Map<symbol, RenderTask>();
  let rafId: number | null = null;
  let lastProcessTime = 0;
  let visible = true;

  function handleVisibilityChange() {
    visible = document.visibilityState === 'visible';
    if (visible && taskQueue.size > 0 && rafId === null) {
      scheduleProcess();
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  function scheduleProcess() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(process);
  }

  function process(timestamp: number) {
    rafId = null;

    if (!visible || taskQueue.size === 0) return;

    // Throttle to target FPS
    if (timestamp - lastProcessTime < minInterval) {
      scheduleProcess();
      return;
    }

    lastProcessTime = timestamp;

    // Process all queued tasks in one batch
    const tasks = Array.from(taskQueue.values());
    taskQueue.clear();

    for (const task of tasks) {
      try {
        task();
      } catch (e) {
        console.error(`[${name}] Task error:`, e);
      }
    }

    // If new tasks were added during processing, schedule again
    if (taskQueue.size > 0) {
      scheduleProcess();
    }
  }

  return {
    enqueue(id: symbol, task: RenderTask) {
      taskQueue.set(id, task);
      if (visible) scheduleProcess();
    },

    cancel(id: symbol) {
      taskQueue.delete(id);
    },

    isVisible() {
      return visible;
    },

    destroy() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      taskQueue.clear();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    },
  };
}

// Singleton instance for the application
import { RENDER_QUEUE_FPS } from '../core/constants';

export const plotRenderQueue = createRenderQueue({
  fps: RENDER_QUEUE_FPS,
  name: 'PlotRenderQueue',
});
```

---

## Phase 3: Data Processor

### 3.1 Create `src/lib/plotting/processing/dataProcessor.ts`

```typescript
import type {
  RawScopeData,
  RawSpectrumData,
  ProcessedPlot,
  ProcessedTrace,
  TraceStyle,
  LayoutStyle,
} from '../core/types';
import {
  calculateGhostOpacity,
  getTraceColor,
  PREVIEW_TARGET_POINTS,
} from '../core/constants';
import { decimateMinMax, computeBounds, isTraceVisible } from '../core/utils';
import type { TraceSettings, BlockSettings } from '$lib/stores/plotSettings';

interface ProcessPlotOptions {
  nodeId: string;
  type: 'scope' | 'spectrum';
  title: string;
  data: RawScopeData | RawSpectrumData | null;
  ghostData: (RawScopeData | RawSpectrumData)[];
  traceSettings: (signalIndex: number) => TraceSettings;
  blockSettings: BlockSettings;
  accentColor: string;
}

/**
 * Process a single plot's data into render-ready format
 */
export function processPlot(options: ProcessPlotOptions): ProcessedPlot {
  const {
    nodeId,
    type,
    title,
    data,
    ghostData,
    traceSettings,
    blockSettings,
    accentColor,
  } = options;

  const traces: ProcessedTrace[] = [];
  const allDataForBounds: { x: number[]; y: number[] }[] = [];
  const totalGhosts = ghostData.length;

  // Helper to extract x/y arrays from raw data
  function extractXY(raw: RawScopeData | RawSpectrumData): { x: number[]; ys: number[][]; labels?: string[] } {
    if (type === 'scope') {
      const d = raw as RawScopeData;
      return { x: d.time || [], ys: d.signals || [], labels: d.labels };
    } else {
      const d = raw as RawSpectrumData;
      // Use indices for x-axis (equal spacing)
      const x = d.frequency ? Array.from({ length: d.frequency.length }, (_, i) => i) : [];
      return { x, ys: d.magnitude || [], labels: d.labels };
    }
  }

  // Helper to create a processed trace
  function createTrace(
    signalIndex: number,
    x: number[],
    y: number[],
    label: string,
    ghostInfo: ProcessedTrace['ghost']
  ): ProcessedTrace | null {
    const settings = traceSettings(signalIndex);
    const color = getTraceColor(signalIndex, accentColor);

    const style: TraceStyle = {
      lineStyle: settings.lineStyle,
      markerStyle: settings.markerStyle,
      color,
      visible: settings.lineStyle !== null || settings.markerStyle !== null,
    };

    // Skip invisible traces
    if (!style.visible) return null;

    // Decimate for preview
    const decimated = decimateMinMax(x, y, PREVIEW_TARGET_POINTS);

    return {
      signalIndex,
      label,
      x,
      y,
      xDecimated: decimated.x,
      yDecimated: decimated.y,
      style,
      ghost: ghostInfo,
    };
  }

  // Process ghost data (oldest to newest, so newest renders on top)
  for (let ghostIdx = totalGhosts - 1; ghostIdx >= 0; ghostIdx--) {
    const ghost = ghostData[ghostIdx];
    if (!ghost) continue;

    const { x, ys, labels } = extractXY(ghost);
    if (x.length === 0) continue;

    const opacity = calculateGhostOpacity(ghostIdx, totalGhosts);

    for (let sigIdx = 0; sigIdx < ys.length; sigIdx++) {
      const y = ys[sigIdx];
      if (!y || y.length === 0) continue;

      const label = labels?.[sigIdx] ?? `port ${sigIdx}`;
      const trace = createTrace(sigIdx, x, y, label, {
        index: ghostIdx,
        total: totalGhosts,
        opacity,
      });

      if (trace) {
        traces.push(trace);
        allDataForBounds.push({ x, y });
      }
    }
  }

  // Process main data
  if (data) {
    const { x, ys, labels } = extractXY(data);
    if (x.length > 0) {
      for (let sigIdx = 0; sigIdx < ys.length; sigIdx++) {
        const y = ys[sigIdx];
        if (!y || y.length === 0) continue;

        const label = labels?.[sigIdx] ?? `port ${sigIdx}`;
        const trace = createTrace(sigIdx, x, y, label, null);

        if (trace) {
          traces.push(trace);
          allDataForBounds.push({ x, y });
        }
      }
    }
  }

  // Compute bounds from all data
  const bounds = computeBounds(allDataForBounds);

  // Extract frequencies for spectrum tick labels
  let frequencies: number[] | undefined;
  if (type === 'spectrum' && data) {
    frequencies = (data as RawSpectrumData).frequency;
  }

  return {
    nodeId,
    type,
    title,
    traces,
    layout: {
      xAxisScale: blockSettings.xAxisScale,
      yAxisScale: blockSettings.yAxisScale,
      showLegend: blockSettings.showLegend,
    },
    bounds,
    frequencies,
  };
}
```

---

## Phase 4: Plot Data Store

### 4.1 Create `src/lib/plotting/processing/plotDataStore.ts`

```typescript
import { writable, derived, get } from 'svelte/store';
import { simulationState, type SimulationResult } from '$lib/pyodide/bridge';
import { plotSettingsStore } from '$lib/stores/plotSettings';
import { settingsStore } from '$lib/stores/settings';
import { processPlot } from './dataProcessor';
import { plotRenderQueue } from './renderQueue';
import type { ProcessedPlot, PlotDataState } from '../core/types';

// Internal state
const internal = writable<PlotDataState>({
  plots: new Map(),
  isStreaming: false,
  lastUpdateTime: 0,
});

// Queue ID for this store
const queueId = Symbol('plotDataStore');

// Cached CSS variable for accent color
let accentColor = '#0070C0';
function updateAccentColor() {
  if (typeof document !== 'undefined') {
    accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent').trim() || '#0070C0';
  }
}

// Process all plots from current simulation state
function processAllPlots(
  result: SimulationResult | null,
  resultHistory: SimulationResult[],
  ghostTraceCount: number
): Map<string, ProcessedPlot> {
  const plots = new Map<string, ProcessedPlot>();

  if (!result) return plots;

  updateAccentColor();

  // Helper to get node name
  const getNodeName = (id: string, fallback: string) =>
    result.nodeNames?.[id] || fallback;

  // Helper to get ghost data for a node
  const getGhostData = (nodeId: string, type: 'scope' | 'spectrum') => {
    const history = resultHistory.slice(0, ghostTraceCount);
    return history
      .map(r => type === 'scope' ? r.scopeData?.[nodeId] : r.spectrumData?.[nodeId])
      .filter(Boolean);
  };

  // Process scope plots
  if (result.scopeData) {
    for (const [nodeId, data] of Object.entries(result.scopeData)) {
      const processed = processPlot({
        nodeId,
        type: 'scope',
        title: getNodeName(nodeId, 'Scope'),
        data,
        ghostData: getGhostData(nodeId, 'scope'),
        traceSettings: (idx) => plotSettingsStore.getTraceSettings(`${nodeId}-${idx}`),
        blockSettings: plotSettingsStore.getBlockSettings(nodeId),
        accentColor,
      });
      plots.set(nodeId, processed);
    }
  }

  // Process spectrum plots
  if (result.spectrumData) {
    for (const [nodeId, data] of Object.entries(result.spectrumData)) {
      // Initialize spectrum blocks with log Y-axis if not set
      const existingSettings = get(plotSettingsStore).blocks[nodeId];
      if (!existingSettings) {
        plotSettingsStore.setBlockYAxisScale(nodeId, 'log');
      }

      const processed = processPlot({
        nodeId,
        type: 'spectrum',
        title: getNodeName(nodeId, 'Spectrum'),
        data,
        ghostData: getGhostData(nodeId, 'spectrum'),
        traceSettings: (idx) => plotSettingsStore.getTraceSettings(`${nodeId}-${idx}`),
        blockSettings: plotSettingsStore.getBlockSettings(nodeId),
        accentColor,
      });
      plots.set(nodeId, processed);
    }
  }

  return plots;
}

// Schedule processing when inputs change
let lastResult: SimulationResult | null = null;
let lastHistory: SimulationResult[] = [];
let lastGhostCount = 0;
let lastSettingsVersion = 0;

function scheduleProcessing() {
  plotRenderQueue.enqueue(queueId, () => {
    const simState = get(simulationState);
    const settings = get(settingsStore);
    const ghostCount = settings.ghostTraces ?? 0;

    const plots = processAllPlots(
      simState.result,
      simState.resultHistory,
      ghostCount
    );

    internal.set({
      plots,
      isStreaming: simState.phase === 'running',
      lastUpdateTime: Date.now(),
    });
  });
}

// Subscribe to all input sources
simulationState.subscribe((state) => {
  if (state.result !== lastResult || state.resultHistory !== lastHistory) {
    lastResult = state.result;
    lastHistory = state.resultHistory;
    scheduleProcessing();
  }
});

settingsStore.subscribe((state) => {
  if ((state.ghostTraces ?? 0) !== lastGhostCount) {
    lastGhostCount = state.ghostTraces ?? 0;
    scheduleProcessing();
  }
});

plotSettingsStore.subscribe(() => {
  // Settings changed, reprocess
  scheduleProcessing();
});

// Public API
export const plotDataStore = {
  subscribe: internal.subscribe,

  /**
   * Get processed data for a specific plot
   */
  getPlot(nodeId: string): ProcessedPlot | undefined {
    return get(internal).plots.get(nodeId);
  },

  /**
   * Get all processed plots as an array
   */
  getAllPlots(): ProcessedPlot[] {
    return Array.from(get(internal).plots.values());
  },

  /**
   * Check if currently streaming
   */
  isStreaming(): boolean {
    return get(internal).isStreaming;
  },
};
```

---

## Phase 5: Renderers

### 5.1 Create `src/lib/plotting/renderers/plotly.ts`

```typescript
import type { ProcessedPlot, ProcessedTrace } from '../core/types';
import { LINE_DASH_PLOTLY, MARKER_SYMBOL_PLOTLY } from '../core/constants';

/**
 * Convert ProcessedTrace to Plotly ScatterData
 */
export function toPlotlyTrace(
  trace: ProcessedTrace,
  useDecimated: boolean = false
): Partial<Plotly.ScatterData> {
  const { style, ghost, signalIndex, label } = trace;
  const x = useDecimated ? trace.xDecimated : trace.x;
  const y = useDecimated ? trace.yDecimated : trace.y;

  // Determine mode
  const showLines = style.lineStyle !== null;
  const showMarkers = style.markerStyle !== null;
  let mode: 'lines' | 'markers' | 'lines+markers' = 'lines';
  if (showLines && showMarkers) mode = 'lines+markers';
  else if (showMarkers) mode = 'markers';

  const plotlyTrace: Partial<Plotly.ScatterData> = {
    x,
    y,
    type: 'scatter',
    mode,
    name: label,
    legendgroup: `signal-${signalIndex}`,
  };

  // Ghost traces
  if (ghost) {
    plotlyTrace.opacity = ghost.opacity;
    plotlyTrace.showlegend = false;
    plotlyTrace.hoverinfo = 'skip';
  } else {
    // Main trace hover template
    plotlyTrace.hovertemplate =
      `<b style="color:${style.color}">${label}</b><br>` +
      `x = %{x:.4g}<br>y = %{y:.4g}<extra></extra>`;
  }

  // Line config
  if (showLines && style.lineStyle) {
    plotlyTrace.line = {
      color: style.color,
      width: ghost ? 1 : 1.5,
      dash: LINE_DASH_PLOTLY[style.lineStyle],
    };
  }

  // Marker config
  if (showMarkers && style.markerStyle) {
    plotlyTrace.marker = {
      symbol: MARKER_SYMBOL_PLOTLY[style.markerStyle],
      size: ghost ? 5 : 6,
      color: style.color,
    };
    plotlyTrace.cliponaxis = false;
  }

  return plotlyTrace;
}

/**
 * Build Plotly layout from ProcessedPlot
 */
export function toPlotlyLayout(
  plot: ProcessedPlot,
  baseLayout: Partial<Plotly.Layout>
): Partial<Plotly.Layout> {
  const { type, title, layout, frequencies } = plot;

  const xAxisTitle = type === 'scope' ? 'Time (s)' : 'Frequency (Hz)';
  const yAxisTitle = title;

  const result: Partial<Plotly.Layout> = {
    ...baseLayout,
    xaxis: {
      ...baseLayout.xaxis,
      title: { text: xAxisTitle, font: { size: 11 }, standoff: 10 },
      type: layout.xAxisScale,
    },
    yaxis: {
      ...baseLayout.yaxis,
      title: { text: yAxisTitle, font: { size: 11 }, standoff: 5 },
      type: layout.yAxisScale,
    },
    showlegend: layout.showLegend,
    hovermode: 'closest',
  };

  // Spectrum: add frequency tick labels
  if (type === 'spectrum' && frequencies && frequencies.length > 0) {
    const numTicks = Math.min(6, frequencies.length);
    const step = Math.max(1, Math.floor((frequencies.length - 1) / (numTicks - 1)));
    const tickvals: number[] = [];
    const ticktext: string[] = [];

    for (let i = 0; i < frequencies.length; i += step) {
      tickvals.push(i);
      ticktext.push(formatFrequency(frequencies[i]));
    }
    if (tickvals[tickvals.length - 1] !== frequencies.length - 1) {
      tickvals.push(frequencies.length - 1);
      ticktext.push(formatFrequency(frequencies[frequencies.length - 1]));
    }

    result.xaxis = { ...result.xaxis, tickvals, ticktext, tickangle: 0 };
  }

  return result;
}

function formatFrequency(freq: number): string {
  if (freq >= 1e6) return (freq / 1e6).toFixed(1) + 'M';
  if (freq >= 1e3) return (freq / 1e3).toFixed(1) + 'k';
  if (freq >= 1) return freq.toFixed(1);
  return freq.toExponential(1);
}
```

### 5.2 Create `src/lib/plotting/renderers/svg.ts`

```typescript
import type { ProcessedPlot, ProcessedTrace } from '../core/types';
import { LINE_DASH_SVG } from '../core/constants';

export interface SVGPathData {
  d: string;
  color: string;
  opacity: number;
  strokeWidth: number;
  dasharray: string;
}

/**
 * Convert ProcessedPlot to SVG path data for preview rendering
 */
export function toSVGPaths(
  plot: ProcessedPlot,
  width: number,
  height: number,
  padding: number
): SVGPathData[] {
  const { traces, bounds } = plot;

  if (traces.length === 0) return [];

  const { xMin, xMax, yMin, yMax } = bounds;
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  return traces.map((trace) => {
    const { xDecimated, yDecimated, style, ghost } = trace;

    // Build SVG path
    const pathPoints: string[] = [];
    for (let i = 0; i < xDecimated.length; i++) {
      const x = padding + ((xDecimated[i] - xMin) / xRange) * plotWidth;
      const y = height - padding - ((yDecimated[i] - yMin) / yRange) * plotHeight;
      pathPoints.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return {
      d: pathPoints.join(' '),
      color: style.color,
      opacity: ghost?.opacity ?? 1,
      strokeWidth: ghost ? 0.7 : 1,
      dasharray: style.lineStyle ? LINE_DASH_SVG[style.lineStyle] : '',
    };
  });
}
```

---

## Phase 6: Update Components

### 6.1 Simplify SignalPlot.svelte

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { plotDataStore } from '$lib/plotting/processing/plotDataStore';
  import { toPlotlyTrace, toPlotlyLayout } from '$lib/plotting/renderers/plotly';
  import { getBaseLayout, plotConfig } from '$lib/plotting/core/constants';
  import type { ProcessedPlot } from '$lib/plotting/core/types';

  interface Props {
    nodeId: string;
  }

  let { nodeId }: Props = $props();

  let plotDiv: HTMLDivElement;
  let Plotly: typeof import('plotly.js-dist-min') | null = null;
  let resizeObserver: ResizeObserver | null = null;

  // Get processed data from store
  let processedPlot = $state<ProcessedPlot | null>(null);
  let isStreaming = $state(false);

  const unsubscribe = plotDataStore.subscribe((state) => {
    processedPlot = state.plots.get(nodeId) ?? null;
    isStreaming = state.isStreaming;

    if (Plotly && plotDiv && processedPlot) {
      renderPlot();
    }
  });

  onMount(async () => {
    Plotly = await import('plotly.js-dist-min');
    if (processedPlot) renderPlot();

    resizeObserver = new ResizeObserver(() => {
      if (Plotly && plotDiv) Plotly.Plots.resize(plotDiv);
    });
    resizeObserver.observe(plotDiv);
  });

  onDestroy(() => {
    unsubscribe();
    resizeObserver?.disconnect();
    if (Plotly && plotDiv) Plotly.purge(plotDiv);
  });

  function renderPlot() {
    if (!Plotly || !plotDiv || !processedPlot) return;

    const traces = processedPlot.traces.map(t => toPlotlyTrace(t));
    const layout = toPlotlyLayout(processedPlot, getBaseLayout());

    if (traces.length === 0) {
      showEmptyPlot(layout);
    } else {
      Plotly.react(plotDiv, traces, layout, plotConfig);
    }
  }

  function showEmptyPlot(layout: Partial<Plotly.Layout>) {
    if (!Plotly || !plotDiv) return;
    layout.annotations = [{
      text: 'No data',
      xref: 'paper', yref: 'paper',
      x: 0.5, y: 0.5,
      showarrow: false,
      font: { size: 14, color: 'var(--text-disabled)' }
    }];
    Plotly.newPlot(plotDiv, [], layout, plotConfig);
  }
</script>

<div class="plot-container">
  <div class="plot" bind:this={plotDiv}></div>
</div>
```

### 6.2 Simplify PlotPreview.svelte

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { plotDataStore } from '$lib/plotting/processing/plotDataStore';
  import { toSVGPaths, type SVGPathData } from '$lib/plotting/renderers/svg';
  import type { ProcessedPlot } from '$lib/plotting/core/types';

  interface Props {
    nodeId: string;
  }

  let { nodeId }: Props = $props();

  const width = 224;
  const height = 96;
  const padding = 8;

  let paths = $state<SVGPathData[]>([]);

  const unsubscribe = plotDataStore.subscribe((state) => {
    const plot = state.plots.get(nodeId);
    if (plot) {
      paths = toSVGPaths(plot, width, height, padding);
    } else {
      paths = [];
    }
  });

  onDestroy(() => {
    unsubscribe();
  });

  const hasData = $derived(paths.length > 0);
</script>

<div class="preview-container">
  <svg {width} {height} viewBox="0 0 {width} {height}">
    <rect x="0" y="0" {width} {height} rx="4" class="plot-bg" />

    {#if hasData}
      {#each paths as path}
        <path
          d={path.d}
          fill="none"
          stroke={path.color}
          stroke-width={path.strokeWidth}
          stroke-dasharray={path.dasharray}
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity={path.opacity}
        />
      {/each}
    {:else}
      <text x={width / 2} y={height / 2 + 4} text-anchor="middle" class="no-data-text">
        No data
      </text>
    {/if}
  </svg>
</div>
```

---

## Phase 7: Migration Steps

### Step 1: Create Core Module (non-breaking)
- [ ] Create `src/lib/plotting/core/types.ts`
- [ ] Create `src/lib/plotting/core/constants.ts`
- [ ] Create `src/lib/plotting/core/utils.ts`
- [ ] Create `src/lib/plotting/index.ts` with exports
- [ ] Verify build passes

### Step 2: Create Unified Queue (non-breaking)
- [ ] Create `src/lib/plotting/processing/renderQueue.ts`
- [ ] Add tests for queue behavior
- [ ] Verify build passes

### Step 3: Create Data Processor (non-breaking)
- [ ] Create `src/lib/plotting/processing/dataProcessor.ts`
- [ ] Add tests for data processing
- [ ] Verify build passes

### Step 4: Create Plot Data Store (non-breaking)
- [ ] Create `src/lib/plotting/processing/plotDataStore.ts`
- [ ] Verify store reacts to simulation state changes
- [ ] Verify build passes

### Step 5: Create Renderers (non-breaking)
- [ ] Create `src/lib/plotting/renderers/plotly.ts`
- [ ] Create `src/lib/plotting/renderers/svg.ts`
- [ ] Verify build passes

### Step 6: Migrate SignalPlot (breaking)
- [ ] Update SignalPlot.svelte to use new architecture
- [ ] Remove old plotQueue.ts usage
- [ ] Test streaming behavior
- [ ] Test all plot types and settings
- [ ] Verify build passes

### Step 7: Migrate PlotPreview (breaking)
- [ ] Update PlotPreview.svelte to use new architecture
- [ ] Remove old previewQueue.ts usage
- [ ] Test preview rendering
- [ ] Verify build passes

### Step 8: Cleanup
- [ ] Delete old `plotQueue.ts`
- [ ] Delete old `previewQueue.ts`
- [ ] Remove unused code from `plotUtils.ts`
- [ ] Update imports throughout codebase
- [ ] Final verification and testing

---

## Testing Checklist

### Functional Tests
- [ ] Scope plots render correctly
- [ ] Spectrum plots render correctly
- [ ] Ghost traces appear with correct opacity
- [ ] Line styles (solid/dash/dot) work
- [ ] Marker styles (circle/square/triangle) work
- [ ] Hidden traces (both null) don't render
- [ ] Legend toggle works per-block
- [ ] Axis scale toggle (linear/log) works
- [ ] Spectrum defaults to log Y-axis
- [ ] Previews match main plot styling

### Streaming Tests
- [ ] Streaming updates are smooth (no stuttering)
- [ ] extendTraces optimization still works for scope
- [ ] Preview updates during streaming
- [ ] Stopping/restarting stream works correctly

### Performance Tests
- [ ] Memory usage is stable during long simulations
- [ ] CPU usage is reasonable during streaming
- [ ] No visible frame drops at 15 FPS target
- [ ] Tab visibility pausing works

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking streaming optimization | Keep extendTraces logic in SignalPlot, fed by processed data |
| Performance regression | Benchmark before/after, keep old code as fallback |
| State synchronization bugs | Extensive testing of reactive updates |
| Migration takes too long | Do in phases, each phase independently deployable |

---

## Success Criteria

1. **Single queue**: One render queue with configurable FPS
2. **Separated concerns**: Data processing is independent of rendering
3. **No duplication**: Ghost opacity, visibility checks, etc. defined once
4. **Consistent visuals**: Previews exactly match main plot styling
5. **Maintained performance**: Streaming is as smooth as before
6. **Cleaner code**: Components are simpler, logic is centralized
7. **Testable**: Core functions can be unit tested
