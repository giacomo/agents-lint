import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore } from '../reporter.js';
import type { CheckResult, LintIssue } from '../types.js';

function makeResult(passed: number, issues: LintIssue[] = []): CheckResult {
  return { checker: 'test', issues, passed, failed: issues.length };
}

test('returns 100 when there are no checks at all', () => {
  assert.strictEqual(computeScore([]), 100);
});

test('returns 100 for all-passed results with no issues', () => {
  const score = computeScore([makeResult(10)]);
  assert.strictEqual(score, 100);
});

test('subtracts 15 per error', () => {
  // 1 passed, 1 failed (the error), penalty 15 → base=50, final=35
  const result = makeResult(1, [{ rule: 'r', severity: 'error', message: 'm' }]);
  assert.strictEqual(computeScore([result]), 35);
});

test('subtracts 7 per warning', () => {
  // 1 passed, 1 failed, penalty 7 → base=50, final=43
  const result = makeResult(1, [{ rule: 'r', severity: 'warn', message: 'm' }]);
  assert.strictEqual(computeScore([result]), 43);
});

test('subtracts 2 per info', () => {
  // 1 passed, 1 failed, penalty 2 → base=50, final=48
  const result = makeResult(1, [{ rule: 'r', severity: 'info', message: 'm' }]);
  assert.strictEqual(computeScore([result]), 48);
});

test('floors score at 0 and never returns a negative number', () => {
  const issues: LintIssue[] = Array.from({ length: 20 }, () => ({
    rule: 'r',
    severity: 'error' as const,
    message: 'm',
  }));
  const score = computeScore([makeResult(0, issues)]);
  assert.strictEqual(score, 0);
});

test('accumulates penalties across multiple checker results', () => {
  const r1 = makeResult(5, [{ rule: 'r', severity: 'error', message: 'm' }]); // penalty 15
  const r2 = makeResult(5, [{ rule: 'r', severity: 'warn', message: 'm' }]);  // penalty 7
  // total: 10 passed, 2 failed, 12 total checks, base=10/12*100≈83, penalty=22 → ≈61
  const score = computeScore([r1, r2]);
  assert.ok(score > 0 && score < 100, `expected score between 0 and 100, got ${score}`);
});
