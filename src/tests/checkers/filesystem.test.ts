import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkFilesystem } from '../../checkers/filesystem.js';
import { makeParsed, makeTmpRepo, cleanupRepo } from '../helpers.js';

test('passes for a path that exists on disk', () => {
  const repo = makeTmpRepo();
  try {
    fs.mkdirSync(path.join(repo, 'src'));
    fs.writeFileSync(path.join(repo, 'src', 'index.ts'), '');
    const parsed = makeParsed({ mentionedPaths: ['src/index.ts'] });
    const result = checkFilesystem(parsed, repo);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.passed, 1);
  } finally {
    cleanupRepo(repo);
  }
});

test('reports an error for a path that does not exist', () => {
  const repo = makeTmpRepo();
  try {
    const parsed = makeParsed({ mentionedPaths: ['src/does-not-exist.ts'] });
    const result = checkFilesystem(parsed, repo);
    assert.strictEqual(result.issues.length, 1);
    assert.strictEqual(result.issues[0].severity, 'error');
    assert.ok(result.issues[0].message.includes('does-not-exist.ts'));
  } finally {
    cleanupRepo(repo);
  }
});

test('skips paths that start with http/https', () => {
  const repo = makeTmpRepo();
  try {
    const parsed = makeParsed({ mentionedPaths: ['https://example.com/path'] });
    const result = checkFilesystem(parsed, repo);
    assert.strictEqual(result.issues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

test('skips paths matching ignorePatterns config', () => {
  const repo = makeTmpRepo();
  try {
    const parsed = makeParsed({ mentionedPaths: ['app/Http/Kernel.php'] });
    const result = checkFilesystem(parsed, repo, { ignorePatterns: ['app/Http'] });
    assert.strictEqual(result.issues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

test('uses custom severity from config', () => {
  const repo = makeTmpRepo();
  try {
    const parsed = makeParsed({ mentionedPaths: ['missing/file.ts'] });
    const result = checkFilesystem(parsed, repo, { severity: { missingPath: 'warn' } });
    assert.strictEqual(result.issues.length, 1);
    assert.strictEqual(result.issues[0].severity, 'warn');
  } finally {
    cleanupRepo(repo);
  }
});
