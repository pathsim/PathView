/**
 * CSV Export utility for recording nodes (Scope, Spectrum)
 */

import { get } from 'svelte/store';
import { simulationState } from '$lib/pyodide/bridge';
import { downloadCsv } from './download';

/** Characters that are invalid in filenames */
const INVALID_FILENAME_CHARS = /[/\\:*?"<>|]/g;

/** Sanitize filename by removing invalid characters */
function sanitizeFilename(name: string): string {
	return name.replace(INVALID_FILENAME_CHARS, '').trim() || 'export';
}

/** Generate CSV content from scope data */
function generateScopeCsv(
	time: number[],
	signals: number[][],
	labels?: string[]
): string {
	// Build header row
	const headers = ['time'];
	for (let i = 0; i < signals.length; i++) {
		headers.push(labels?.[i] ?? `port_${i}`);
	}

	// Build data rows
	const rows = [headers.join(',')];
	for (let t = 0; t < time.length; t++) {
		const row = [time[t].toString()];
		for (let s = 0; s < signals.length; s++) {
			row.push((signals[s][t] ?? '').toString());
		}
		rows.push(row.join(','));
	}

	return rows.join('\n');
}

/** Generate CSV content from spectrum data */
function generateSpectrumCsv(
	frequency: number[],
	magnitude: number[][],
	labels?: string[]
): string {
	// Build header row
	const headers = ['frequency'];
	for (let i = 0; i < magnitude.length; i++) {
		headers.push(labels?.[i] ?? `port_${i}`);
	}

	// Build data rows
	const rows = [headers.join(',')];
	for (let f = 0; f < frequency.length; f++) {
		const row = [frequency[f].toString()];
		for (let m = 0; m < magnitude.length; m++) {
			row.push((magnitude[m][f] ?? '').toString());
		}
		rows.push(row.join(','));
	}

	return rows.join('\n');
}

/**
 * Check if a node has exportable data
 */
export function hasExportableData(nodeId: string, dataSource: 'scope' | 'spectrum'): boolean {
	const state = get(simulationState);
	if (!state.result) return false;

	if (dataSource === 'scope') {
		const data = state.result.scopeData[nodeId];
		return !!(data && data.time.length > 0);
	} else {
		const data = state.result.spectrumData[nodeId];
		return !!(data && data.frequency.length > 0);
	}
}

/**
 * Export scope data to CSV
 */
export function exportScopeData(nodeId: string, nodeName: string): boolean {
	const state = get(simulationState);
	const data = state.result?.scopeData[nodeId];

	if (!data || data.time.length === 0) {
		return false;
	}

	const csv = generateScopeCsv(data.time, data.signals, data.labels);
	const filename = `${sanitizeFilename(nodeName || 'Scope')}.csv`;
	downloadCsv(csv, filename);
	return true;
}

/**
 * Export spectrum data to CSV
 */
export function exportSpectrumData(nodeId: string, nodeName: string): boolean {
	const state = get(simulationState);
	const data = state.result?.spectrumData[nodeId];

	if (!data || data.frequency.length === 0) {
		return false;
	}

	const csv = generateSpectrumCsv(data.frequency, data.magnitude, data.labels);
	const filename = `${sanitizeFilename(nodeName || 'Spectrum')}.csv`;
	downloadCsv(csv, filename);
	return true;
}

/**
 * Export recording node data to CSV based on type
 */
export function exportRecordingData(
	nodeId: string,
	nodeName: string,
	nodeType: string
): boolean {
	if (nodeType === 'Scope') {
		return exportScopeData(nodeId, nodeName);
	} else if (nodeType === 'Spectrum') {
		return exportSpectrumData(nodeId, nodeName);
	}
	return false;
}
