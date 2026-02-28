import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentsMd } from '../parser.js';
import { writeTmp, cleanupTmp } from './helpers.js';

test('extracts backtick paths starting with ./', () => {
  const tmp = writeTmp('Entry point is `./src/index.ts` in the project.');
  try {
    const parsed = parseAgentsMd(tmp);
    assert.ok(
      parsed.mentionedPaths.includes('./src/index.ts'),
      `expected ./src/index.ts in ${JSON.stringify(parsed.mentionedPaths)}`,
    );
  } finally {
    cleanupTmp(tmp);
  }
});

test('extracts paths from "in `path`" pattern', () => {
  const tmp = writeTmp('The config lives in `config/settings.json` for reference.');
  try {
    const parsed = parseAgentsMd(tmp);
    assert.ok(
      parsed.mentionedPaths.includes('config/settings.json'),
      `expected config/settings.json in ${JSON.stringify(parsed.mentionedPaths)}`,
    );
  } finally {
    cleanupTmp(tmp);
  }
});

test('skips URLs', () => {
  const tmp = writeTmp('See https://example.com/docs for details.');
  try {
    const parsed = parseAgentsMd(tmp);
    const hasUrl = parsed.mentionedPaths.some((p) => p.startsWith('http'));
    assert.strictEqual(hasUrl, false);
  } finally {
    cleanupTmp(tmp);
  }
});

test('skips environment variable paths', () => {
  const tmp = writeTmp('Configured via `$HOME/.config/app` at runtime.');
  try {
    const parsed = parseAgentsMd(tmp);
    const hasEnv = parsed.mentionedPaths.some((p) => p.startsWith('$'));
    assert.strictEqual(hasEnv, false);
  } finally {
    cleanupTmp(tmp);
  }
});

test('skips paths on lines with "no longer" (negating context)', () => {
  const tmp = writeTmp(
    'Middleware are no longer registered in `app/Http/Kernel.php`.',
  );
  try {
    const parsed = parseAgentsMd(tmp);
    assert.ok(
      !parsed.mentionedPaths.includes('app/Http/Kernel.php'),
      'app/Http/Kernel.php should be skipped in negating context',
    );
  } finally {
    cleanupTmp(tmp);
  }
});

test('skips paths on lines with "does not exist" (negating context)', () => {
  const tmp = writeTmp(
    'The `app/Console/Kernel.php` file does not exist in Laravel 12.',
  );
  try {
    const parsed = parseAgentsMd(tmp);
    assert.ok(
      !parsed.mentionedPaths.includes('app/Console/Kernel.php'),
      'app/Console/Kernel.php should be skipped in negating context',
    );
  } finally {
    cleanupTmp(tmp);
  }
});

test('skips paths on lines with "removed" (negating context)', () => {
  const tmp = writeTmp('This was removed from `src/legacy/old-module.ts` in v2.');
  try {
    const parsed = parseAgentsMd(tmp);
    assert.ok(
      !parsed.mentionedPaths.includes('src/legacy/old-module.ts'),
      'path should be skipped when line contains "removed"',
    );
  } finally {
    cleanupTmp(tmp);
  }
});

test('extracts npm run script references', () => {
  const tmp = writeTmp('Run `npm run build` and `npm run test` before committing.');
  try {
    const parsed = parseAgentsMd(tmp);
    assert.ok(parsed.mentionedScripts.includes('build'), 'should include build');
    assert.ok(parsed.mentionedScripts.includes('test'), 'should include test');
  } finally {
    cleanupTmp(tmp);
  }
});

test('parses headings into sections', () => {
  const tmp = writeTmp('# Setup\n\nnpm install\n\n## Testing\n\nnpm test\n');
  try {
    const parsed = parseAgentsMd(tmp);
    const titles = parsed.sections.map((s) => s.title);
    assert.ok(titles.includes('Setup'), `expected Setup in ${JSON.stringify(titles)}`);
    assert.ok(titles.includes('Testing'), `expected Testing in ${JSON.stringify(titles)}`);
  } finally {
    cleanupTmp(tmp);
  }
});
