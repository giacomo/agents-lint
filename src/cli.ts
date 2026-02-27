#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { lint, lintAll } from './linter.js';
import { formatReport, formatJson, formatMultiReport, formatMultiJson } from './reporter.js';
import { generateAgentsMd } from './init.js';
import { runFixMode } from './fix.js';

const VERSION = '0.2.0';

const HELP = `
agents-lint v${VERSION}
Detect stale references and context rot in your AGENTS.md / CLAUDE.md / GEMINI.md files.

USAGE
  agents-lint [file] [options]
  agents-lint init

COMMANDS
  init                  Generate a starter AGENTS.md for this project

ARGUMENTS
  file                  Path to context file (default: auto-detected in cwd)

OPTIONS
  --root <path>         Repository root to resolve paths against (default: cwd)
  --fix                 Interactive mode: review and apply suggested fixes
  --format <fmt>        Output format: text | json (default: text)
  --max-warnings <n>    Exit with error if warnings exceed this threshold
  --quiet               Only show errors, suppress warnings and info
  --no-color            Disable colored output
  --help                Show this help message
  --version             Show version number

EXIT CODES
  0   No issues (or only info-level issues)
  1   Warnings or errors found
  2   Fatal error (file not found, parse error)

EXAMPLES
  # Lint AGENTS.md in current directory
  agents-lint

  # Lint a specific file
  agents-lint ./docs/AGENTS.md

  # Use in CI — fail if any errors or warnings
  agents-lint --max-warnings 0

  # JSON output for tooling integration
  agents-lint --format json > agents-lint-report.json

  # Interactively fix stale references
  agents-lint --fix

  # Add to package.json scripts:
  # "lint:agents": "agents-lint --max-warnings 5"

DOCS
  https://github.com/giacomo/agents-lint
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(VERSION);
    process.exit(0);
  }

  // `agents-lint init` — generate a starter AGENTS.md
  if (args[0] === 'init') {
    const repoRoot = process.cwd();
    const outputPath = path.join(repoRoot, 'AGENTS.md');

    if (fs.existsSync(outputPath)) {
      console.error(`\x1b[33m⚠ AGENTS.md already exists.\x1b[0m Use a different file name or delete it first.`);
      process.exit(1);
    }

    const content = generateAgentsMd(repoRoot);
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`\x1b[32m✓\x1b[0m Created AGENTS.md — fill in the TODO sections, then run \x1b[36magents-lint\x1b[0m to validate.`);
    process.exit(0);
  }

  // Parse args
  let filePath: string | undefined;
  let repoRoot = process.cwd();
  let format: 'text' | 'json' = 'text';
  let maxWarnings: number | undefined;
  let quiet = false;
  let fix = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--root':
        repoRoot = path.resolve(args[++i] ?? '.');
        break;
      case '--format':
        format = (args[++i] as 'text' | 'json') ?? 'text';
        break;
      case '--max-warnings':
        maxWarnings = parseInt(args[++i] ?? '0', 10);
        break;
      case '--quiet':
        quiet = true;
        break;
      case '--fix':
        fix = true;
        break;
      case '--no-color':
        process.env.NO_COLOR = '1';
        break;
      default:
        if (!arg.startsWith('--') && !filePath) {
          filePath = path.resolve(arg);
        }
    }
  }

  if (fix && format === 'json') {
    console.error(`\n\x1b[31m✖ Error:\x1b[0m --fix cannot be used with --format json\n`);
    process.exit(2);
  }

  try {
    if (filePath) {
      // ── Explicit single file ──────────────────────────────────────────────
      const report = await lint({ filePath, repoRoot });

      // --fix: interactive mode — takes over the rest of the session
      if (fix) {
        const absoluteFilePath = path.resolve(repoRoot, report.file);
        await runFixMode(report, absoluteFilePath);
        process.exit(0);
      }

      if (format === 'json') {
        console.log(formatJson(report));
      } else {
        const output = formatReport(report);
        if (quiet) {
          const errorLines = output.split('\n').filter((l) =>
            l.includes('✖') || l.includes('agents-lint') || l.includes('Score') || l.includes('─')
          );
          console.log(errorLines.join('\n'));
        } else {
          console.log(output);
        }
      }

      if (report.errors > 0) process.exit(1);
      if (maxWarnings !== undefined && report.warnings > maxWarnings) {
        if (format === 'text') console.error(`\n✖ Exceeded max warnings threshold (${report.warnings} > ${maxWarnings})`);
        process.exit(1);
      }
      process.exit(0);

    } else {
      // ── Auto-detect: may find multiple files ──────────────────────────────
      const multi = await lintAll({ repoRoot });

      // --fix with multiple files requires an explicit file path
      if (fix) {
        if (multi.files.length > 1) {
          console.error(
            `\n\x1b[31m✖\x1b[0m --fix requires an explicit file when multiple context files exist.\n` +
            `  Specify one: ${multi.files.map((f) => `agents-lint --fix ${f}`).join('  or  ')}\n`
          );
          process.exit(2);
        }
        // Single file found — run fix mode
        const absoluteFilePath = path.resolve(repoRoot, multi.reports[0].file);
        await runFixMode(multi.reports[0], absoluteFilePath);
        process.exit(0);
      }

      if (format === 'json') {
        console.log(formatMultiJson(multi));
      } else {
        const output = formatMultiReport(multi);
        if (quiet) {
          const errorLines = output.split('\n').filter((l) =>
            l.includes('✖') || l.includes('agents-lint') || l.includes('Score') || l.includes('─') || l.includes('Overall')
          );
          console.log(errorLines.join('\n'));
        } else {
          console.log(output);
        }
      }

      if (multi.totalErrors > 0) process.exit(1);
      if (maxWarnings !== undefined && multi.totalWarnings > maxWarnings) {
        if (format === 'text') console.error(`\n✖ Exceeded max warnings threshold (${multi.totalWarnings} > ${maxWarnings})`);
        process.exit(1);
      }
      process.exit(0);
    }
  } catch (err: any) {
    if (format === 'json') {
      console.error(JSON.stringify({ error: err.message }));
    } else {
      console.error(`\n\x1b[31m✖ Error:\x1b[0m ${err.message}\n`);
    }
    process.exit(2);
  }
}

main();
