import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCrossConsistency } from '../../checkers/cross.js';
import type { FileContext } from '../../checkers/cross.js';
import { makeParsed } from '../helpers.js';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeContext(relativePath: string, overrides: Parameters<typeof makeParsed>[0] = {}): FileContext {
  return { relativePath, parsed: makeParsed(overrides) };
}

// ── memory file exclusion ──────────────────────────────────────────────────────

test('memory files are excluded from cross-consistency checks', () => {
  const agentFile = makeContext('AGENTS.md', {
    fileType: 'context',
    rawContent: 'npm install',
    mentionedScripts: ['build'],
    mentionedPaths: ['./src/services/auth/index.ts'],
  });
  const memoryFile = makeContext('memory/MEMORY.md', {
    fileType: 'memory',
    rawContent: 'bun install',
    mentionedScripts: ['test'],
    mentionedPaths: [],
  });

  const result = checkCrossConsistency([agentFile, memoryFile]);
  // Only 1 context file after filtering → no cross checks run
  assert.strictEqual(result.issues.length, 0);
});

test('cross-consistency runs normally between two context files', () => {
  const file1 = makeContext('AGENTS.md', {
    fileType: 'context',
    rawContent: 'npm install && npm run build',
    mentionedScripts: ['build'],
    mentionedPaths: [],
  });
  const file2 = makeContext('CLAUDE.md', {
    fileType: 'context',
    rawContent: 'yarn install && yarn build',
    mentionedScripts: ['build'],
    mentionedPaths: [],
  });

  const result = checkCrossConsistency([file1, file2]);
  // Different package managers → PM conflict
  const pmIssue = result.issues.find((i) => i.rule === 'cross-pm-conflict');
  assert.ok(pmIssue, 'expected cross-pm-conflict when npm vs yarn used');
  assert.strictEqual(pmIssue!.severity, 'error');
});

// ── ignorePatterns ─────────────────────────────────────────────────────────────

test('ignorePatterns suppresses cross-path-asymmetry', () => {
  const file1 = makeContext('AGENTS.md', {
    fileType: 'context',
    rawContent: 'see `./src/tests/helpers.ts` for helpers',
    mentionedPaths: ['./src/tests/helpers.ts'],
  });
  const file2 = makeContext('CLAUDE.md', {
    fileType: 'context',
    rawContent: 'no path references',
    mentionedPaths: [],
  });

  const withoutIgnore = checkCrossConsistency([file1, file2]);
  const asymmetryIssues = withoutIgnore.issues.filter((i) => i.rule === 'cross-path-asymmetry');
  assert.ok(asymmetryIssues.length > 0, 'expected cross-path-asymmetry without ignorePatterns');

  const withIgnore = checkCrossConsistency([file1, file2], {
    ignorePatterns: ['src/tests/helpers.ts'],
  });
  const suppressed = withIgnore.issues.filter((i) => i.rule === 'cross-path-asymmetry');
  assert.strictEqual(suppressed.length, 0, 'ignorePatterns should suppress cross-path-asymmetry');
});

test('cross-path-asymmetry only fires for paths with 3+ segments', () => {
  const file1 = makeContext('AGENTS.md', {
    fileType: 'context',
    mentionedPaths: ['src/index.ts'],   // 2 segments — below threshold
  });
  const file2 = makeContext('CLAUDE.md', {
    fileType: 'context',
    mentionedPaths: [],
  });

  const result = checkCrossConsistency([file1, file2]);
  const asymmetry = result.issues.filter((i) => i.rule === 'cross-path-asymmetry');
  assert.strictEqual(asymmetry.length, 0, 'short paths should not trigger cross-path-asymmetry');
});

test('cross-path-asymmetry is not raised when both files mention the path', () => {
  const sharedPath = './src/services/auth/index.ts';
  const file1 = makeContext('AGENTS.md', { fileType: 'context', mentionedPaths: [sharedPath] });
  const file2 = makeContext('CLAUDE.md', { fileType: 'context', mentionedPaths: [sharedPath] });

  const result = checkCrossConsistency([file1, file2]);
  const asymmetry = result.issues.filter((i) => i.rule === 'cross-path-asymmetry');
  assert.strictEqual(asymmetry.length, 0);
});
