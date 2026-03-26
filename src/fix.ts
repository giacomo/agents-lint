import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import type { LintReport, LintIssue, MultiLintReport } from './types.js';

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const R  = '\x1b[0m';
const B  = '\x1b[1m';
const DM = '\x1b[2m';
const RD = '\x1b[31m';
const YL = '\x1b[33m';
const GR = '\x1b[32m';
const CY = '\x1b[36m';
const GY = '\x1b[90m';

// ── Fix action types ──────────────────────────────────────────────────────────

interface RemoveLineFix {
  type: 'remove-line';
  lineNumber: number;   // 1-indexed
}

interface AddSectionFix {
  type: 'add-section';
  content: string;
}

interface AddToIgnoreFix {
  type: 'add-to-ignore';
  pattern: string;
  configPath: string;
}

type FixAction = RemoveLineFix | AddSectionFix | AddToIgnoreFix;

// ── Section templates ─────────────────────────────────────────────────────────

const SECTION_TEMPLATES: Record<string, string> = {
  'missing-setup-section':
    '\n## Setup\n\n```bash\n# TODO: add setup/install commands\n```\n',
  'missing-test-section':
    '\n## Testing\n\n```bash\n# TODO: add test command (e.g., npm test)\n```\n',
  'missing-build-section':
    '\n## Build\n\n```bash\n# TODO: add build command (e.g., npm run build)\n```\n',
};

function getSectionTemplate(rule: string): string | null {
  if (SECTION_TEMPLATES[rule]) return SECTION_TEMPLATES[rule];

  // Custom sections: missing-custom-section-<name>
  const match = rule.match(/^missing-custom-section-(.+)$/);
  if (match) {
    const name = match[1]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `\n## ${name}\n\n<!-- TODO: add ${name} content -->\n`;
  }

  return null;
}

// ── Core builder ──────────────────────────────────────────────────────────────

function buildFixAction(issue: LintIssue, fileLines: string[]): FixAction | null {
  // Issues with a concrete line number → remove that line
  if (
    issue.line !== undefined &&
    issue.line >= 1 &&
    issue.line <= fileLines.length
  ) {
    return { type: 'remove-line', lineNumber: issue.line };
  }

  // Missing section rules → append a template section
  const template = getSectionTemplate(issue.rule);
  if (template) {
    return { type: 'add-section', content: template };
  }

  return null; // advisory only
}

// ── Stdin helpers ─────────────────────────────────────────────────────────────

// When stdin is a pipe (non-TTY), pre-read all lines to avoid race conditions
// between the readline 'close' event and buffered line delivery.
function readAllStdinLines(): Promise<string[]> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    const rl = readline.createInterface({ input: process.stdin, terminal: false });
    rl.on('line', (l) => lines.push(l.trim().toLowerCase()));
    rl.on('close', () => resolve(lines));
  });
}

// Returns an ask() function bound to the current stdin mode.
// - TTY: interactive readline prompts
// - Pipe: dequeues from the pre-read answer buffer (echoes the answer for clarity)
function makeAsker(
  answers: string[] | null,
  rl: readline.Interface | null,
): (question: string) => Promise<string> {
  let idx = 0;
  if (answers !== null) {
    // Piped / non-interactive mode
    return (question: string) => {
      process.stdout.write(question);
      const ans = answers[idx++] ?? '';
      process.stdout.write(ans + '\n');
      return Promise.resolve(ans);
    };
  }
  // Interactive TTY mode
  return (question: string) =>
    new Promise((resolve) => {
      rl!.question(question, (a) => resolve(a.trim().toLowerCase()));
    });
}

// ── Severity icon ─────────────────────────────────────────────────────────────

function icon(severity: string): string {
  if (severity === 'error') return `${RD}✖${R}`;
  if (severity === 'warn')  return `${YL}⚠${R}`;
  return `${CY}ℹ${R}`;
}

// ── add-to-ignore applier ──────────────────────────────────────────────────────

function applyAddToIgnore(pattern: string, configPath: string): void {
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch { /* use empty */ }
  }
  const existing = Array.isArray(config.ignorePatterns) ? config.ignorePatterns as string[] : [];
  if (!existing.includes(pattern)) {
    config.ignorePatterns = [...existing, pattern];
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// ── Cross-fix action builder ───────────────────────────────────────────────────

function buildCrossFixAction(issue: LintIssue, repoRoot: string): AddToIgnoreFix | null {
  if (issue.rule === 'cross-path-asymmetry') {
    const match = /"([^"]+)"/.exec(issue.message);
    if (match) {
      return {
        type: 'add-to-ignore',
        pattern: match[1],
        configPath: path.join(repoRoot, '.agents-lint.json'),
      };
    }
  }
  return null;
}

// ── Multi-file fix mode ────────────────────────────────────────────────────────

export async function runMultiFixMode(
  multi: MultiLintReport,
  repoRoot: string,
): Promise<void> {
  const crossIssues = multi.crossCheck.issues;
  const perFileIssues = multi.reports.reduce((s, r) => s + r.totalIssues, 0);

  console.log('');
  console.log(`${B}${CY}agents-lint${R} ${DM}— Fix Mode${R}`);
  console.log(`${DM}${'─'.repeat(60)}${R}`);

  // Direct user to per-file fix for individual file issues
  if (perFileIssues > 0) {
    console.log(`${B}Per-file issues${R} — run fix on each file individually:`);
    for (const report of multi.reports) {
      if (report.totalIssues > 0) {
        console.log(`  ${CY}agents-lint --fix ${report.file}${R}`);
      }
    }
    console.log('');
  }

  if (crossIssues.length === 0) {
    console.log(`${GR}✓ No cross-file issues to fix.${R}\n`);
    return;
  }

  const fixable = crossIssues.filter((i) => buildCrossFixAction(i, repoRoot) !== null);
  const advisory = crossIssues.filter((i) => buildCrossFixAction(i, repoRoot) === null);

  console.log(`${B}Cross-file issues${R}  ${DM}·  ${fixable.length} fixable, ${advisory.length} advisory${R}`);
  console.log('');

  const isTTY = Boolean(process.stdin.isTTY);
  const preloaded = isTTY ? null : await readAllStdinLines();
  const rl = isTTY
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;
  const ask = makeAsker(preloaded, rl);

  const pendingIgnores: AddToIgnoreFix[] = [];
  let issueIndex = 0;
  let quit = false;

  for (const issue of crossIssues) {
    if (quit) break;

    const fix = buildCrossFixAction(issue, repoRoot);

    if (!fix) {
      console.log(`${DM}${icon(issue.severity)} ${issue.message}${R}`);
      if (issue.suggestion) console.log(`  ${DM}→ ${issue.suggestion}${R}`);
      console.log(`  ${GY}(no auto-fix available — edit files manually)${R}`);
      console.log('');
      continue;
    }

    issueIndex++;
    console.log(`Issue ${issueIndex}/${fixable.length}  ${DM}[fixable]${R}`);
    console.log(`  ${icon(issue.severity)} ${B}${issue.message}${R}`);
    console.log('');
    console.log(`  ${B}Fix:${R} Add ${GY}"${fix.pattern}"${R} to ${CY}ignorePatterns${R} in ${fix.configPath}`);
    console.log('');

    const answer = await ask(`  ${B}Apply?${R} (y)es / (n)o / (q)uit  ${GY}›${R} `);

    if (answer === 'q' || answer === 'quit') {
      console.log(`  ${DM}Quit — remaining issues skipped.${R}`);
      quit = true;
    } else if (answer === 'y' || answer === 'yes') {
      pendingIgnores.push(fix);
      console.log(`  ${GR}✓ Will add to ignorePatterns${R}`);
    } else {
      console.log(`  ${DM}Skipped.${R}`);
    }
    console.log('');
  }

  rl?.close();

  if (pendingIgnores.length === 0) {
    console.log(`${DM}No fixes applied.${R}\n`);
    return;
  }

  console.log(`${DM}${'─'.repeat(60)}${R}`);
  // Group by config file and apply together
  const byConfig = new Map<string, string[]>();
  for (const f of pendingIgnores) {
    if (!byConfig.has(f.configPath)) byConfig.set(f.configPath, []);
    byConfig.get(f.configPath)!.push(f.pattern);
  }
  for (const [configPath, patterns] of byConfig) {
    for (const pattern of patterns) applyAddToIgnore(pattern, configPath);
    const rel = path.relative(repoRoot, configPath);
    console.log(`${GR}✓ Updated ${rel}${R} — added ${patterns.length} pattern${patterns.length !== 1 ? 's' : ''} to ignorePatterns`);
  }
  console.log(`\nRun ${CY}agents-lint${R} to check remaining issues.\n`);
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runFixMode(
  report: LintReport,
  absoluteFilePath: string,
): Promise<void> {
  const allIssues = report.results.flatMap((r) => r.issues);

  if (allIssues.length === 0) {
    console.log(`\n${GR}✓ No issues to fix.${R}\n`);
    return;
  }

  const fileContent = fs.readFileSync(absoluteFilePath, 'utf-8');
  const fileLines = fileContent.split('\n');

  // Categorise issues upfront so we can show the count in the header
  const fixable = allIssues.filter((i) => buildFixAction(i, fileLines) !== null);
  const advisory = allIssues.filter((i) => buildFixAction(i, fileLines) === null);

  // ── Header ────────────────────────────────────────────────────────────────
  console.log('');
  console.log(`${B}${CY}agents-lint${R} ${DM}— Fix Mode${R}`);
  console.log(`${DM}${'─'.repeat(60)}${R}`);
  console.log(`${B}File:${R} ${report.file}  ${DM}·  ${fixable.length} fixable, ${advisory.length} advisory${R}`);
  console.log('');

  // Stdin handling: pre-read all answers when piped, use readline for TTY.
  const isTTY = Boolean(process.stdin.isTTY);
  const preloaded = isTTY ? null : await readAllStdinLines();
  const rl = isTTY
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;
  const ask = makeAsker(preloaded, rl);

  // Collected decisions
  const linesToRemove = new Set<number>();
  const sectionsToAdd: string[] = [];
  let issueIndex = 0;
  let quit = false;

  // ── Interactive loop ───────────────────────────────────────────────────────
  for (const result of report.results) {
    if (quit) break;

    for (const issue of result.issues) {
      if (quit) break;

      const fix = buildFixAction(issue, fileLines);

      // ── Advisory (no auto-fix) ─────────────────────────────────────────
      if (!fix) {
        console.log(`${DM}${icon(issue.severity)} ${issue.message}${R}`);
        if (issue.suggestion) {
          console.log(`  ${DM}→ ${issue.suggestion}${R}`);
        }
        console.log(`  ${GY}(no auto-fix available)${R}`);
        console.log('');
        continue;
      }

      // ── Fixable ────────────────────────────────────────────────────────
      issueIndex++;
      console.log(`Issue ${issueIndex}/${fixable.length}  ${DM}[fixable]${R}`);
      console.log(`  ${icon(issue.severity)} ${B}${issue.message}${R}`);
      if (issue.context) {
        console.log(`  ${GY}${issue.context}${R}`);
      }
      console.log('');

      if (fix.type === 'remove-line') {
        const lineContent = fileLines[fix.lineNumber - 1] ?? '';
        console.log(`  ${B}Fix:${R} Remove line ${fix.lineNumber}`);
        console.log(`  ${RD}- ${lineContent}${R}`);
      } else if (fix.type === 'add-section') {
        console.log(`  ${B}Fix:${R} Add section at end of file`);
        for (const l of fix.content.split('\n')) {
          console.log(`  ${GR}+ ${l}${R}`);
        }
      }
      console.log('');

      const answer = await ask(
        `  ${B}Apply?${R} (y)es / (n)o / (q)uit  ${GY}›${R} `,
      );

      if (answer === 'q' || answer === 'quit') {
        console.log(`  ${DM}Quit — remaining issues skipped.${R}`);
        quit = true;
      } else if (answer === 'y' || answer === 'yes') {
        if (fix.type === 'remove-line') {
          linesToRemove.add(fix.lineNumber);
          console.log(`  ${GR}✓ Will remove line ${fix.lineNumber}${R}`);
        } else if (fix.type === 'add-section') {
          sectionsToAdd.push(fix.content);
          console.log(`  ${GR}✓ Will add section${R}`);
        }
      } else {
        console.log(`  ${DM}Skipped.${R}`);
      }

      console.log('');
    }
  }

  rl?.close();

  const totalAccepted = linesToRemove.size + sectionsToAdd.length;

  if (totalAccepted === 0) {
    console.log(`${DM}No fixes applied.${R}\n`);
    return;
  }

  // ── Apply fixes atomically ─────────────────────────────────────────────────
  console.log(`${DM}${'─'.repeat(60)}${R}`);
  console.log(`${B}Applying ${totalAccepted} fix${totalAccepted !== 1 ? 'es' : ''} to ${report.file}…${R}`);

  // Remove lines in descending order so earlier indices stay valid
  let newLines = [...fileLines];
  const sortedLines = [...linesToRemove].sort((a, b) => b - a);
  for (const lineNum of sortedLines) {
    newLines.splice(lineNum - 1, 1);
  }

  // Append new sections
  if (sectionsToAdd.length > 0) {
    const appended = sectionsToAdd.join('\n');
    newLines.push(...appended.split('\n'));
  }

  fs.writeFileSync(absoluteFilePath, newLines.join('\n'), 'utf-8');

  console.log(`${GR}✓ Done.${R} Run ${CY}agents-lint${R} to check remaining issues.\n`);
}
