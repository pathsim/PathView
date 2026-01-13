/**
 * Block Docstrings
 *
 * Extracts docstrings from generated blocks.ts - no separate file needed.
 */

import { extractedBlocks } from './generated/blocks';

/**
 * Get docstring for a specific block type
 */
export function getDocstring(blockType: string): string | undefined {
	return extractedBlocks[blockType]?.docstringHtml;
}

/**
 * Get all docstrings as a record
 */
export function getAllDocstrings(): Record<string, string> {
	const docstrings: Record<string, string> = {};
	for (const [name, block] of Object.entries(extractedBlocks)) {
		if (block.docstringHtml) {
			docstrings[name] = block.docstringHtml;
		}
	}
	return docstrings;
}
