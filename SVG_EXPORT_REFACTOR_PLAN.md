# SVG Export Refactoring Plan

## Goals

1. **Single source of truth** - No duplication between live canvas and SVG export
2. **Pure rendering** - No DOM scraping, works from graph state alone
3. **Professional output** - Clean, standalone SVGs for docs/presentations
4. **Reuse existing systems** - Shape registry, color definitions, etc.

---

## Current State

### What exists:
- `src/lib/utils/svgExport.ts` - Current exporter (DOM scraping approach)
- `src/lib/nodes/shapes/registry.ts` - Shape definitions (borderRadius, cssClass)
- `src/lib/utils/colors.ts` - Color palette definitions
- Handle paths in `BaseNode.svelte` CSS (4 rotations × 2 layers)

### Problems:
1. **Handle paths duplicated** - CSS clip-paths in BaseNode + HANDLE_PATHS in svgExport
2. **Edge paths from DOM** - Requires rendered canvas, fragile
3. **Node dimensions from DOM** - Falls back to calculation but prefers DOM
4. **Colors from CSS variables** - Works but could be more explicit
5. **Shape borderRadius is CSS string** - Can't easily parse for SVG rx/ry

---

## New Architecture

### Phase 1: Extract Constants (Single Source of Truth)

Create `src/lib/constants/` with shared definitions:

```
src/lib/constants/
├── dimensions.ts    # Node sizes, handle sizes, spacing
├── handles.ts       # Handle path data for all rotations
├── theme.ts         # Theme color objects (light/dark)
└── index.ts         # Re-exports
```

#### `dimensions.ts`
```typescript
export const NODE = {
  baseWidth: 90,
  baseHeight: 36,
  portSpacing: 18,
  borderWidth: 1
};

export const HANDLE = {
  width: 10,
  height: 8,
  hollowInset: 1.5  // Inner shape offset
};

export const EVENT = {
  size: 80,
  diamondSize: 56
};

export const PADDING = 40;
```

#### `handles.ts`
```typescript
// Outer and inner paths for hollow pentagon effect
// Each rotation has both paths for the layered rendering
export const HANDLE_PATHS = {
  0: {  // Right-pointing (default)
    outer: 'M 1 0 L 5 0 Q 6 0 6.71 0.71 L 9.29 3.29 Q 10 4 9.29 4.71 L 6.71 7.29 Q 6 8 5 8 L 1 8 Q 0 8 0 7 L 0 1 Q 0 0 1 0 Z',
    inner: 'M 0.8 0 L 3.79 0 Q 4.59 0 5.15 0.57 L 7.02 2.43 Q 7.59 3 7.02 3.57 L 5.15 5.43 Q 4.59 6 3.79 6 L 0.8 6 Q 0 6 0 5.2 L 0 0.8 Q 0 0 0.8 0 Z',
    width: 10,
    height: 8
  },
  1: {  // Down-pointing
    outer: '...',
    inner: '...',
    width: 8,
    height: 10
  },
  2: {  // Left-pointing
    outer: '...',
    inner: '...',
    width: 10,
    height: 8
  },
  3: {  // Up-pointing
    outer: '...',
    inner: '...',
    width: 8,
    height: 10
  }
} as const;

export type HandleRotation = keyof typeof HANDLE_PATHS;
```

#### `theme.ts`
```typescript
export interface Theme {
  surface: string;
  surfaceRaised: string;
  border: string;
  edge: string;
  text: string;
  textMuted: string;
  accent: string;
}

export const THEMES: Record<'light' | 'dark', Theme> = {
  dark: {
    surface: '#08080c',
    surfaceRaised: '#12121a',
    border: '#2a2a35',
    edge: '#7F7F7F',
    text: '#f0f0f5',
    textMuted: '#808090',
    accent: '#0070C0'
  },
  light: {
    surface: '#ffffff',
    surfaceRaised: '#f5f5f7',
    border: '#e0e0e5',
    edge: '#7F7F7F',
    text: '#1a1a1a',
    textMuted: '#666666',
    accent: '#0070C0'
  }
};

// Helper to get current theme from CSS (for live canvas)
export function getCurrentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') as 'light' | 'dark' || 'dark';
}
```

---

### Phase 2: Update Shape Registry

Extend `ShapeDefinition` to include numeric border radius for SVG:

```typescript
export interface ShapeDefinition {
  id: string;
  name: string;
  cssClass: string;
  borderRadius: string;       // CSS value (existing)
  svgRadius: number | number[]; // NEW: numeric for SVG (single or [rx, ry, rx, ry])
}
```

Update registrations:
```typescript
registerShape({
  id: 'pill',
  name: 'Pill',
  cssClass: 'shape-pill',
  borderRadius: '20px',
  svgRadius: 20
});

registerShape({
  id: 'mixed',
  name: 'Mixed',
  cssClass: 'shape-mixed',
  borderRadius: '12px 4px 12px 4px',
  svgRadius: [12, 4, 12, 4]  // TL, TR, BR, BL
});
```

---

### Phase 3: Update BaseNode to Use Constants

Replace hardcoded CSS clip-paths with references to constants:

```svelte
<script>
  import { HANDLE_PATHS } from '$lib/constants/handles';
</script>

<style>
  /* Generate from constants or use inline styles */
  :global(.node .svelte-flow__handle::before) {
    clip-path: path(var(--handle-outer-path));
  }
  :global(.node .svelte-flow__handle::after) {
    clip-path: path(var(--handle-inner-path));
  }
</style>
```

Or use inline styles set via JS that read from constants.

---

### Phase 4: Implement Pure Edge Path Algorithm

Create `src/lib/export/edgePath.ts`:

```typescript
interface Point { x: number; y: number; }

interface EdgePathOptions {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: 'left' | 'right' | 'top' | 'bottom';
  targetPosition: 'left' | 'right' | 'top' | 'bottom';
  borderRadius?: number;
}

/**
 * Pure implementation of smooth step path (same algorithm as SvelteFlow)
 * No DOM required.
 */
export function getSmoothStepPath(options: EdgePathOptions): string {
  // Implement the smooth step algorithm
  // Returns SVG path string
}

/**
 * Calculate arrow position and rotation at end of path
 */
export function getArrowTransform(path: string): { x: number; y: number; angle: number } {
  // Use path math, not DOM
}
```

---

### Phase 5: Build New SVG Renderer

Create `src/lib/export/svg/`:

```
src/lib/export/svg/
├── types.ts        # ExportOptions, RenderContext
├── renderer.ts     # Main render function
├── nodes.ts        # renderNode, renderHandle
├── edges.ts        # renderEdge, renderArrow
├── events.ts       # renderEvent
└── index.ts        # Public API
```

#### `types.ts`
```typescript
export interface ExportOptions {
  theme?: 'light' | 'dark' | 'auto';
  background?: 'transparent' | 'solid';
  padding?: number;
  showLabels?: boolean;
  showHandles?: boolean;
  showTypeLabels?: boolean;
  selectedOnly?: boolean;
  scale?: number;
}

export interface RenderContext {
  theme: Theme;
  options: ExportOptions;
}
```

#### `renderer.ts`
```typescript
import { get } from 'svelte/store';
import { graphStore } from '$lib/stores/graph';
import { eventStore } from '$lib/stores/events';
import { renderNode } from './nodes';
import { renderEdge } from './edges';
import { renderEvent } from './events';
import { THEMES, getCurrentTheme } from '$lib/constants/theme';

export function exportToSVG(options: ExportOptions = {}): string {
  const theme = options.theme === 'auto'
    ? THEMES[getCurrentTheme()]
    : THEMES[options.theme || 'dark'];

  const ctx: RenderContext = { theme, options };

  const nodes = get(graphStore.nodesArray);
  const edges = get(graphStore.edgesArray);
  const events = get(eventStore.eventsArray);

  // Calculate bounds
  const bounds = calculateBounds(nodes, events);

  // Build SVG
  const parts: string[] = [];

  // Header
  parts.push(renderHeader(bounds, options));

  // Background
  if (options.background === 'solid') {
    parts.push(renderBackground(bounds, ctx));
  }

  // Edges (below nodes)
  parts.push('<g class="edges">');
  for (const edge of edges) {
    parts.push(renderEdge(edge, nodes, ctx));
  }
  parts.push('</g>');

  // Events
  parts.push('<g class="events">');
  for (const event of events) {
    parts.push(renderEvent(event, ctx));
  }
  parts.push('</g>');

  // Nodes (with handles)
  parts.push('<g class="nodes">');
  for (const node of nodes) {
    parts.push(renderNode(node, ctx));
  }
  parts.push('</g>');

  parts.push('</svg>');

  return parts.join('\n');
}
```

#### `nodes.ts`
```typescript
import { HANDLE_PATHS } from '$lib/constants/handles';
import { NODE } from '$lib/constants/dimensions';
import { getShape, getShapeForCategory } from '$lib/nodes/shapes';
import { nodeRegistry } from '$lib/nodes';

export function renderNode(node: NodeInstance, ctx: RenderContext): string {
  const { x, y } = node.position;
  const { width, height } = calculateNodeDimensions(node);
  const typeDef = nodeRegistry.get(node.type);
  const shape = getShape(getShapeForCategory(typeDef?.category || 'default'));
  const color = node.color || ctx.theme.accent;

  const parts: string[] = [];

  // Node rectangle
  parts.push(renderNodeShape(x, y, width, height, shape, node, ctx));

  // Labels
  if (ctx.options.showLabels !== false) {
    parts.push(renderNodeLabels(x, y, width, height, node, typeDef, color, ctx));
  }

  // Handles
  if (ctx.options.showHandles !== false) {
    parts.push(renderNodeHandles(node, x, y, width, height, ctx));
  }

  return `<g class="node" data-id="${node.id}">${parts.join('')}</g>`;
}

function renderNodeHandles(node, x, y, width, height, ctx): string {
  const rotation = (node.params?.['_rotation'] as number) || 0;
  const paths = HANDLE_PATHS[rotation];

  const handles: string[] = [];

  // Render each input/output handle
  for (let i = 0; i < node.inputs.length; i++) {
    const pos = calculateHandlePosition('input', i, node.inputs.length, rotation, width, height);
    handles.push(renderHandle(x + pos.x, y + pos.y, paths, ctx));
  }

  for (let i = 0; i < node.outputs.length; i++) {
    const pos = calculateHandlePosition('output', i, node.outputs.length, rotation, width, height);
    handles.push(renderHandle(x + pos.x, y + pos.y, paths, ctx));
  }

  return handles.join('');
}

function renderHandle(x: number, y: number, paths, ctx: RenderContext): string {
  // Render two-layer hollow handle
  return `
    <g transform="translate(${x}, ${y})">
      <path d="${paths.outer}" fill="${ctx.theme.edge}"/>
      <path d="${paths.inner}" fill="${ctx.theme.surfaceRaised}" transform="translate(1.5, 1)"/>
    </g>`;
}
```

---

### Phase 6: Wire Up Export UI

Update export button/menu to use new renderer:

```typescript
import { exportToSVG } from '$lib/export/svg';
import { downloadSvg } from '$lib/utils/download';

function handleExport() {
  const svg = exportToSVG({
    theme: 'auto',
    background: 'transparent',
    showLabels: true,
    showHandles: true
  });
  downloadSvg(svg, 'pathview-graph.svg');
}
```

---

### Phase 7: Cleanup

1. Delete old `src/lib/utils/svgExport.ts`
2. Remove duplicated handle paths from BaseNode CSS (use constants)
3. Update any other references

---

## Migration Steps

| Phase | Description | Files Changed |
|-------|-------------|---------------|
| 1 | Extract constants | NEW: `src/lib/constants/*` |
| 2 | Update shape registry | `src/lib/nodes/shapes/registry.ts` |
| 3 | Update BaseNode | `src/lib/components/nodes/BaseNode.svelte` |
| 4 | Implement edge path | NEW: `src/lib/export/edgePath.ts` |
| 5 | Build SVG renderer | NEW: `src/lib/export/svg/*` |
| 6 | Wire up UI | `src/routes/+page.svelte` or menu component |
| 7 | Cleanup | DELETE: `src/lib/utils/svgExport.ts` |

---

## Testing Checklist

- [ ] Export with dark theme matches live canvas
- [ ] Export with light theme has correct colors
- [ ] All node shapes render correctly (pill, rect, circle, diamond, mixed)
- [ ] Handles render as hollow pentagons in all 4 rotations
- [ ] Edge paths match live canvas curves
- [ ] Arrow heads positioned and rotated correctly
- [ ] Events render as diamonds with labels
- [ ] Subsystem nodes have dashed borders
- [ ] Labels are centered and readable
- [ ] Transparent background works
- [ ] Solid background works
- [ ] Export opens correctly in browser, Figma, PowerPoint
- [ ] No DOM access in renderer (works headless)

---

## Future Enhancements

- Export selection only
- Export specific subsystem
- PNG export (via canvas rasterization)
- Thumbnail generation for file browser
- Copy SVG to clipboard
