/**
 * Graph store - Navigation operations
 */

import { get } from 'svelte/store';
import { currentPath, selectedNodeIds } from './state';
import { triggerFitView } from '../viewActions';

/**
 * Drill down into a subsystem
 */
export function drillDown(subsystemId: string): void {
	currentPath.update(p => [...p, subsystemId]);
	selectedNodeIds.set(new Set());
	setTimeout(() => triggerFitView(), 0);
}

/**
 * Go up one level
 */
export function drillUp(): void {
	currentPath.update(p => p.slice(0, -1));
	selectedNodeIds.set(new Set());
	setTimeout(() => triggerFitView(), 0);
}

/**
 * Go to specific level (0 = root)
 */
export function navigateTo(level: number): void {
	const current = get(currentPath).length;
	if (level === current) return;
	currentPath.update(p => p.slice(0, level));
	selectedNodeIds.set(new Set());
	setTimeout(() => triggerFitView(), 0);
}

/**
 * Navigate directly to a specific path (for search)
 */
export function navigateToPath(path: string[]): void {
	currentPath.set(path);
	selectedNodeIds.set(new Set());
	setTimeout(() => triggerFitView(), 0);
}

/**
 * Check if at root level
 */
export function isAtRoot(): boolean {
	return get(currentPath).length === 0;
}

/**
 * Get the current navigation path
 */
export function getCurrentPath(): string[] {
	return get(currentPath);
}
