import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkMakeTargets } from '../../checkers/make-targets.js';
import { makeParsed } from '../helpers.js';

/** Creates a temp repo; writes a Makefile with the given body if provided. */
function makeTmpRepoWithMakefile(makefile?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-lint-make-'));
  if (makefile !== undefined) {
    fs.writeFileSync(path.join(dir, 'Makefile'), makefile, 'utf-8');
  }
  return dir;
}

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

const MAKEFILE = `
.PHONY: build test lint forms-check forms-lint

CC := gcc
FLAGS = -O2

build:
\tgo build ./...

test: build
\tgo test ./...

lint:
\tgolangci-lint run

forms-check:
\tnpm --prefix forms test

forms-lint:
\tnpm --prefix forms run lint
`;

test('passes when mentioned target exists in the Makefile', () => {
  const repo = makeTmpRepoWithMakefile(MAKEFILE);
  try {
    const parsed = makeParsed({
      mentionedMakeTargets: ['build', 'test', 'lint'],
      lines: ['Run `make build` then `make test`.'],
    });
    const result = checkMakeTargets(parsed, repo);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.passed, 3);
  } finally {
    cleanup(repo);
  }
});

test('errors when a target is mentioned but not defined', () => {
  const repo = makeTmpRepoWithMakefile(MAKEFILE);
  try {
    const parsed = makeParsed({
      mentionedMakeTargets: ['deploy'],
      lines: ['Ship it with `make deploy`.'],
    });
    const result = checkMakeTargets(parsed, repo);
    const missing = result.issues.filter((i) => i.rule === 'no-missing-make-target');
    assert.strictEqual(missing.length, 1);
    assert.strictEqual(missing[0].severity, 'error');
    assert.ok(missing[0].message.includes('deploy'));
    assert.strictEqual(missing[0].line, 1);
  } finally {
    cleanup(repo);
  }
});

test('resolves a `make foo-*` family reference against any prefixed target', () => {
  const repo = makeTmpRepoWithMakefile(MAKEFILE);
  try {
    const parsed = makeParsed({
      mentionedMakeTargets: ['forms-*', 'forms-'],
      lines: ['The `make forms-*` family runs the form gates.'],
    });
    const result = checkMakeTargets(parsed, repo);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.passed, 2);
  } finally {
    cleanup(repo);
  }
});

test('does not treat variable assignments as targets', () => {
  const repo = makeTmpRepoWithMakefile(MAKEFILE);
  try {
    // `CC` and `FLAGS` are assignments, not targets — referencing them should fail.
    const parsed = makeParsed({
      mentionedMakeTargets: ['CC', 'FLAGS'],
      lines: ['`make CC` `make FLAGS`'],
    });
    const result = checkMakeTargets(parsed, repo);
    assert.strictEqual(result.failed, 2);
  } finally {
    cleanup(repo);
  }
});

test('returns an empty result when the repo has no Makefile', () => {
  const repo = makeTmpRepoWithMakefile(); // no Makefile written
  try {
    const parsed = makeParsed({ mentionedMakeTargets: ['build'] });
    const result = checkMakeTargets(parsed, repo);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.passed, 0);
    assert.strictEqual(result.failed, 0);
  } finally {
    cleanup(repo);
  }
});

test('honours a configured severity override', () => {
  const repo = makeTmpRepoWithMakefile(MAKEFILE);
  try {
    const parsed = makeParsed({
      mentionedMakeTargets: ['ghost'],
      lines: ['`make ghost`'],
    });
    const result = checkMakeTargets(parsed, repo, {
      severity: { missingMakeTarget: 'warn' },
    });
    assert.strictEqual(result.issues[0]?.severity, 'warn');
  } finally {
    cleanup(repo);
  }
});

test('skips targets matching ignorePatterns', () => {
  const repo = makeTmpRepoWithMakefile(MAKEFILE);
  try {
    const parsed = makeParsed({
      mentionedMakeTargets: ['ghost'],
      lines: ['`make ghost`'],
    });
    const result = checkMakeTargets(parsed, repo, { ignorePatterns: ['ghost'] });
    assert.strictEqual(result.issues.length, 0);
  } finally {
    cleanup(repo);
  }
});
