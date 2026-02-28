import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDependencies } from '../../checkers/dependencies.js';
import { makeParsed, makeTmpRepo, cleanupRepo } from '../helpers.js';

test('passes when mentioned dep exists in package.json', () => {
  const repo = makeTmpRepo({ dependencies: { zod: '^3.0.0' } });
  try {
    const parsed = makeParsed({
      mentionedDependencies: ['zod'],
      lines: ['We use zod for schema validation.'],
    });
    const result = checkDependencies(parsed, repo);
    const missing = result.issues.filter((i) => i.rule === 'no-missing-dependency');
    assert.strictEqual(missing.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

test('warns when mentioned dep is absent from package.json', () => {
  const repo = makeTmpRepo({ dependencies: {} });
  try {
    const parsed = makeParsed({
      mentionedDependencies: ['prisma'],
      lines: ['We use prisma for database access.'],
    });
    const result = checkDependencies(parsed, repo);
    const missing = result.issues.filter((i) => i.rule === 'no-missing-dependency');
    assert.strictEqual(missing.length, 1);
    assert.ok(missing[0].message.includes('prisma'));
  } finally {
    cleanupRepo(repo);
  }
});

test('returns empty result when no package.json exists', () => {
  const repo = makeTmpRepo(); // no package.json
  try {
    const parsed = makeParsed({ mentionedDependencies: ['lodash'] });
    const result = checkDependencies(parsed, repo);
    assert.strictEqual(result.issues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

test('flags deprecated packages that exist in package.json', () => {
  const repo = makeTmpRepo({ dependencies: { moment: '^2.29.0' } });
  try {
    const parsed = makeParsed({ mentionedDependencies: [], lines: [] });
    const result = checkDependencies(parsed, repo);
    const deprecated = result.issues.filter((i) => i.rule === 'deprecated-dependency');
    assert.strictEqual(deprecated.length, 1);
    assert.ok(deprecated[0].message.includes('moment'));
    assert.ok(deprecated[0].suggestion!.includes('date-fns'));
  } finally {
    cleanupRepo(repo);
  }
});

test('finds deps in devDependencies too', () => {
  const repo = makeTmpRepo({ devDependencies: { vitest: '^1.0.0' } });
  try {
    const parsed = makeParsed({
      mentionedDependencies: ['vitest'],
      lines: ['Tests use vitest.'],
    });
    const result = checkDependencies(parsed, repo);
    const missing = result.issues.filter((i) => i.rule === 'no-missing-dependency');
    assert.strictEqual(missing.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});
