import * as fs from 'fs';
import * as path from 'path';
import type { CheckResult, LintIssue, ParsedAgentsMd } from '../types.js';

const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'];
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---/;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)#\s]+)\)/g;

export function checkMemoryFile(parsed: ParsedAgentsMd, filePath: string): CheckResult {
  const issues: LintIssue[] = [];
  let passed = 0;

  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);

  if (basename === 'MEMORY.md') {
    // Validate index links
    const linkRe = new RegExp(MARKDOWN_LINK_RE.source, MARKDOWN_LINK_RE.flags);
    let match;
    let linkCount = 0;
    while ((match = linkRe.exec(parsed.rawContent)) !== null) {
      const linkTarget = match[2];
      if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) continue;
      linkCount++;
      const resolved = path.resolve(dir, linkTarget);
      if (!fs.existsSync(resolved)) {
        issues.push({
          rule: 'memory-broken-link',
          severity: 'error',
          message: `Memory index link broken: ${linkTarget}`,
          suggestion: `"${linkTarget}" no longer exists. Remove this entry or update the link.`,
        });
      } else {
        passed++;
      }
    }
    if (linkCount === 0) {
      issues.push({
        rule: 'memory-index-empty',
        severity: 'info',
        message: 'MEMORY.md has no linked entries — consider splitting into indexed files',
        suggestion: 'An index MEMORY.md links to individual files: `- [Title](file.md) — description`',
      });
    }
  } else {
    // Individual memory entry — validate frontmatter
    const fmMatch = parsed.rawContent.match(FRONTMATTER_RE);
    if (!fmMatch) {
      issues.push({
        rule: 'memory-missing-frontmatter',
        severity: 'error',
        message: 'Memory file is missing frontmatter',
        suggestion: 'Add frontmatter with `name`, `description`, and `type` fields.',
      });
    } else {
      const fm = fmMatch[1];

      if (/^name:\s*\S/m.test(fm)) { passed++; } else {
        issues.push({ rule: 'memory-missing-name', severity: 'warn', message: 'Memory frontmatter missing "name" field', suggestion: 'Add `name: <title>` to the frontmatter block.' });
      }
      if (/^description:\s*\S/m.test(fm)) { passed++; } else {
        issues.push({ rule: 'memory-missing-description', severity: 'warn', message: 'Memory frontmatter missing "description" field', suggestion: 'Add `description: <one-line summary>` to the frontmatter block.' });
      }

      const typeMatch = fm.match(/^type:\s*(.+)$/m);
      if (!typeMatch) {
        issues.push({ rule: 'memory-missing-type', severity: 'warn', message: 'Memory frontmatter missing "type" field', suggestion: `Add \`type: <type>\` — valid types: ${MEMORY_TYPES.join(', ')}.` });
      } else if (!MEMORY_TYPES.includes(typeMatch[1].trim())) {
        issues.push({ rule: 'memory-invalid-type', severity: 'warn', message: `Unknown memory type: "${typeMatch[1].trim()}"`, suggestion: `Valid types are: ${MEMORY_TYPES.join(', ')}.` });
      } else {
        passed++;
      }
    }
  }

  return { checker: 'memory', issues, passed, failed: issues.length };
}
