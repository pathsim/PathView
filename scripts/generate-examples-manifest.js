#!/usr/bin/env node
/**
 * Generates manifest.json from example .json files
 * SVG previews are manually exported using the app's SVG export feature
 */

import { readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, '..', 'static', 'examples');
const manifestPath = join(examplesDir, 'manifest.json');

// Find all .json files (excluding manifest.json)
const files = readdirSync(examplesDir)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json')
  .sort();

// Write manifest
const manifest = { files };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Generated manifest with ${files.length} examples`);
