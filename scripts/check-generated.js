#!/usr/bin/env node
/**
 * Check Generated Code Version
 *
 * This script checks if the generated code is in sync with PathSim.
 * Run during prebuild to warn developers if extraction is needed.
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const VERSION_FILE = 'src/lib/nodes/generated/version.ts';

function getGeneratedVersion() {
	try {
		const content = readFileSync(VERSION_FILE, 'utf-8');
		const match = content.match(/pathsimVersion:\s*['"]([^'"]+)['"]/);
		return match?.[1] || 'unknown';
	} catch {
		console.warn('⚠️  Could not read generated version file');
		return 'unknown';
	}
}

function getCurrentPathSimVersion() {
	try {
		// Try to get PathSim version from Python
		const result = execSync('python -c "import pathsim; print(pathsim.__version__)"', {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe']
		});
		return result.trim();
	} catch {
		// PathSim not installed or Python not available
		return null;
	}
}

function main() {
	const generatedVersion = getGeneratedVersion();
	const currentVersion = getCurrentPathSimVersion();

	console.log('📦 Generated code version check');
	console.log(`   Generated for PathSim: ${generatedVersion}`);

	if (currentVersion === null) {
		console.log('   Current PathSim: (not detected - Python/PathSim not available)');
		console.log('   ℹ️  Skipping version check');
		return;
	}

	console.log(`   Current PathSim: ${currentVersion}`);

	if (generatedVersion !== currentVersion) {
		console.log('');
		console.warn('⚠️  Version mismatch detected!');
		console.warn('   Run "npm run extract-all" to update generated files.');
		console.log('');
	} else {
		console.log('   ✓ Versions match');
	}
}

main();
