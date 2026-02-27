import * as fs from 'fs';
import * as path from 'path';
import { parseAgentsMd } from './parser.js';
import { checkFilesystem } from './checkers/filesystem.js';
import { checkNpmScripts } from './checkers/npm-scripts.js';
import { checkDependencies } from './checkers/dependencies.js';
import { checkFrameworkStaleness } from './checkers/framework.js';
import { checkStructure } from './checkers/structure.js';
import { computeScore } from './reporter.js';
import type { LintReport, CheckResult } from './types.js';

export interface LintOptions {
  filePath?: string;
  repoRoot?: string;
}

export async function lint(options: LintOptions = {}): Promise<LintReport> {
  // Resolve file path
  const repoRoot = options.repoRoot ?? process.cwd();
  const agentsFiles = ['AGENTS.md', 'agents.md', '.agents.md'];

  let filePath = options.filePath;
  if (!filePath) {
    for (const candidate of agentsFiles) {
      const candidatePath = path.join(repoRoot, candidate);
      if (fs.existsSync(candidatePath)) {
        filePath = candidatePath;
        break;
      }
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(
      `No AGENTS.md file found in ${repoRoot}.\n` +
      `Create one with: echo "# AGENTS.md\\n\\nProject setup instructions for AI coding agents." > AGENTS.md`
    );
  }

  // Parse
  const parsed = parseAgentsMd(filePath);

  // Run all checkers
  const results: CheckResult[] = [
    checkStructure(parsed),
    checkFilesystem(parsed, repoRoot),
    checkNpmScripts(parsed, repoRoot),
    checkDependencies(parsed, repoRoot),
    checkFrameworkStaleness(parsed, repoRoot),
  ];

  // Compute stats
  const allIssues = results.flatMap((r) => r.issues);
  const errors = allIssues.filter((i) => i.severity === 'error').length;
  const warnings = allIssues.filter((i) => i.severity === 'warn').length;
  const infos = allIssues.filter((i) => i.severity === 'info').length;
  const score = computeScore(results);

  const relativePath = path.relative(repoRoot, filePath);

  return {
    file: relativePath,
    score,
    results,
    totalIssues: allIssues.length,
    errors,
    warnings,
    infos,
    timestamp: new Date().toISOString(),
  };
}
