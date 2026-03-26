#!/usr/bin/env node
// Updates every versioned occurrence in landing.html to match package.json.
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const file = new URL('../landing.html', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
let html = readFileSync(file, 'utf-8');

// Replace any v0.x.y occurrence that looks like a version badge or inline demo string
const updated = html.replace(/v\d+\.\d+\.\d+/g, `v${version}`);

if (updated === html) {
  console.log(`landing.html already at v${version} — no changes needed.`);
} else {
  writeFileSync(file, updated, 'utf-8');
  console.log(`landing.html updated to v${version}`);
}
