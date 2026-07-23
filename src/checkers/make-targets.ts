import * as fs from 'fs';
import * as path from 'path';
import type { CheckResult, LintIssue, ParsedAgentsMd, LintConfig, Severity } from '../types.js';

// Makefile filenames GNU make looks for, in precedence order.
const MAKEFILE_NAMES = ['GNUmakefile', 'makefile', 'Makefile'];

/**
 * Verifies that every `make <target>` referenced in a context file names a target
 * actually defined in the repo's Makefile. This is the Make/Go analogue of the
 * npm-scripts checker: instruction files for Go, C, Rust, or any Make-driven repo
 * are dense with `make lint` / `make test` commands that silently rot when a
 * target is renamed or removed, leaving agents to run dead commands.
 *
 * If the repo has no Makefile the checker is a no-op (mirrors npm-scripts skipping
 * when there is no package.json).
 */
export function checkMakeTargets(
  parsed: ParsedAgentsMd,
  repoRoot: string,
  config: LintConfig = {}
): CheckResult {
  const issues: LintIssue[] = [];
  let passed = 0;
  let failed = 0;
  const ignorePatterns = config.ignorePatterns ?? [];
  const missingTargetSeverity: Severity = config.severity?.missingMakeTarget ?? 'error';

  const targets = readMakefileTargets(repoRoot);
  if (targets === null) {
    // No Makefile in this repo — nothing to validate against.
    return { checker: 'make-targets', issues: [], passed: 0, failed: 0 };
  }

  for (const mention of parsed.mentionedMakeTargets) {
    if (ignorePatterns.some((p) => mention.includes(p))) continue;

    if (makeTargetExists(targets, mention)) {
      passed++;
      continue;
    }

    failed++;
    const lineNumber = parsed.lines.findIndex((l) => l.includes(`make ${mention}`));
    issues.push({
      rule: 'no-missing-make-target',
      severity: missingTargetSeverity,
      message: `Make target "${mention}" is mentioned but not defined in the Makefile`,
      line: lineNumber >= 0 ? lineNumber + 1 : undefined,
      context: lineNumber >= 0 ? parsed.lines[lineNumber]?.trim() : undefined,
      suggestion: `Did the target get renamed or removed? Available targets: ${[...targets].slice(0, 5).join(', ')}${targets.size > 5 ? '…' : ''}`,
    });
  }

  return { checker: 'make-targets', issues, passed, failed };
}

/**
 * A `make foo-*` (or `make foo-`) reference names a target *family* — common when
 * docs describe a group of related targets (`make forms-check`, `make forms-lint`).
 * It is satisfied by any defined target sharing that prefix. A plain reference must
 * match a target exactly.
 */
function makeTargetExists(targets: Set<string>, mention: string): boolean {
  const isWildcard = mention.includes('*') || mention.endsWith('-');
  if (!isWildcard) return targets.has(mention);

  const prefix = mention.replace(/\*$/, '').replace(/-$/, '');
  if (prefix === '') return false;
  for (const t of targets) {
    if (t === prefix || t.startsWith(prefix + '-')) return true;
  }
  return false;
}

/**
 * Parses the repo's Makefile into the set of defined target names. Returns null
 * when no Makefile exists so the caller can skip cleanly. Skips recipe lines
 * (tab-indented), comments, variable assignments (`FOO := bar`), and pattern
 * rules (`%.o: %.c`), and expands multi-target lines (`a b c:` → a, b, c).
 */
function readMakefileTargets(repoRoot: string): Set<string> | null {
  let content: string | null = null;
  for (const name of MAKEFILE_NAMES) {
    const p = path.join(repoRoot, name);
    if (fs.existsSync(p)) {
      try {
        content = fs.readFileSync(p, 'utf-8');
      } catch {
        // Unreadable — treat as absent.
      }
      break;
    }
  }
  if (content === null) return null;

  const targets = new Set<string>();
  for (const rawLine of content.split('\n')) {
    if (rawLine.startsWith('\t')) continue; // recipe line
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    // Variable assignment (FOO = bar, FOO := bar, FOO ?= bar, FOO += bar), not a target.
    if (/^[A-Za-z_][\w.-]*\s*[:?+]?=/.test(trimmed)) continue;

    const colonIdx = rawLine.indexOf(':');
    if (colonIdx <= 0) continue;
    const lhs = rawLine.slice(0, colonIdx);
    if (lhs.includes('%')) continue; // pattern rule, not an invocable name

    for (const tok of lhs.split(/\s+/)) {
      // Skip .PHONY and other dot-directives; keep ordinary target names.
      if (tok && !tok.startsWith('.') && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(tok)) {
        targets.add(tok);
      }
    }
  }
  return targets;
}
