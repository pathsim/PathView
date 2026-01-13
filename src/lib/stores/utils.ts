/**
 * Store utility functions for common patterns
 */

/**
 * Generate a unique ID using crypto.randomUUID
 */
export function generateId(): string {
	return crypto.randomUUID();
}
