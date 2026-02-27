import * as fs from 'fs';
import * as path from 'path';

interface ProjectInfo {
  name: string;
  framework: string | null;
  testRunner: string | null;
  packageManager: string;
  hasTypeScript: boolean;
  buildCommand: string;
  testCommand: string;
  installCommand: string;
}

function detectProjectInfo(repoRoot: string): ProjectInfo {
  let name = path.basename(repoRoot);
  let framework: string | null = null;
  let testRunner: string | null = null;
  let hasTypeScript = false;
  let buildCommand = '';
  let testCommand = 'npm test';
  let installCommand = 'npm install';
  let packageManager = 'npm';

  // Detect package manager from lockfiles
  if (fs.existsSync(path.join(repoRoot, 'bun.lockb'))) {
    packageManager = 'bun';
    installCommand = 'bun install';
    testCommand = 'bun test';
  } else if (fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
    installCommand = 'pnpm install';
    testCommand = 'pnpm test';
  } else if (fs.existsSync(path.join(repoRoot, 'yarn.lock'))) {
    packageManager = 'yarn';
    installCommand = 'yarn';
    testCommand = 'yarn test';
  }

  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) name = pkg.name;

      const allDeps: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      hasTypeScript = !!allDeps['typescript'];

      // Detect framework
      if (allDeps['@angular/core']) framework = 'Angular';
      else if (allDeps['next']) framework = 'Next.js';
      else if (allDeps['nuxt']) framework = 'Nuxt';
      else if (allDeps['react']) framework = 'React';
      else if (allDeps['vue']) framework = 'Vue';
      else if (allDeps['svelte']) framework = 'Svelte';
      else if (allDeps['@solidjs/core'] || allDeps['solid-js']) framework = 'SolidJS';
      else if (allDeps['fastify']) framework = 'Fastify';
      else if (allDeps['express']) framework = 'Express';
      else if (allDeps['hono']) framework = 'Hono';
      else if (allDeps['nestjs'] || allDeps['@nestjs/core']) framework = 'NestJS';

      // Detect test runner
      if (allDeps['vitest']) testRunner = 'vitest';
      else if (allDeps['jest'] || allDeps['@jest/core']) testRunner = 'jest';
      else if (allDeps['mocha']) testRunner = 'mocha';
      else if (allDeps['ava']) testRunner = 'ava';
      else if (allDeps['tap'] || allDeps['node:test']) testRunner = 'node --test';

      // Resolve commands from package.json scripts
      const pm = packageManager;
      const runPrefix = pm === 'npm' ? 'npm run' : pm;
      if (pkg.scripts?.test) testCommand = `${pm === 'npm' ? 'npm test' : `${pm} test`}`;
      if (pkg.scripts?.build) buildCommand = `${runPrefix} build`;
    } catch {
      // Ignore malformed package.json
    }
  }

  return { name, framework, testRunner, packageManager, hasTypeScript, buildCommand, testCommand, installCommand };
}

export function generateAgentsMd(repoRoot: string): string {
  const info = detectProjectInfo(repoRoot);
  const lines: string[] = [];

  lines.push('# AGENTS.md');
  lines.push('');
  lines.push(`> Context file for AI coding agents working on **${info.name}**.`);
  lines.push('');

  // Project
  lines.push('## Project');
  lines.push('');
  const stack = [
    info.framework,
    info.hasTypeScript ? 'TypeScript' : null,
  ].filter(Boolean).join(' + ');
  lines.push(`${info.name} is a ${stack || 'Node.js'} project.`);
  lines.push('');
  lines.push('<!-- TODO: Add a 1-2 sentence description of what this project does. -->');
  lines.push('');

  // Setup
  lines.push('## Setup');
  lines.push('');
  lines.push('```bash');
  lines.push(info.installCommand);
  if (info.buildCommand) lines.push(info.buildCommand);
  lines.push('```');
  lines.push('');

  // Structure
  const srcExists = fs.existsSync(path.join(repoRoot, 'src'));
  const testDir =
    fs.existsSync(path.join(repoRoot, '__tests__')) ? '__tests__/' :
    fs.existsSync(path.join(repoRoot, 'tests')) ? 'tests/' :
    fs.existsSync(path.join(repoRoot, 'test')) ? 'test/' :
    null;

  lines.push('## Structure');
  lines.push('');
  lines.push('```');
  if (srcExists) lines.push('src/          # Source code');
  if (testDir) lines.push(`${testDir.padEnd(14)}# Tests`);
  lines.push('```');
  lines.push('');
  lines.push('<!-- TODO: Expand with key directories and what they contain. -->');
  lines.push('');

  // Testing
  lines.push('## Testing');
  lines.push('');
  lines.push('```bash');
  lines.push(info.testCommand);
  lines.push('```');
  lines.push('');
  if (info.testRunner) {
    lines.push(`Uses ${info.testRunner}.`);
    lines.push('');
  }

  // Build (only if there is one)
  if (info.buildCommand) {
    lines.push('## Build');
    lines.push('');
    lines.push('```bash');
    lines.push(info.buildCommand);
    lines.push('```');
    lines.push('');
  }

  // Conventions placeholder
  lines.push('## Conventions');
  lines.push('');
  lines.push('<!-- TODO: Add project-specific conventions agents must follow:');
  lines.push('  - Naming conventions');
  lines.push('  - Code style rules not enforced by the linter');
  lines.push('  - Branch naming / commit message format');
  lines.push('-->');
  lines.push('');

  return lines.join('\n');
}
