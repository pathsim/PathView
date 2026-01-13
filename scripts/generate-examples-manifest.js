#!/usr/bin/env node
/**
 * Generates manifest.json from all example .json files in static/examples/
 * Run this before build or as part of the dev process
 */

import { readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, '..', 'static', 'examples');
const manifestPath = join(examplesDir, 'manifest.json');

// Find all .json files (excluding manifest.json itself)
const files = readdirSync(examplesDir)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json')
  .sort();

// Write manifest
const manifest = { files };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Generated manifest with ${files.length} example(s): ${files.join(', ')}`);
