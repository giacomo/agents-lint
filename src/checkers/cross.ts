import type { CheckResult, LintIssue, ParsedAgentsMd } from '../types.js';

export interface FileContext {
  relativePath: string;
  parsed: ParsedAgentsMd;
}

// ── Package manager detection ─────────────────────────────────────────────────

type PM = 'bun' | 'pnpm' | 'yarn' | 'npm';

function detectPM(content: string): PM | null {
  if (/\bbun\s+(install|add|run)\b/.test(content))  return 'bun';
  if (/\bpnpm\s+(install|add|run)\b/.test(content)) return 'pnpm';
  if (/\byarn\s+(install|add|run)\b/.test(content)) return 'yarn';
  if (/\bnpm\s+(install|run|ci)\b/.test(content))   return 'npm';
  return null;
}

// ── Script role classification ────────────────────────────────────────────────

const SCRIPT_ROLES: Array<[string, RegExp]> = [
  ['test',  /^test(?::.*)?$|^e2e(?::.*)?$|^spec(?::.*)?$|^cypress(?::.*)?$|^jest(?::.*)?$|^vitest(?::.*)?$/i],
  ['build', /^build(?::.*)?$|^compile(?::.*)?$|^bundle(?::.*)?$/i],
  ['lint',  /^lint(?::.*)?$|^eslint(?::.*)?$|^check(?::.*)?$/i],
  ['dev',   /^dev$|^development$|^start$|^serve$/i],
];

function getRole(script: string): string | null {
  for (const [role, re] of SCRIPT_ROLES) {
    if (re.test(script)) return role;
  }
  return null;
}

function groupByRole(scripts: string[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const s of scripts) {
    const role = getRole(s);
    if (role) {
      if (!map.has(role)) map.set(role, new Set());
      map.get(role)!.add(s);
    }
  }
  return map;
}

// ── Main checker ──────────────────────────────────────────────────────────────

export function checkCrossConsistency(files: FileContext[]): CheckResult {
  if (files.length < 2) {
    return { checker: 'cross-consistency', issues: [], passed: 0, failed: 0 };
  }

  const issues: LintIssue[] = [];
  let passed = 0;

  // ── Check 1: Package manager conflicts ─────────────────────────────────────
  const pmByFile = files.map((f) => ({ rel: f.relativePath, pm: detectPM(f.parsed.rawContent) }));
  const distinctPMs = [...new Set(pmByFile.map((f) => f.pm).filter((p): p is PM => p !== null))];

  if (distinctPMs.length > 1) {
    const detail = pmByFile
      .filter((f) => f.pm !== null)
      .map((f) => `${f.rel} → ${f.pm}`)
      .join(', ');
    issues.push({
      rule: 'cross-pm-conflict',
      severity: 'error',
      message: 'Conflicting package managers referenced across context files',
      context: detail,
      suggestion: 'Pick one package manager and update all context files to use it consistently.',
    });
  } else {
    passed++;
  }

  // ── Check 2: Script role conflicts ─────────────────────────────────────────
  const rolesByFile = files.map((f) => ({
    rel: f.relativePath,
    roles: groupByRole(f.parsed.mentionedScripts),
  }));

  const allRoles = new Set(rolesByFile.flatMap((f) => [...f.roles.keys()]));

  for (const role of allRoles) {
    // Collect which files have scripts for this role
    const filesWithRole = rolesByFile
      .map((f) => ({ rel: f.rel, scripts: f.roles.get(role) }))
      .filter((f): f is { rel: string; scripts: Set<string> } => f.scripts !== undefined && f.scripts.size > 0);

    if (filesWithRole.length < 2) continue; // only in one file — not a conflict

    const allScripts = new Set(filesWithRole.flatMap((f) => [...f.scripts]));
    if (allScripts.size > 1) {
      const detail = filesWithRole
        .map((f) => `${f.rel} → ${[...f.scripts].join(', ')}`)
        .join(' vs ');
      issues.push({
        rule: `cross-script-conflict-${role}`,
        severity: 'warn',
        message: `Conflicting ${role} commands across context files`,
        context: detail,
        suggestion: `Agents reading different files will use different ${role} commands. Align them to use the same command.`,
      });
    } else {
      passed++;
    }
  }

  // ── Check 3: One-sided path references (info, capped at 5) ─────────────────
  const allOtherPaths = (exclude: string) =>
    new Set(
      files
        .filter((f) => f.relativePath !== exclude)
        .flatMap((f) => f.parsed.mentionedPaths),
    );

  let pathIssueCount = 0;
  for (const file of files) {
    if (pathIssueCount >= 5) break;
    const others = allOtherPaths(file.relativePath);

    for (const p of file.parsed.mentionedPaths) {
      if (pathIssueCount >= 5) break;
      // Only flag "significant" paths (≥ 3 segments, e.g. ./src/services/auth)
      if (p.split('/').filter(Boolean).length < 3) continue;
      // Skip if any other file mentions the same path or a related parent/child
      const covered = [...others].some((op) => op === p || p.startsWith(op + '/') || op.startsWith(p + '/'));
      if (!covered) {
        pathIssueCount++;
        const others2 = files
          .filter((f) => f.relativePath !== file.relativePath)
          .map((f) => f.relativePath)
          .join(', ');
        issues.push({
          rule: 'cross-path-asymmetry',
          severity: 'info',
          message: `Path "${p}" referenced in ${file.relativePath} but not in ${others2}`,
          suggestion: 'Consider documenting this path in all context files, or verify it is still relevant.',
        });
      }
    }
    if (pathIssueCount === 0) passed++;
  }

  return {
    checker: 'cross-consistency',
    issues,
    passed,
    failed: issues.length,
  };
}
