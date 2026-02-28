import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStructure } from '../../checkers/structure.js';
import { parsedFromContent } from '../helpers.js';

// Minimum-length content with all three sections (>100 chars to avoid too-short warning)
const FULL_CONTENT =
  '# Setup\n\nRun `npm install` to install all dependencies for the project.\n\n' +
  '## Testing\n\nRun `npm test` to execute the full test suite.\n\n' +
  '## Build\n\nRun `npm run build` to compile TypeScript to JavaScript.\n';

test('no missing-section issues when Setup, Testing, and Build are present', () => {
  const parsed = parsedFromContent(FULL_CONTENT);
  const result = checkStructure(parsed);
  const sectionIssues = result.issues.filter((i) => i.rule.startsWith('missing-'));
  assert.strictEqual(sectionIssues.length, 0, JSON.stringify(result.issues));
});

test('reports missing-test-section when Testing section is absent', () => {
  const content =
    '# Setup\n\nRun `npm install` to install all dependencies for the project.\n\n' +
    '## Build\n\nRun `npm run build` to compile TypeScript to JavaScript.\n';
  const parsed = parsedFromContent(content);
  const result = checkStructure(parsed);
  const issue = result.issues.find((i) => i.rule === 'missing-test-section');
  assert.ok(issue, 'expected missing-test-section issue');
});

test('reports too-many-todos when more than 3 TODO markers are present', () => {
  const content = FULL_CONTENT + 'TODO: a\nTODO: b\nTODO: c\nTODO: d\n';
  const parsed = parsedFromContent(content);
  const result = checkStructure(parsed);
  const issue = result.issues.find((i) => i.rule === 'too-many-todos');
  assert.ok(issue, 'expected too-many-todos issue');
  assert.strictEqual(issue!.severity, 'info');
});

test('reports old-year-reference for years before 2024', () => {
  const content = FULL_CONTENT + 'This API was introduced in 2021.\n';
  const parsed = parsedFromContent(content);
  const result = checkStructure(parsed);
  const issue = result.issues.find((i) => i.rule === 'old-year-reference');
  assert.ok(issue, 'expected old-year-reference issue');
});

test('reports too-short when content is under 100 characters', () => {
  const parsed = parsedFromContent('# Setup\nshort');
  const result = checkStructure(parsed);
  const issue = result.issues.find((i) => i.rule === 'too-short');
  assert.ok(issue, 'expected too-short issue');
  assert.strictEqual(issue!.severity, 'warn');
});

test('respects custom requiredSections from config', () => {
  const parsed = parsedFromContent(FULL_CONTENT);
  const result = checkStructure(parsed, { requiredSections: ['Architecture'] });
  const custom = result.issues.find((i) =>
    i.rule === 'missing-custom-section-architecture',
  );
  assert.ok(custom, 'expected custom section issue for Architecture');
});
