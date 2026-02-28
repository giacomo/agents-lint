import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFrameworkStaleness } from '../../checkers/framework.js';
import { makeParsed, makeTmpRepo, cleanupRepo } from '../helpers.js';

test('detects ReactDOM.render() as stale in a React project', () => {
  const repo = makeTmpRepo({
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
  });
  try {
    const line = 'ReactDOM.render(<App />, document.getElementById("root"));';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'react-legacy-render');
    assert.ok(issue, 'expected react-legacy-render issue');
    assert.strictEqual(issue!.severity, 'warn');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects @NgModule as stale in an Angular project', () => {
  const repo = makeTmpRepo({ dependencies: { '@angular/core': '^17.0.0' } });
  try {
    const line = 'Use @NgModule to declare all your components.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'angular-ngmodule-deprecated');
    assert.ok(issue, 'expected angular-ngmodule-deprecated issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('no React issues for clean modern React content', () => {
  const repo = makeTmpRepo({ dependencies: { react: '^19.0.0' } });
  try {
    const line = 'Use createRoot().render() to mount the app.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const reactIssues = result.issues.filter((i) => i.rule.startsWith('react-'));
    assert.strictEqual(reactIssues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

test('detects outdated Node.js version reference regardless of framework', () => {
  const repo = makeTmpRepo({}); // empty package.json → 'node' framework detected
  try {
    const line = 'Requires Node v14.0 or higher to run this project.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'old-node-version');
    assert.ok(issue, 'expected old-node-version issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('returns no issues for content with no stale patterns', () => {
  const repo = makeTmpRepo({});
  try {
    const line = 'Run npm install and npm run build to get started.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    assert.strictEqual(result.issues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});
