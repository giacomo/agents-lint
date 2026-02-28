import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNpmScripts } from '../../checkers/npm-scripts.js';
import { makeParsed, makeTmpRepo, cleanupRepo } from '../helpers.js';

test('passes when mentioned script exists in package.json', () => {
  const repo = makeTmpRepo({ scripts: { build: 'tsc', test: 'node --test' } });
  try {
    const parsed = makeParsed({
      mentionedScripts: ['build'],
      lines: ['Run `npm run build` to compile.'],
    });
    const result = checkNpmScripts(parsed, repo);
    const scriptIssues = result.issues.filter((i) => i.rule === 'no-missing-script');
    assert.strictEqual(scriptIssues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

test('warns when script is mentioned but absent from package.json', () => {
  const repo = makeTmpRepo({ scripts: { test: 'node --test' } });
  try {
    const parsed = makeParsed({
      mentionedScripts: ['deploy'],
      lines: ['Run `npm run deploy` to ship.'],
    });
    const result = checkNpmScripts(parsed, repo);
    const missing = result.issues.filter((i) => i.rule === 'no-missing-script');
    assert.strictEqual(missing.length, 1);
    assert.strictEqual(missing[0].severity, 'warn');
    assert.ok(missing[0].message.includes('deploy'));
  } finally {
    cleanupRepo(repo);
  }
});

test('warns about missing test script when none exists in package.json', () => {
  const repo = makeTmpRepo({ scripts: { build: 'tsc' } });
  try {
    const parsed = makeParsed({ mentionedScripts: [], lines: [] });
    const result = checkNpmScripts(parsed, repo);
    const testIssue = result.issues.find((i) => i.rule === 'missing-test-script');
    assert.ok(testIssue, 'should report missing-test-script');
    assert.strictEqual(testIssue!.severity, 'warn');
  } finally {
    cleanupRepo(repo);
  }
});

test('returns empty result when no package.json is found', () => {
  const repo = makeTmpRepo(); // no package.json written
  try {
    const parsed = makeParsed({ mentionedScripts: ['build'] });
    const result = checkNpmScripts(parsed, repo);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.passed, 0);
    assert.strictEqual(result.failed, 0);
  } finally {
    cleanupRepo(repo);
  }
});
