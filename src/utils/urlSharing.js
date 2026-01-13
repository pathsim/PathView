/**
 * URL sharing utilities for PathView
 * Handles encoding and decoding graph data in URLs
 */
import { compressToBase64, decompressFromBase64 } from 'lz-string';

// Maximum safe URL length for most servers (conservative estimate)
const MAX_SAFE_URL_LENGTH = 4000;

/**
 * Encode graph data to a compressed base64 URL parameter
 * @param {Object} graphData - The complete graph data object
 * @returns {string} - Compressed base64 encoded string
 */
export function encodeGraphData(graphData) {
    try {
        const jsonString = JSON.stringify(graphData);
        // Use lz-string for much better compression than manual whitespace removal
        return compressToBase64(jsonString);
    } catch (error) {
        console.error('Error encoding graph data:', error);
        return null;
    }
}/**
 * Decode graph data from a compressed base64 URL parameter
 * @param {string} encodedData - Compressed base64 encoded graph data
 * @returns {Object|null} - Decoded graph data object or null if error
 */
export function decodeGraphData(encodedData) {
    try {
        // First try lz-string decompression (new format)
        const jsonString = decompressFromBase64(encodedData);
        if (jsonString) {
            return JSON.parse(jsonString);
        }

        // Fallback for old format (manual base64 encoding)
        try {
            const binaryString = atob(encodedData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const oldJsonString = new TextDecoder().decode(bytes);
            return JSON.parse(oldJsonString);
        } catch (oldFormatError) {
            console.warn('Could not decode with old format either:', oldFormatError);
        }

        return null;
    } catch (error) {
        console.error('Error decoding graph data:', error);
        return null;
    }
}

/**
 * Generate a shareable URL with the current graph data
 * @param {Object} graphData - The complete graph data object
 * @returns {Object} - Object with url and metadata about the URL
 */
export function generateShareableURL(graphData) {
    try {
        const encodedData = encodeGraphData(graphData);
        if (!encodedData) {
            throw new Error('Failed to encode graph data');
        }

        const baseURL = window.location.origin + window.location.pathname;
        const url = new URL(baseURL);
        url.searchParams.set('graph', encodedData);

        const finalURL = url.toString();

        return {
            url: finalURL,
            length: finalURL.length,
            isSafe: finalURL.length <= MAX_SAFE_URL_LENGTH,
            maxLength: MAX_SAFE_URL_LENGTH
        };
    } catch (error) {
        console.error('Error generating shareable URL:', error);
        return null;
    }
}/**
 * Extract graph data from current URL parameters
 * @returns {Object|null} - Graph data object or null if not found/error
 */
export function getGraphDataFromURL() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get('graph');

        if (!encodedData) {
            return null;
        }

        return decodeGraphData(encodedData);
    } catch (error) {
        console.error('Error extracting graph data from URL:', error);
        return null;
    }
}

/**
 * Update the current URL with graph data without page reload
 * @param {Object} graphData - The complete graph data object
 * @param {boolean} replaceState - Whether to replace current history state (default: false)
 */
export function updateURLWithGraphData(graphData, replaceState = false) {
    try {
        const urlResult = generateShareableURL(graphData);
        if (urlResult && urlResult.isSafe) {
            if (replaceState) {
                window.history.replaceState({}, '', urlResult.url);
            } else {
                window.history.pushState({}, '', urlResult.url);
            }
        } else if (urlResult) {
            console.warn(`URL too long (${urlResult.length} chars), not updating browser URL`);
        }
    } catch (error) {
        console.error('Error updating URL with graph data:', error);
    }
}/**
 * Clear graph data from URL without page reload
 */
export function clearGraphDataFromURL() {
    try {
        const baseURL = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', baseURL);
    } catch (error) {
        console.error('Error clearing graph data from URL:', error);
    }
}

/**
 * Copy shareable URL to clipboard
 * @param {Object} graphData - The complete graph data object
 * @returns {Promise<Object>} - Result object with success status and metadata
 */
export async function copyShareableURLToClipboard(graphData) {
    try {
        const urlResult = generateShareableURL(graphData);
        if (!urlResult) {
            throw new Error('Failed to generate shareable URL');
        }

        await navigator.clipboard.writeText(urlResult.url);
        return {
            success: true,
            isSafe: urlResult.isSafe,
            length: urlResult.length,
            maxLength: urlResult.maxLength,
            url: urlResult.url
        };
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        // Fallback for older browsers
        try {
            const urlResult = generateShareableURL(graphData);
            const textArea = document.createElement('textarea');
            textArea.value = urlResult.url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return {
                success: true,
                isSafe: urlResult.isSafe,
                length: urlResult.length,
                maxLength: urlResult.maxLength,
                url: urlResult.url
            };
        } catch (fallbackError) {
            console.error('Clipboard fallback failed:', fallbackError);
            return {
                success: false,
                isSafe: false,
                length: 0,
                maxLength: MAX_SAFE_URL_LENGTH,
                url: null
            };
        }
    }
}
