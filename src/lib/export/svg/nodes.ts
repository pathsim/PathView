/**
 * Node rendering for SVG export
 */

import type { NodeInstance } from '$lib/types/nodes';
import type { RenderContext } from './types';
import { nodeRegistry } from '$lib/nodes';
import { getShape, getShapeForCategory } from '$lib/nodes/shapes';
import { calculateNodeDimensions, NODE } from '$lib/constants/dimensions';
import { getHandlePath } from '$lib/constants/handlePaths';
import { Position } from '@xyflow/svelte';

/** Escape XML special characters */
function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Get node dimensions */
export function getNodeDimensions(node: NodeInstance): { width: number; height: number } {
	const rotation = (node.params?.['_rotation'] as number) || 0;
	return calculateNodeDimensions(node.inputs.length, node.outputs.length, rotation);
}

/** Calculate handle position on node edge */
function getHandlePosition(
	index: number,
	total: number,
	side: 'input' | 'output',
	rotation: number,
	nodeWidth: number,
	nodeHeight: number
): { x: number; y: number; position: Position } {
	const isVertical = rotation === 1 || rotation === 3;

	// Calculate percent position (centered distribution)
	const percent = total === 1 ? 0.5 : (index + 1) / (total + 1);

	// Determine which side based on rotation and input/output
	let position: Position;
	if (side === 'input') {
		position =
			rotation === 0
				? Position.Left
				: rotation === 1
					? Position.Top
					: rotation === 2
						? Position.Right
						: Position.Bottom;
	} else {
		position =
			rotation === 0
				? Position.Right
				: rotation === 1
					? Position.Bottom
					: rotation === 2
						? Position.Left
						: Position.Top;
	}

	// Calculate position
	let x: number, y: number;
	const handlePath = getHandlePath(rotation);

	if (isVertical) {
		// Handles on top/bottom - position along width
		x = nodeWidth * percent - handlePath.width / 2;
		y = position === Position.Top ? -handlePath.height / 2 : nodeHeight - handlePath.height / 2;
	} else {
		// Handles on left/right - position along height
		x = position === Position.Left ? -handlePath.width / 2 : nodeWidth - handlePath.width / 2;
		y = nodeHeight * percent - handlePath.height / 2;
	}

	return { x, y, position };
}

/** Render a single handle */
function renderHandle(
	handleX: number,
	handleY: number,
	rotation: number,
	ctx: RenderContext
): string {
	const paths = getHandlePath(rotation);

	// Render two-layer hollow handle (outer border + inner cutout)
	// Inner path is offset by 1px on all sides (matches CSS inset: 1px)
	return `<g transform="translate(${handleX.toFixed(2)}, ${handleY.toFixed(2)})">
		<path d="${paths.outer}" fill="${ctx.theme.edge}"/>
		<path d="${paths.inner}" fill="${ctx.theme.surfaceRaised}" transform="translate(1, 1)"/>
	</g>`;
}

/** Render node handles */
function renderHandles(
	node: NodeInstance,
	nodeWidth: number,
	nodeHeight: number,
	ctx: RenderContext
): string {
	if (!ctx.options.showHandles) return '';

	const rotation = (node.params?.['_rotation'] as number) || 0;
	const handles: string[] = [];

	// Input handles
	for (let i = 0; i < node.inputs.length; i++) {
		const pos = getHandlePosition(i, node.inputs.length, 'input', rotation, nodeWidth, nodeHeight);
		handles.push(renderHandle(pos.x, pos.y, rotation, ctx));
	}

	// Output handles
	for (let i = 0; i < node.outputs.length; i++) {
		const pos = getHandlePosition(
			i,
			node.outputs.length,
			'output',
			rotation,
			nodeWidth,
			nodeHeight
		);
		handles.push(renderHandle(pos.x, pos.y, rotation, ctx));
	}

	return handles.join('\n\t\t');
}

/** Get SVG path for a rounded rectangle with potentially different corner radii */
function getRoundedRectPath(
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number | [number, number, number, number]
): string {
	let tl: number, tr: number, br: number, bl: number;

	if (Array.isArray(radius)) {
		[tl, tr, br, bl] = radius;
	} else {
		tl = tr = br = bl = radius;
	}

	// Clamp radii to half of smallest dimension
	const maxRadius = Math.min(width, height) / 2;
	tl = Math.min(tl, maxRadius);
	tr = Math.min(tr, maxRadius);
	br = Math.min(br, maxRadius);
	bl = Math.min(bl, maxRadius);

	return `M ${x + tl} ${y}
		L ${x + width - tr} ${y}
		Q ${x + width} ${y} ${x + width} ${y + tr}
		L ${x + width} ${y + height - br}
		Q ${x + width} ${y + height} ${x + width - br} ${y + height}
		L ${x + bl} ${y + height}
		Q ${x} ${y + height} ${x} ${y + height - bl}
		L ${x} ${y + tl}
		Q ${x} ${y} ${x + tl} ${y}
		Z`;
}

/** Render node shape (rectangle with border radius) */
function renderNodeShape(
	x: number,
	y: number,
	width: number,
	height: number,
	node: NodeInstance,
	ctx: RenderContext
): string {
	const typeDef = nodeRegistry.get(node.type);
	const category = typeDef?.category || 'default';
	const shapeId = getShapeForCategory(category);
	const shape = getShape(shapeId);

	const isSubsystem = node.type === 'Subsystem' || node.type === 'Interface';
	const strokeDasharray = isSubsystem ? 'stroke-dasharray="4 2"' : '';

	// For Recording nodes, use min dimension / 2 for circular shape
	let radius = shape?.svgRadius ?? 8;
	if (category === 'Recording') {
		radius = Math.min(width, height) / 2;
	}

	// Use path for mixed radius, rect for uniform
	if (Array.isArray(radius)) {
		const path = getRoundedRectPath(x, y, width, height, radius);
		return `<path d="${path}" fill="none" stroke="${ctx.theme.edge}" stroke-width="${NODE.borderWidth}" ${strokeDasharray}/>`;
	}

	return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="none" stroke="${ctx.theme.edge}" stroke-width="${NODE.borderWidth}" ${strokeDasharray}/>`;
}

/** Render node labels */
function renderNodeLabels(
	x: number,
	y: number,
	width: number,
	height: number,
	node: NodeInstance,
	ctx: RenderContext
): string {
	if (!ctx.options.showLabels) return '';

	const typeDef = nodeRegistry.get(node.type);
	const color = node.color || ctx.theme.accent;

	const parts: string[] = [];

	// Node name
	const nameY = ctx.options.showTypeLabels ? y + height / 2 - 3 : y + height / 2;
	parts.push(
		`<text x="${x + width / 2}" y="${nameY}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="10" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${escapeXml(node.name)}</text>`
	);

	// Type label
	if (ctx.options.showTypeLabels && typeDef) {
		parts.push(
			`<text x="${x + width / 2}" y="${y + height / 2 + 9}" text-anchor="middle" dominant-baseline="middle" fill="${ctx.theme.textMuted}" font-size="8" font-family="system-ui, -apple-system, sans-serif">${escapeXml(typeDef.name)}</text>`
		);
	}

	return parts.join('\n\t\t');
}

/** Render a node to SVG */
export function renderNode(node: NodeInstance, ctx: RenderContext): string {
	const { x, y } = node.position;
	const { width, height } = getNodeDimensions(node);

	const parts: string[] = [];

	// Node shape (rendered at 0,0 within group)
	parts.push(renderNodeShape(0, 0, width, height, node, ctx));

	// Labels (rendered at 0,0 within group)
	parts.push(renderNodeLabels(0, 0, width, height, node, ctx));

	// Handles (already relative to 0,0)
	const handles = renderHandles(node, width, height, ctx);
	if (handles) parts.push(handles);

	return `<g class="node" data-id="${node.id}" transform="translate(${x}, ${y})">
	${parts.filter(Boolean).join('\n\t')}
</g>`;
}
