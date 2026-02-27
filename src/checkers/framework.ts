import * as fs from 'fs';
import * as path from 'path';
import type { CheckResult, LintIssue, ParsedAgentsMd } from '../types.js';

interface FrameworkCheck {
  pattern: RegExp;
  rule: string;
  message: string;
  suggestion: string;
}

const FRAMEWORK_CHECKS: Record<string, FrameworkCheck[]> = {
  angular: [
    {
      pattern: /NgModule|@NgModule/,
      rule: 'angular-ngmodule-deprecated',
      message: 'References NgModules — Angular 14+ uses standalone components by default',
      suggestion: 'Update AGENTS.md to reflect standalone component architecture. NgModules are being phased out in modern Angular.',
    },
    {
      pattern: /ngcc|ivy\s+compat/i,
      rule: 'angular-ngcc-deprecated',
      message: 'References ngcc (Angular Compatibility Compiler) — removed in Angular v16+',
      suggestion: 'Remove ngcc references. Only full Ivy is supported in modern Angular.',
    },
    {
      pattern: /enableIvy:\s*false/,
      rule: 'angular-ivy-disabled',
      message: 'References disabling Ivy renderer — not supported in Angular 13+',
      suggestion: 'Remove enableIvy: false. Ivy is the only renderer in modern Angular.',
    },
    {
      pattern: /\bpromiseToObservable\b|\btoPromise\(\)/,
      rule: 'angular-topromise-deprecated',
      message: 'References .toPromise() — deprecated in RxJS 7, removed in RxJS 8',
      suggestion: 'Replace .toPromise() with firstValueFrom() or lastValueFrom() from rxjs',
    },
  ],
  react: [
    {
      pattern: /componentDidMount|componentWillMount|componentWillUnmount|componentDidUpdate/,
      rule: 'react-class-lifecycle',
      message: 'References class component lifecycle methods — React 18+ recommends hooks',
      suggestion: 'Consider updating AGENTS.md to use hooks (useEffect, useState) instead of class lifecycle methods.',
    },
    {
      pattern: /ReactDOM\.render\(/,
      rule: 'react-legacy-render',
      message: 'References ReactDOM.render() — deprecated in React 18, removed in React 19',
      suggestion: 'Replace ReactDOM.render() with createRoot().render() from react-dom/client',
    },
    {
      pattern: /componentWillMount|UNSAFE_componentWillMount/,
      rule: 'react-unsafe-lifecycle',
      message: 'References unsafe lifecycle methods',
      suggestion: 'Use useEffect hook instead.',
    },
  ],
  next: [
    {
      pattern: /getInitialProps/,
      rule: 'nextjs-getinitialprops-legacy',
      message: 'References getInitialProps — legacy API, prefer getStaticProps/getServerSideProps or App Router',
      suggestion: 'Migrate to getStaticProps, getServerSideProps, or the Next.js App Router.',
    },
    {
      pattern: /pages\/_app|pages\/_document/,
      rule: 'nextjs-pages-router',
      message: 'References Pages Router patterns — Next.js 13+ recommends App Router',
      suggestion: 'Consider if this project has migrated or plans to migrate to App Router.',
    },
  ],
  node: [
    {
      pattern: /require\(['"]|module\.exports/,
      rule: 'node-commonjs-in-esm-project',
      message: 'References CommonJS (require/module.exports) syntax',
      suggestion: 'If this is an ESM project, update AGENTS.md to use import/export syntax.',
    },
  ],
};

export function checkFrameworkStaleness(
  parsed: ParsedAgentsMd,
  repoRoot: string
): CheckResult {
  const issues: LintIssue[] = [];
  let passed = 0;

  // Detect which frameworks are in use
  const detectedFrameworks = detectFrameworks(repoRoot);

  for (const framework of detectedFrameworks) {
    const checks = FRAMEWORK_CHECKS[framework] ?? [];

    for (const check of checks) {
      const match = check.pattern.test(parsed.rawContent);
      if (match) {
        const lineNumber = parsed.lines.findIndex((l) =>
          check.pattern.test(l)
        );
        issues.push({
          rule: check.rule,
          severity: 'warn',
          message: check.message,
          line: lineNumber >= 0 ? lineNumber + 1 : undefined,
          context: lineNumber >= 0 ? parsed.lines[lineNumber]?.trim() : undefined,
          suggestion: check.suggestion,
        });
      } else {
        passed++;
      }
    }
  }

  // General staleness checks (apply to all projects)
  const generalChecks: FrameworkCheck[] = [
    {
      pattern: /node\s+v?(1[0-5]|[0-9])\./i,
      rule: 'old-node-version',
      message: 'References an outdated Node.js version (< 16)',
      suggestion: 'Update to Node.js 20 LTS or later. Node 18+ is required for many modern tools.',
    },
    {
      pattern: /npm\s+v?(5|6)\./i,
      rule: 'old-npm-version',
      message: 'References an outdated npm version (< 7)',
      suggestion: 'Update npm to v9+ or consider migrating to pnpm or bun.',
    },
  ];

  for (const check of generalChecks) {
    if (check.pattern.test(parsed.rawContent)) {
      const lineNumber = parsed.lines.findIndex((l) => check.pattern.test(l));
      issues.push({
        rule: check.rule,
        severity: 'warn',
        message: check.message,
        line: lineNumber >= 0 ? lineNumber + 1 : undefined,
        suggestion: check.suggestion,
      });
    }
  }

  return {
    checker: 'framework-staleness',
    issues,
    passed,
    failed: issues.length,
  };
}

function detectFrameworks(repoRoot: string): string[] {
  const detected: string[] = [];
  const pkgPath = path.join(repoRoot, 'package.json');

  if (!fs.existsSync(pkgPath)) return detected;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    if (allDeps['@angular/core']) detected.push('angular');
    if (allDeps['react']) detected.push('react');
    if (allDeps['next']) detected.push('next');
    if (allDeps['vue']) detected.push('vue');
    if (allDeps['nuxt']) detected.push('nuxt');
    if (allDeps['svelte']) detected.push('svelte');
    if (!detected.length && fs.existsSync(path.join(repoRoot, 'package.json'))) {
      detected.push('node');
    }
  } catch {
    // Ignore
  }

  return detected;
}
