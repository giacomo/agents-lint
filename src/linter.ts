import * as fs from 'fs';
import * as path from 'path';
import { parseAgentsMd } from './parser.js';
import { checkFilesystem } from './checkers/filesystem.js';
import { checkNpmScripts } from './checkers/npm-scripts.js';
import { checkDependencies } from './checkers/dependencies.js';
import { checkFrameworkStaleness } from './checkers/framework.js';
import { checkStructure } from './checkers/structure.js';
import { checkCrossConsistency } from './checkers/cross.js';
import { computeScore } from './reporter.js';
import { loadConfig } from './config.js';
import type { LintReport, MultiLintReport, CheckResult } from './types.js';

export const AGENT_FILES = [
  'AGENTS.md', 'agents.md', '.agents.md',
  'CLAUDE.md', 'claude.md',
  'GEMINI.md', 'gemini.md',
  'COPILOT.md',
  '.cursorrules',
  '.github/copilot-instructions.md',
];

export interface LintOptions {
  filePath?: string;
  repoRoot?: string;
}

export async function lint(options: LintOptions = {}): Promise<LintReport> {
  // Resolve file path
  const repoRoot = options.repoRoot ?? process.cwd();

  let filePath = options.filePath;
  if (!filePath) {
    for (const candidate of AGENT_FILES) {
      const candidatePath = path.join(repoRoot, candidate);
      if (fs.existsSync(candidatePath)) {
        filePath = candidatePath;
        break;
      }
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(
      `No context file found in ${repoRoot}.\n` +
      `Supported files: AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules, .github/copilot-instructions.md\n` +
      `Create one with: agents-lint init`
    );
  }

  // Load config
  const config = loadConfig(repoRoot);

  // Parse
  const parsed = parseAgentsMd(filePath);

  // Run all checkers
  const results: CheckResult[] = [
    checkStructure(parsed, config),
    checkFilesystem(parsed, repoRoot, config),
    checkNpmScripts(parsed, repoRoot, config),
    checkDependencies(parsed, repoRoot, config),
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

export async function lintAll(options: { repoRoot?: string } = {}): Promise<MultiLintReport> {
  const repoRoot = options.repoRoot ?? process.cwd();

  // Find ALL matching context files (not just the first).
  // Deduplicate by lowercased resolved path so case-insensitive filesystems
  // (Windows, macOS) don't produce duplicate entries for AGENTS.md vs agents.md.
  const seen = new Set<string>();
  const foundPaths = AGENT_FILES
    .map((f) => path.join(repoRoot, f))
    .filter((p) => {
      if (!fs.existsSync(p)) return false;
      const key = path.resolve(p).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (foundPaths.length === 0) {
    throw new Error(
      `No context file found in ${repoRoot}.\n` +
      `Supported files: AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules, .github/copilot-instructions.md\n` +
      `Create one with: agents-lint init`
    );
  }

  // Lint each file independently
  const reports = await Promise.all(
    foundPaths.map((fp) => lint({ filePath: fp, repoRoot }))
  );

  // Cross-check (only meaningful with 2+ files)
  const fileContexts = foundPaths.map((fp) => ({
    relativePath: path.relative(repoRoot, fp),
    parsed: parseAgentsMd(fp),
  }));
  const crossCheck = checkCrossConsistency(fileContexts);

  const overallScore = Math.round(
    reports.reduce((sum, r) => sum + r.score, 0) / reports.length
  );

  const crossIssues = crossCheck.issues;
  const totalErrors   = reports.reduce((s, r) => s + r.errors, 0)   + crossIssues.filter((i) => i.severity === 'error').length;
  const totalWarnings = reports.reduce((s, r) => s + r.warnings, 0) + crossIssues.filter((i) => i.severity === 'warn').length;
  const totalInfos    = reports.reduce((s, r) => s + r.infos, 0)    + crossIssues.filter((i) => i.severity === 'info').length;

  return {
    files: reports.map((r) => r.file),
    reports,
    crossCheck,
    overallScore,
    totalErrors,
    totalWarnings,
    totalInfos,
  };
}
