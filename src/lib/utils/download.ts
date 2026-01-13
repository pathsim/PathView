/**
 * Browser file download utility
 *
 * Triggers a browser download for the given content.
 */

/** Common MIME types for exports */
export const MIME_TYPES = {
	JSON: 'application/json',
	CSV: 'text/csv;charset=utf-8;',
	SVG: 'image/svg+xml',
	TEXT: 'text/plain',
	PYTHON: 'text/x-python'
} as const;

/**
 * Trigger a browser download for the given content
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	URL.revokeObjectURL(url);
}

/** Download JSON content */
export function downloadJson(content: object | string, filename: string): void {
	const json = typeof content === 'string' ? content : JSON.stringify(content, null, '\t');
	downloadFile(json, filename, MIME_TYPES.JSON);
}

/** Download CSV content */
export function downloadCsv(content: string, filename: string): void {
	downloadFile(content, filename, MIME_TYPES.CSV);
}

/** Download SVG content */
export function downloadSvg(content: string, filename: string): void {
	downloadFile(content, filename, MIME_TYPES.SVG);
}

/** Download Python code */
export function downloadPython(content: string, filename: string): void {
	downloadFile(content, filename, MIME_TYPES.PYTHON);
}
