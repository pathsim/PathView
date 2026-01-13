/**
 * Version Check Utility
 *
 * Checks if generated code is in sync with PathSim version.
 * Warns developers if extraction scripts need to be re-run.
 */

import { GENERATED_VERSION } from './generated/version';

export interface VersionCheckResult {
	current: string;
	generated: string;
	needsUpdate: boolean;
}

/**
 * Get the version the generated code was built for
 */
export function getGeneratedVersion(): typeof GENERATED_VERSION {
	return GENERATED_VERSION;
}

/**
 * Check if versions match
 * Note: This is called manually or from Python after PathSim is loaded
 */
export function checkVersion(currentPathSimVersion: string): VersionCheckResult {
	const needsUpdate = currentPathSimVersion !== GENERATED_VERSION.pathsimVersion;

	if (needsUpdate) {
		console.warn(
			`[PathView] Generated code is for PathSim ${GENERATED_VERSION.pathsimVersion}, ` +
				`but ${currentPathSimVersion} is installed. ` +
				`Run 'npm run extract-all' to update.`
		);
	}

	return {
		current: currentPathSimVersion,
		generated: GENERATED_VERSION.pathsimVersion,
		needsUpdate
	};
}

/**
 * Log version info to console (for debugging)
 */
export function logVersionInfo(): void {
	console.info('[PathView] Generated code info:', {
		pathsimVersion: GENERATED_VERSION.pathsimVersion,
		generatedAt: GENERATED_VERSION.generatedAt,
		extractorVersion: GENERATED_VERSION.extractorVersion
	});
}
