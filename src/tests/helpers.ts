import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ParsedAgentsMd, ParsedSection } from '../types.js';

/** Writes content to a temp .md file; returns its absolute path. */
export function writeTmp(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-lint-test-'));
  const file = path.join(dir, 'TEST.md');
  fs.writeFileSync(file, content, 'utf-8');
  return file;
}

/** Removes the file and its parent temp directory. */
export function cleanupTmp(filePath: string): void {
  try {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/** Builds a minimal ParsedAgentsMd stub with sensible defaults. */
export function makeParsed(overrides: Partial<ParsedAgentsMd> = {}): ParsedAgentsMd {
  return {
    rawContent: '',
    sections: [] as ParsedSection[],
    mentionedPaths: [],
    mentionedScripts: [],
    mentionedDependencies: [],
    mentionedFrameworks: [],
    lines: [],
    ...overrides,
  };
}

/** Creates a temp directory; writes package.json if provided. Returns dir path. */
export function makeTmpRepo(pkgJson?: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-lint-repo-'));
  if (pkgJson !== undefined) {
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify(pkgJson),
      'utf-8',
    );
  }
  return dir;
}

/** Removes a temp repo directory. */
export function cleanupRepo(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * Builds a ParsedAgentsMd from raw markdown string, including sections and lines.
 * Useful for structure checker tests.
 */
export function parsedFromContent(content: string): ParsedAgentsMd {
  const lines = content.split('\n');
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  lines.forEach((line, i) => {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) {
      if (current) {
        current.endLine = i - 1;
        sections.push(current);
      }
      current = { title: m[2].trim(), content: '', startLine: i, endLine: i };
    } else if (current) {
      current.content += line + '\n';
    }
  });
  if (current) {
    (current as ParsedSection).endLine = lines.length - 1;
    sections.push(current as ParsedSection);
  }

  return makeParsed({ rawContent: content, lines, sections });
}
