import * as fs from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFrameworkStaleness } from '../../checkers/framework.js';
import { makeParsed, makeTmpRepo, cleanupRepo } from '../helpers.js';

function makePhpRepo(composerJson: Record<string, unknown>): string {
  const dir = makeTmpRepo(); // no package.json
  fs.writeFileSync(`${dir}/composer.json`, JSON.stringify(composerJson), 'utf-8');
  return dir;
}

function makePythonRepo({ requirements = '', hasMangePy = false } = {}): string {
  const dir = makeTmpRepo(); // no package.json
  if (requirements) fs.writeFileSync(`${dir}/requirements.txt`, requirements, 'utf-8');
  if (hasMangePy) fs.writeFileSync(`${dir}/manage.py`, '#!/usr/bin/env python\n', 'utf-8');
  return dir;
}

test('detects ReactDOM.render() as stale in a React project', () => {
  const repo = makeTmpRepo({
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
  });
  try {
    const line = 'ReactDOM.render(<App />, document.getElementById("root"));';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'react-legacy-render');
    assert.ok(issue, 'expected react-legacy-render issue');
    assert.strictEqual(issue!.severity, 'warn');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects ::ng-deep as deprecated in an Angular project', () => {
  const repo = makeTmpRepo({ dependencies: { '@angular/core': '^17.0.0' } });
  try {
    const line = 'Style child components with ::ng-deep .child-class { color: red; }';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'angular-ng-deep-deprecated');
    assert.ok(issue, 'expected angular-ng-deep-deprecated issue');
    assert.strictEqual(issue!.severity, 'warn');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects @Input()/@Output() decorators in an Angular project', () => {
  const repo = makeTmpRepo({ dependencies: { '@angular/core': '^17.0.0' } });
  try {
    const line = 'Declare component inputs with @Input() and outputs with @Output() EventEmitter.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'angular-decorator-input-output');
    assert.ok(issue, 'expected angular-decorator-input-output issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects NgClass reference in an Angular project', () => {
  const repo = makeTmpRepo({ dependencies: { '@angular/core': '^17.0.0' } });
  try {
    const line = 'Use NgClass to conditionally apply CSS classes to elements.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'angular-ngclass-ngstyle');
    assert.ok(issue, 'expected angular-ngclass-ngstyle issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects constructor injection pattern in an Angular project', () => {
  const repo = makeTmpRepo({ dependencies: { '@angular/core': '^17.0.0' } });
  try {
    const line = 'Inject services via constructor(private myService: MyService) {}';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'angular-constructor-injection');
    assert.ok(issue, 'expected angular-constructor-injection issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('no Angular signal issues for modern Angular content', () => {
  const repo = makeTmpRepo({ dependencies: { '@angular/core': '^17.0.0' } });
  try {
    const line = 'Use inject(MyService) and signal-based input()/output() APIs. Bind classes with [class.active]="flag".';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const signalIssues = result.issues.filter((i) =>
      ['angular-ng-deep-deprecated', 'angular-decorator-input-output', 'angular-ngclass-ngstyle', 'angular-constructor-injection'].includes(i.rule)
    );
    assert.strictEqual(signalIssues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

test('detects @NgModule as stale in an Angular project', () => {
  const repo = makeTmpRepo({ dependencies: { '@angular/core': '^17.0.0' } });
  try {
    const line = 'Use @NgModule to declare all your components.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'angular-ngmodule-deprecated');
    assert.ok(issue, 'expected angular-ngmodule-deprecated issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('no React issues for clean modern React content', () => {
  const repo = makeTmpRepo({ dependencies: { react: '^19.0.0' } });
  try {
    const line = 'Use createRoot().render() to mount the app.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const reactIssues = result.issues.filter((i) => i.rule.startsWith('react-'));
    assert.strictEqual(reactIssues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

test('detects outdated Node.js version reference regardless of framework', () => {
  const repo = makeTmpRepo({}); // empty package.json → 'node' framework detected
  try {
    const line = 'Requires Node v14.0 or higher to run this project.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'old-node-version');
    assert.ok(issue, 'expected old-node-version issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('returns no issues for content with no stale patterns', () => {
  const repo = makeTmpRepo({});
  try {
    const line = 'Run npm install and npm run build to get started.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    assert.strictEqual(result.issues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

// ── Symfony ───────────────────────────────────────────────────────────────────

test('detects SwiftMailer reference in a Symfony project', () => {
  const repo = makePhpRepo({ require: { 'symfony/framework-bundle': '^6.0' } });
  try {
    const line = 'Use SwiftMailer to send transactional emails.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'symfony-swiftmailer-removed');
    assert.ok(issue, 'expected symfony-swiftmailer-removed issue');
    assert.strictEqual(issue!.severity, 'warn');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects @Route annotation syntax in a Symfony project', () => {
  const repo = makePhpRepo({ require: { 'symfony/framework-bundle': '^6.0' } });
  try {
    const line = 'Annotate controllers with @Route("/path") to define routes.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'symfony-annotation-routing');
    assert.ok(issue, 'expected symfony-annotation-routing issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects FOSUserBundle reference in a Symfony project', () => {
  const repo = makePhpRepo({ require: { 'symfony/framework-bundle': '^6.0' } });
  try {
    const line = 'Authentication is handled by FOSUserBundle.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'symfony-fosuserbundle-abandoned');
    assert.ok(issue, 'expected symfony-fosuserbundle-abandoned issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('no Symfony issues for clean modern content', () => {
  const repo = makePhpRepo({ require: { 'symfony/framework-bundle': '^7.0' } });
  try {
    const line = 'Use #[Route] attributes and Symfony Mailer for emails.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const symfonyIssues = result.issues.filter((i) => i.rule.startsWith('symfony-'));
    assert.strictEqual(symfonyIssues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

// ── Django ────────────────────────────────────────────────────────────────────

test('detects django.conf.urls.url() reference in a Django project', () => {
  const repo = makePythonRepo({ requirements: 'Django>=4.0\nrequests\n' });
  try {
    const line = 'Define URL patterns using django.conf.urls.url() in urls.py.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'django-url-removed');
    assert.ok(issue, 'expected django-url-removed issue');
    assert.strictEqual(issue!.severity, 'warn');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects ugettext reference in a Django project', () => {
  const repo = makePythonRepo({ requirements: 'Django>=4.0\n' });
  try {
    const line = 'Use ugettext_lazy for lazy translation strings.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'django-ugettext-removed');
    assert.ok(issue, 'expected django-ugettext-removed issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects Django project via manage.py presence', () => {
  const repo = makePythonRepo({ hasMangePy: true });
  try {
    const line = 'Use ugettext_lazy for translations.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'django-ugettext-removed');
    assert.ok(issue, 'expected Django to be detected via manage.py');
  } finally {
    cleanupRepo(repo);
  }
});

test('no Django issues for clean modern content', () => {
  const repo = makePythonRepo({ requirements: 'Django>=4.2\n' });
  try {
    const line = 'Use path() and gettext_lazy() for URLs and translations.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const djangoIssues = result.issues.filter((i) => i.rule.startsWith('django-'));
    assert.strictEqual(djangoIssues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});

// ── Laravel ───────────────────────────────────────────────────────────────────

test('detects string-based routing in a Laravel project', () => {
  const repo = makePhpRepo({ require: { 'laravel/framework': '^11.0' } });
  try {
    const line = "Route::get('/users', 'UserController@index');";
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'laravel-string-based-routing');
    assert.ok(issue, 'expected laravel-string-based-routing issue');
    assert.strictEqual(issue!.severity, 'warn');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects "artisan make:auth" reference in a Laravel project', () => {
  const repo = makePhpRepo({ require: { 'laravel/framework': '^11.0' } });
  try {
    const line = 'Run php artisan make:auth to scaffold authentication.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'laravel-make-auth-removed');
    assert.ok(issue, 'expected laravel-make-auth-removed issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('detects old Laravel version reference', () => {
  const repo = makePhpRepo({ require: { 'laravel/framework': '^11.0' } });
  try {
    const line = 'This project was built with Laravel 8 and requires PHP 8.0.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const issue = result.issues.find((i) => i.rule === 'laravel-old-version');
    assert.ok(issue, 'expected laravel-old-version issue');
  } finally {
    cleanupRepo(repo);
  }
});

test('no Laravel issues for clean modern content', () => {
  const repo = makePhpRepo({ require: { 'laravel/framework': '^11.0' } });
  try {
    const line = 'Use [UserController::class, "index"] tuple routing and Laravel Breeze for auth.';
    const parsed = makeParsed({ rawContent: line, lines: [line] });
    const result = checkFrameworkStaleness(parsed, repo);
    const laravelIssues = result.issues.filter((i) => i.rule.startsWith('laravel-'));
    assert.strictEqual(laravelIssues.length, 0);
  } finally {
    cleanupRepo(repo);
  }
});
