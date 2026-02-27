import * as fs from 'fs';
import * as path from 'path';
import type { CheckResult, LintIssue, ParsedAgentsMd } from '../types.js';

export function checkFilesystem(
  parsed: ParsedAgentsMd,
  repoRoot: string
): CheckResult {
  const issues: LintIssue[] = [];
  let passed = 0;
  let failed = 0;

  for (const mentionedPath of parsed.mentionedPaths) {
    // Skip URLs and environment variables
    if (mentionedPath.startsWith('http') || mentionedPath.startsWith('$')) {
      continue;
    }

    const absolutePath = path.resolve(repoRoot, mentionedPath);
    const exists = fs.existsSync(absolutePath);

    if (exists) {
      passed++;
    } else {
      failed++;
      // Find the line number where this path is mentioned
      const lineNumber = parsed.lines.findIndex((l) =>
        l.includes(mentionedPath)
      );

      issues.push({
        rule: 'no-missing-path',
        severity: 'error',
        message: `Path does not exist: "${mentionedPath}"`,
        line: lineNumber >= 0 ? lineNumber + 1 : undefined,
        context: lineNumber >= 0 ? parsed.lines[lineNumber]?.trim() : undefined,
        suggestion: `Remove this reference or update it to the correct path. Did the directory get renamed or deleted?`,
      });
    }
  }

  // Also check for common directory patterns that might have changed
  const commonDirs = ['src', 'lib', 'dist', 'build', 'packages', 'apps'];
  for (const dir of commonDirs) {
    const mentions = parsed.lines.filter(
      (l) => l.includes(`/${dir}/`) || l.includes(`./${dir}`)
    );
    if (mentions.length > 0 && !fs.existsSync(path.join(repoRoot, dir))) {
      // Don't double-report if already caught above
      const alreadyReported = issues.some((i) =>
        i.message.includes(`/${dir}`)
      );
      if (!alreadyReported) {
        const lineNumber = parsed.lines.findIndex(
          (l) => l.includes(`/${dir}/`) || l.includes(`./${dir}`)
        );
        issues.push({
          rule: 'no-missing-directory',
          severity: 'warn',
          message: `Directory "/${dir}" is referenced but does not exist in the repo root`,
          line: lineNumber >= 0 ? lineNumber + 1 : undefined,
          context: lineNumber >= 0 ? parsed.lines[lineNumber]?.trim() : undefined,
          suggestion: `Check if the project structure has changed since this AGENTS.md was written.`,
        });
      }
    }
  }

  return {
    checker: 'filesystem',
    issues,
    passed,
    failed,
  };
}
