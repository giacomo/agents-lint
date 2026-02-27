import * as fs from 'fs';
import * as path from 'path';
import type { CheckResult, LintIssue, ParsedAgentsMd } from '../types.js';

interface PackageJson {
  scripts?: Record<string, string>;
  name?: string;
  version?: string;
}

export function checkNpmScripts(
  parsed: ParsedAgentsMd,
  repoRoot: string
): CheckResult {
  const issues: LintIssue[] = [];
  let passed = 0;
  let failed = 0;

  // Find all package.json files (root + workspaces)
  const packageJsonPaths = findPackageJsonFiles(repoRoot);
  const allScripts = new Set<string>();

  for (const pkgPath of packageJsonPaths) {
    try {
      const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts) {
        Object.keys(pkg.scripts).forEach((s) => allScripts.add(s));
      }
    } catch {
      // Ignore malformed package.json
    }
  }

  if (packageJsonPaths.length === 0) {
    // No package.json found - skip npm checks
    return { checker: 'npm-scripts', issues: [], passed: 0, failed: 0 };
  }

  for (const script of parsed.mentionedScripts) {
    if (allScripts.has(script)) {
      passed++;
    } else {
      failed++;
      const lineNumber = parsed.lines.findIndex((l) =>
        l.includes(`run ${script}`) ||
        l.includes(`yarn ${script}`) ||
        l.includes(`pnpm ${script}`)
      );

      issues.push({
        rule: 'no-missing-script',
        severity: 'warn',
        message: `Script "${script}" is mentioned but not found in any package.json`,
        line: lineNumber >= 0 ? lineNumber + 1 : undefined,
        context: lineNumber >= 0 ? parsed.lines[lineNumber]?.trim() : undefined,
        suggestion: `Available scripts: ${[...allScripts].slice(0, 5).join(', ')}${allScripts.size > 5 ? '...' : ''}`,
      });
    }
  }

  // Check for test script specifically - important for agents
  if (!allScripts.has('test') && !allScripts.has('test:unit') && !allScripts.has('test:run')) {
    issues.push({
      rule: 'missing-test-script',
      severity: 'warn',
      message: 'No test script found in package.json — coding agents need a test command to verify their work',
      suggestion: 'Add a "test" script to package.json so agents can validate their changes automatically',
    });
  } else {
    passed++;
  }

  return {
    checker: 'npm-scripts',
    issues,
    passed,
    failed,
  };
}

function findPackageJsonFiles(repoRoot: string): string[] {
  const found: string[] = [];
  const rootPkg = path.join(repoRoot, 'package.json');

  if (fs.existsSync(rootPkg)) {
    found.push(rootPkg);

    // Check for workspaces
    try {
      const pkg = JSON.parse(fs.readFileSync(rootPkg, 'utf-8'));
      const workspaces: string[] = Array.isArray(pkg.workspaces)
        ? pkg.workspaces
        : pkg.workspaces?.packages ?? [];

      for (const ws of workspaces.slice(0, 20)) {
        // Limit to avoid huge monorepos
        const wsPath = path.join(repoRoot, ws.replace(/\/\*$/, ''));
        if (fs.existsSync(wsPath)) {
          const wsPkg = path.join(wsPath, 'package.json');
          if (fs.existsSync(wsPkg)) found.push(wsPkg);
        }
      }
    } catch {
      // Ignore
    }
  }

  return found;
}
