import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMemoryFile } from '../../checkers/memory.js';
import { makeParsed } from '../helpers.js';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeTmpMemoryDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agents-lint-memory-'));
}

function cleanup(dir: string): void {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ── MEMORY.md index checks ─────────────────────────────────────────────────────

test('passes when MEMORY.md index links resolve to existing files', () => {
  const dir = makeTmpMemoryDir();
  try {
    fs.writeFileSync(path.join(dir, 'user_role.md'), '# user role', 'utf-8');
    const content = '# Memory\n\n- [User role](user_role.md) — who the user is\n';
    const filePath = path.join(dir, 'MEMORY.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    const parsed = makeParsed({ rawContent: content, fileType: 'memory' });
    const result = checkMemoryFile(parsed, filePath);
    assert.strictEqual(result.issues.filter((i) => i.rule === 'memory-broken-link').length, 0);
    assert.ok(result.passed > 0);
  } finally {
    cleanup(dir);
  }
});

test('reports error for broken link in MEMORY.md', () => {
  const dir = makeTmpMemoryDir();
  try {
    const content = '# Memory\n\n- [Missing file](gone.md) — description\n';
    const filePath = path.join(dir, 'MEMORY.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    const parsed = makeParsed({ rawContent: content, fileType: 'memory' });
    const result = checkMemoryFile(parsed, filePath);
    const issue = result.issues.find((i) => i.rule === 'memory-broken-link');
    assert.ok(issue, 'expected memory-broken-link issue');
    assert.strictEqual(issue!.severity, 'error');
  } finally {
    cleanup(dir);
  }
});

test('reports info when MEMORY.md has no linked entries', () => {
  const dir = makeTmpMemoryDir();
  try {
    const content = '# Memory\n\nSome prose with no markdown links.\n';
    const filePath = path.join(dir, 'MEMORY.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    const parsed = makeParsed({ rawContent: content, fileType: 'memory' });
    const result = checkMemoryFile(parsed, filePath);
    const issue = result.issues.find((i) => i.rule === 'memory-index-empty');
    assert.ok(issue, 'expected memory-index-empty issue');
    assert.strictEqual(issue!.severity, 'info');
  } finally {
    cleanup(dir);
  }
});

test('skips external http links when checking MEMORY.md', () => {
  const dir = makeTmpMemoryDir();
  try {
    const content = '# Memory\n\n- [Docs](https://example.com/docs) — external link\n';
    const filePath = path.join(dir, 'MEMORY.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    const parsed = makeParsed({ rawContent: content, fileType: 'memory' });
    const result = checkMemoryFile(parsed, filePath);
    assert.strictEqual(result.issues.filter((i) => i.rule === 'memory-broken-link').length, 0);
  } finally {
    cleanup(dir);
  }
});

// ── Individual memory entry checks ─────────────────────────────────────────────

test('passes for a valid individual memory entry', () => {
  const dir = makeTmpMemoryDir();
  try {
    const content =
      '---\nname: User role\ndescription: Describes who the user is\ntype: user\n---\n\nThe user is a senior developer.\n';
    const filePath = path.join(dir, 'user_role.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    const parsed = makeParsed({ rawContent: content, fileType: 'memory' });
    const result = checkMemoryFile(parsed, filePath);
    assert.strictEqual(result.issues.length, 0);
    assert.ok(result.passed >= 3);
  } finally {
    cleanup(dir);
  }
});

test('reports error when individual memory entry has no frontmatter', () => {
  const dir = makeTmpMemoryDir();
  try {
    const content = '# Some memory\n\nNo frontmatter at all.\n';
    const filePath = path.join(dir, 'feedback_test.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    const parsed = makeParsed({ rawContent: content, fileType: 'memory' });
    const result = checkMemoryFile(parsed, filePath);
    const issue = result.issues.find((i) => i.rule === 'memory-missing-frontmatter');
    assert.ok(issue, 'expected memory-missing-frontmatter issue');
    assert.strictEqual(issue!.severity, 'error');
  } finally {
    cleanup(dir);
  }
});

test('reports warn when memory entry has invalid type', () => {
  const dir = makeTmpMemoryDir();
  try {
    const content = '---\nname: Test\ndescription: A test\ntype: custom\n---\n\nContent.\n';
    const filePath = path.join(dir, 'test.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    const parsed = makeParsed({ rawContent: content, fileType: 'memory' });
    const result = checkMemoryFile(parsed, filePath);
    const issue = result.issues.find((i) => i.rule === 'memory-invalid-type');
    assert.ok(issue, 'expected memory-invalid-type issue');
    assert.strictEqual(issue!.severity, 'warn');
  } finally {
    cleanup(dir);
  }
});

test('reports warn when memory entry is missing name field', () => {
  const dir = makeTmpMemoryDir();
  try {
    const content = '---\ndescription: A test\ntype: feedback\n---\n\nContent.\n';
    const filePath = path.join(dir, 'test.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    const parsed = makeParsed({ rawContent: content, fileType: 'memory' });
    const result = checkMemoryFile(parsed, filePath);
    const issue = result.issues.find((i) => i.rule === 'memory-missing-name');
    assert.ok(issue, 'expected memory-missing-name issue');
    assert.strictEqual(issue!.severity, 'warn');
  } finally {
    cleanup(dir);
  }
});

test('reports warn when memory entry is missing description field', () => {
  const dir = makeTmpMemoryDir();
  try {
    const content = '---\nname: Test\ntype: project\n---\n\nContent.\n';
    const filePath = path.join(dir, 'test.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    const parsed = makeParsed({ rawContent: content, fileType: 'memory' });
    const result = checkMemoryFile(parsed, filePath);
    const issue = result.issues.find((i) => i.rule === 'memory-missing-description');
    assert.ok(issue, 'expected memory-missing-description issue');
    assert.strictEqual(issue!.severity, 'warn');
  } finally {
    cleanup(dir);
  }
});

test('accepts all valid memory types', () => {
  const dir = makeTmpMemoryDir();
  try {
    for (const type of ['user', 'feedback', 'project', 'reference']) {
      const content = `---\nname: Test\ndescription: A test\ntype: ${type}\n---\n\nContent.\n`;
      const filePath = path.join(dir, `${type}.md`);
      fs.writeFileSync(filePath, content, 'utf-8');
      const parsed = makeParsed({ rawContent: content, fileType: 'memory' });
      const result = checkMemoryFile(parsed, filePath);
      const typeIssues = result.issues.filter(
        (i) => i.rule === 'memory-invalid-type' || i.rule === 'memory-missing-type',
      );
      assert.strictEqual(typeIssues.length, 0, `type "${type}" should be valid`);
    }
  } finally {
    cleanup(dir);
  }
});
