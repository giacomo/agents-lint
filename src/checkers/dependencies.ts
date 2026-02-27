import * as fs from 'fs';
import * as path from 'path';
import type { CheckResult, LintIssue, ParsedAgentsMd, LintConfig, Severity } from '../types.js';

const DEPRECATED_PACKAGES: Record<string, string> = {
  'request': 'axios or node-fetch',
  'moment': 'date-fns or dayjs',
  'lodash': 'native JS methods or a smaller util',
  'tslint': 'eslint with @typescript-eslint',
  'node-sass': 'sass (Dart Sass)',
  'babel-eslint': '@babel/eslint-parser',
  'eslint-plugin-prettier': 'prettier via editor integration',
  'react-scripts': 'vite or create-vite',
  'webpack': 'vite (unless legacy)',
};

export function checkDependencies(
  parsed: ParsedAgentsMd,
  repoRoot: string,
  config: LintConfig = {}
): CheckResult {
  const issues: LintIssue[] = [];
  let passed = 0;
  let failed = 0;
  const staleDependencySeverity: Severity = config.severity?.staleDependency ?? 'info';
  const ignorePatterns = config.ignorePatterns ?? [];

  const pkgPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { checker: 'dependencies', issues: [], passed: 0, failed: 0 };
  }

  let pkg: any;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return { checker: 'dependencies', issues: [], passed: 0, failed: 0 };
  }

  const allDeps = new Set<string>([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);

  // Check mentioned dependencies exist
  for (const dep of parsed.mentionedDependencies) {
    if (ignorePatterns.some((p) => dep.includes(p))) continue;
    const normalized = dep.toLowerCase().replace(/^@types\//, '');
    const exists =
      allDeps.has(dep) ||
      allDeps.has(`@types/${dep}`) ||
      [...allDeps].some((d) => d.toLowerCase().includes(normalized));

    if (exists) {
      passed++;
    } else {
      // Don't fail on common framework names that might be mentioned contextually
      const commonFrameworks = ['react', 'angular', 'vue', 'node', 'typescript', 'javascript'];
      if (!commonFrameworks.includes(dep.toLowerCase())) {
        failed++;
        const lineNumber = parsed.lines.findIndex((l) =>
          l.toLowerCase().includes(dep.toLowerCase())
        );
        issues.push({
          rule: 'no-missing-dependency',
          severity: 'warn',
          message: `Package "${dep}" is mentioned but not found in package.json`,
          line: lineNumber >= 0 ? lineNumber + 1 : undefined,
          suggestion: `Either add "${dep}" to package.json or remove the reference from this context file`,
        });
      }
    }
  }

  // Check for deprecated packages in use
  for (const [deprecated, replacement] of Object.entries(DEPRECATED_PACKAGES)) {
    if (allDeps.has(deprecated)) {
      const lineNumber = parsed.lines.findIndex((l) =>
        l.includes(deprecated)
      );
      issues.push({
        rule: 'deprecated-dependency',
        severity: staleDependencySeverity,
        message: `Package "${deprecated}" is deprecated`,
        line: lineNumber >= 0 ? lineNumber + 1 : undefined,
        suggestion: `Consider migrating to: ${replacement}`,
      });
    }
  }

  return {
    checker: 'dependencies',
    issues,
    passed,
    failed,
  };
}
