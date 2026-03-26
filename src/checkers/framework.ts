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
    {
      pattern: /::ng-deep/,
      rule: 'angular-ng-deep-deprecated',
      message: 'References ::ng-deep — deprecated in Angular 14+, will be removed in a future release',
      suggestion: 'Avoid ::ng-deep. Use Angular CDK style encapsulation, global styles, or the :host-context() combinator instead.',
    },
    {
      pattern: /@Input\s*\(\s*\)|@Output\s*\(\s*\)/,
      rule: 'angular-decorator-input-output',
      message: 'References @Input()/@Output() decorators — Angular 17+ prefers signal-based input()/output() APIs',
      suggestion: 'Use the signal-based input(), output(), and model() functions from @angular/core instead of @Input/@Output decorators.',
    },
    {
      pattern: /\bNgClass\b|\bNgStyle\b/,
      rule: 'angular-ngclass-ngstyle',
      message: 'References NgClass/NgStyle directives — Angular 17+ prefers native class/style bindings',
      suggestion: 'Use [class.foo]="condition" and [style.color]="value" bindings instead of NgClass/NgStyle for better performance.',
    },
    {
      pattern: /constructor\s*\([^)]*(?:private|public|protected|readonly)\s+\w+\s*:\s*[A-Z]\w*/,
      rule: 'angular-constructor-injection',
      message: 'References constructor-based DI — Angular 17+ recommends the inject() function',
      suggestion: 'Replace constructor parameter injection with inject(MyService) at the field level for better tree-shaking and testability.',
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

  symfony: [
    {
      pattern: /SwiftMailer|swiftmailer\/swiftmailer/i,
      rule: 'symfony-swiftmailer-removed',
      message: 'References SwiftMailer — removed in Symfony 6.0, replaced by Symfony Mailer',
      suggestion: 'Replace SwiftMailer references with Symfony Mailer (symfony/mailer).',
    },
    {
      pattern: /@Route\s*\(/,
      rule: 'symfony-annotation-routing',
      message: 'References @Route annotation syntax — Symfony 6+ prefers PHP 8 attributes (#[Route])',
      suggestion: 'Update to PHP 8 attribute syntax: #[Route(\'/path\', name: \'route_name\')].',
    },
    {
      pattern: /sensio\/framework-extra-bundle|SensioFrameworkExtraBundle/i,
      rule: 'symfony-sensio-extra-abandoned',
      message: 'References sensio/framework-extra-bundle — abandoned, not compatible with Symfony 7',
      suggestion: 'Remove this bundle. Use native Symfony routing attributes and ParamConverter alternatives.',
    },
    {
      pattern: /FOSUserBundle|fos\/user-bundle/i,
      rule: 'symfony-fosuserbundle-abandoned',
      message: 'References FOSUserBundle — abandoned since 2021, incompatible with Symfony 6+',
      suggestion: 'Migrate to a maintained alternative such as Symfony Security with a custom User entity.',
    },
    {
      pattern: /php\s+7\.\d/i,
      rule: 'symfony-php7-stale',
      message: 'References PHP 7 — Symfony 6.4+ requires PHP 8.1, Symfony 7 requires PHP 8.2',
      suggestion: 'Update PHP version references to 8.2 or later.',
    },
  ],

  django: [
    {
      pattern: /django\.conf\.urls\.url\s*\(/,
      rule: 'django-url-removed',
      message: 'References django.conf.urls.url() — removed in Django 4.0',
      suggestion: 'Replace url() with path() or re_path() from django.urls.',
    },
    {
      pattern: /\bugettext\b|ugettext_lazy|ugettext_noop/,
      rule: 'django-ugettext-removed',
      message: 'References ugettext/ugettext_lazy — removed in Django 4.0',
      suggestion: 'Replace with gettext / gettext_lazy from django.utils.translation.',
    },
    {
      pattern: /force_text|smart_text/,
      rule: 'django-force-text-removed',
      message: 'References force_text/smart_text — removed in Django 4.0',
      suggestion: 'Replace with force_str / smart_str from django.utils.encoding.',
    },
    {
      pattern: /python\s+3\.[5678]\b/i,
      rule: 'django-old-python',
      message: 'References Python 3.5–3.8 — Django 4.2+ requires Python 3.8+, Django 5.0+ requires 3.10+',
      suggestion: 'Update Python version references to 3.10 or later.',
    },
    {
      pattern: /python setup\.py/i,
      rule: 'django-setup-py-deprecated',
      message: 'References "python setup.py" — deprecated build approach',
      suggestion: 'Use "pip install -e ." or "python -m build" with pyproject.toml instead.',
    },
  ],

  laravel: [
    {
      pattern: /['"][A-Za-z]+Controller@[a-zA-Z]+['"]/,
      rule: 'laravel-string-based-routing',
      message: 'References string-based controller routing (\'Controller@method\') — deprecated in Laravel 9+',
      suggestion: 'Use callable tuple syntax: [UserController::class, \'index\'].',
    },
    {
      pattern: /artisan make:auth/,
      rule: 'laravel-make-auth-removed',
      message: 'References "artisan make:auth" — removed in Laravel 6, replaced by Breeze and Jetstream',
      suggestion: 'Use "composer require laravel/breeze" or "laravel/jetstream" for authentication scaffolding.',
    },
    {
      pattern: /Illuminate\\Support\\Facades\\Input/,
      rule: 'laravel-input-facade-removed',
      message: 'References the Input facade — removed in Laravel 6',
      suggestion: 'Replace Input:: with Request:: or inject the Request object directly.',
    },
    {
      pattern: /\bstr_singular\b|\bstr_plural\b/,
      rule: 'laravel-str-helpers-removed',
      message: 'References str_singular()/str_plural() global helpers — removed in Laravel 9',
      suggestion: 'Use Str::singular() / Str::plural() from Illuminate\\Support\\Str instead.',
    },
    {
      pattern: /Laravel\s+[5678](?:\.\d+)?\b/,
      rule: 'laravel-old-version',
      message: 'References Laravel 5–8 — current release is Laravel 11',
      suggestion: 'Update version references to Laravel 10 or 11.',
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

  // ── JavaScript / Node (package.json) ──────────────────────────────────────
  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps['@angular/core']) detected.push('angular');
      if (allDeps['react']) detected.push('react');
      if (allDeps['next']) detected.push('next');
      if (allDeps['vue']) detected.push('vue');
      if (allDeps['nuxt']) detected.push('nuxt');
      if (allDeps['svelte']) detected.push('svelte');
      if (!detected.length) detected.push('node');
    } catch { /* ignore */ }
  }

  // ── PHP (composer.json) ───────────────────────────────────────────────────
  const composerPath = path.join(repoRoot, 'composer.json');
  if (fs.existsSync(composerPath)) {
    try {
      const composer = JSON.parse(fs.readFileSync(composerPath, 'utf-8'));
      const allDeps = { ...composer.require, ...composer['require-dev'] };

      if (allDeps['symfony/framework-bundle']) detected.push('symfony');
      if (allDeps['laravel/framework']) detected.push('laravel');
    } catch { /* ignore */ }
  }

  // ── Python (requirements.txt / pyproject.toml / manage.py) ───────────────
  const requirementsPath = path.join(repoRoot, 'requirements.txt');
  const pyprojectPath = path.join(repoRoot, 'pyproject.toml');
  const managePyPath = path.join(repoRoot, 'manage.py');

  const hasDjango =
    (fs.existsSync(requirementsPath) && /\bDjango\b/i.test(fs.readFileSync(requirementsPath, 'utf-8'))) ||
    (fs.existsSync(pyprojectPath) && /\bdjango\b/i.test(fs.readFileSync(pyprojectPath, 'utf-8'))) ||
    fs.existsSync(managePyPath);

  if (hasDjango) detected.push('django');

  return detected;
}
