#!/usr/bin/env node
/**
 * Release script — bumps all version strings, builds, tests, commits, and publishes.
 *
 * Usage:
 *   node scripts/release.js patch [--otp=123456]
 *   node scripts/release.js minor [--otp=123456]
 *   node scripts/release.js major [--otp=123456]
 *   node scripts/release.js 1.2.3 [--otp=123456]
 *
 * Without --otp the script stops after git push and prints the publish command.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const bump = args.find((a) => !a.startsWith('--'));
const otpArg = args.find((a) => a.startsWith('--otp='));
const otp = otpArg ? otpArg.split('=')[1] : null;

if (!bump) {
  console.error('Usage: node scripts/release.js patch|minor|major|x.y.z [--otp=CODE]');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd, { silent = false } = {}) {
  console.log(`\x1b[2m$ ${cmd}\x1b[0m`);
  execSync(cmd, { stdio: silent ? 'pipe' : 'inherit' });
}

function resolveFilePath(metaRelative) {
  return new URL(metaRelative, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
}

// ── Step 1: Bump version in package.json ──────────────────────────────────────

run(`npm version ${bump} --no-git-tag-version`);

const { version } = require('../package.json');
console.log(`\n\x1b[32m✓ New version: v${version}\x1b[0m\n`);

// ── Step 2: Update VERSION constant in src/cli.ts ────────────────────────────

const cliPath = resolveFilePath('../src/cli.ts');
const cli = readFileSync(cliPath, 'utf-8');
const updatedCli = cli.replace(/const VERSION = '[^']+';/, `const VERSION = '${version}';`);
writeFileSync(cliPath, updatedCli, 'utf-8');
console.log(`\x1b[2m  src/cli.ts → VERSION = '${version}'\x1b[0m`);

// ── Step 3: Update hardcoded version in src/reporter.ts ──────────────────────

const reporterPath = resolveFilePath('../src/reporter.ts');
const reporter = readFileSync(reporterPath, 'utf-8');
const updatedReporter = reporter.replace(/v\d+\.\d+\.\d+/g, `v${version}`);
writeFileSync(reporterPath, updatedReporter, 'utf-8');
console.log(`\x1b[2m  src/reporter.ts → v${version}\x1b[0m`);

// ── Step 4: Update README.md ──────────────────────────────────────────────────

const readmePath = resolveFilePath('../README.md');
const readme = readFileSync(readmePath, 'utf-8');
const updatedReadme = readme.replace(/agents-lint v\d+\.\d+\.\d+/, `agents-lint v${version}`);
writeFileSync(readmePath, updatedReadme, 'utf-8');
console.log(`\x1b[2m  README.md → agents-lint v${version}\x1b[0m`);

// ── Step 5: Update landing.html ───────────────────────────────────────────────

run('node scripts/update-landing-version.js');

// ── Step 6: Build ─────────────────────────────────────────────────────────────

console.log('');
run('npm run build');

// ── Step 7: Test ──────────────────────────────────────────────────────────────

console.log('');
run('npm test');

// ── Step 8: Commit + tag + push ───────────────────────────────────────────────

console.log('');
run('git add -A');
run(`git commit -m "chore: release v${version}"`);
run(`git tag v${version}`);
run('git push');
run('git push --tags');

// ── Step 9: Publish ───────────────────────────────────────────────────────────

console.log('');
if (otp) {
  run(`npm publish --otp=${otp}`);
  console.log(`\n\x1b[32m✓ Published agents-lint@${version}\x1b[0m\n`);
} else {
  console.log(`\x1b[33m⚠ No --otp provided. Run:\x1b[0m`);
  console.log(`\x1b[36m  npm publish --otp=<code>\x1b[0m\n`);
}
