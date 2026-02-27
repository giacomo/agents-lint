import type { LintReport, CheckResult, LintIssue, Severity } from './types.js';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const GRAY = '\x1b[90m';
const BG_RED = '\x1b[41m';
const BG_YELLOW = '\x1b[43m';
const BG_GREEN = '\x1b[42m';

function severityIcon(severity: Severity): string {
  switch (severity) {
    case 'error': return `${RED}✖${RESET}`;
    case 'warn':  return `${YELLOW}⚠${RESET}`;
    case 'info':  return `${BLUE}ℹ${RESET}`;
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return GREEN;
  if (score >= 50) return YELLOW;
  return RED;
}

function scoreGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function scoreBar(score: number): string {
  const width = 20;
  const filled = Math.round((score / 100) * width);
  const color = scoreColor(score);
  return `${color}${'█'.repeat(filled)}${GRAY}${'░'.repeat(width - filled)}${RESET}`;
}

export function formatReport(report: LintReport): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`${BOLD}${CYAN}agents-lint${RESET} ${DIM}v0.1.0${RESET}`);
  lines.push(`${DIM}${'─'.repeat(60)}${RESET}`);
  lines.push(`${BOLD}File:${RESET} ${report.file}`);
  lines.push('');

  // Score
  const sc = scoreColor(report.score);
  const grade = scoreGrade(report.score);
  lines.push(`${BOLD}Freshness Score${RESET}`);
  lines.push(`  ${scoreBar(report.score)}  ${sc}${BOLD}${report.score}/100${RESET} ${BOLD}(${grade})${RESET}`);
  lines.push('');

  // Issues by checker
  let hasAnyIssue = false;
  for (const result of report.results) {
    if (result.issues.length === 0) continue;
    hasAnyIssue = true;

    const checkerName = result.checker.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    lines.push(`${BOLD}${WHITE}${checkerName}${RESET} ${DIM}(${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''})${RESET}`);

    for (const issue of result.issues) {
      const icon = severityIcon(issue.severity);
      const loc = issue.line ? `${GRAY}:${issue.line}${RESET}` : '';
      lines.push(`  ${icon} ${issue.message}${loc}`);

      if (issue.context) {
        lines.push(`    ${GRAY}${issue.context}${RESET}`);
      }

      if (issue.suggestion) {
        lines.push(`    ${DIM}→ ${issue.suggestion}${RESET}`);
      }
      lines.push('');
    }
  }

  if (!hasAnyIssue) {
    lines.push(`${GREEN}${BOLD}✓ No issues found!${RESET} Your AGENTS.md is in great shape.`);
    lines.push('');
  }

  // Summary
  lines.push(`${DIM}${'─'.repeat(60)}${RESET}`);
  const errColor = report.errors > 0 ? RED : GRAY;
  const warnColor = report.warnings > 0 ? YELLOW : GRAY;
  const infoColor = report.infos > 0 ? BLUE : GRAY;

  lines.push(
    `${errColor}${report.errors} error${report.errors !== 1 ? 's' : ''}${RESET}  ` +
    `${warnColor}${report.warnings} warning${report.warnings !== 1 ? 's' : ''}${RESET}  ` +
    `${infoColor}${report.infos} info${RESET}`
  );
  lines.push('');

  if (report.score < 50) {
    lines.push(`${RED}Context rot detected. Agents using this file may produce incorrect or costly outputs.${RESET}`);
    lines.push(`${DIM}Run with ${CYAN}--fix${RESET}${DIM} to get suggestions for updating your AGENTS.md.${RESET}`);
  } else if (report.score < 80) {
    lines.push(`${YELLOW}Some stale references found. Consider updating before running agents on this repo.${RESET}`);
  } else {
    lines.push(`${GREEN}AGENTS.md is fresh and ready for your coding agents. ✓${RESET}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function formatJson(report: LintReport): string {
  return JSON.stringify(report, null, 2);
}

export function computeScore(results: CheckResult[]): number {
  let totalChecks = 0;
  let totalPassed = 0;
  let weightedPenalty = 0;

  for (const result of results) {
    totalChecks += result.passed + result.failed;
    totalPassed += result.passed;

    for (const issue of result.issues) {
      switch (issue.severity) {
        case 'error': weightedPenalty += 15; break;
        case 'warn':  weightedPenalty += 7;  break;
        case 'info':  weightedPenalty += 2;  break;
      }
    }
  }

  if (totalChecks === 0) return 100;

  const baseScore = totalChecks > 0 ? (totalPassed / totalChecks) * 100 : 100;
  const finalScore = Math.max(0, Math.min(100, Math.round(baseScore - weightedPenalty)));
  return finalScore;
}
