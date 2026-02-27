#!/usr/bin/env node
import * as path from 'path';
import { lint } from './linter.js';
import { formatReport, formatJson } from './reporter.js';

const VERSION = '0.1.0';

const HELP = `
agents-lint v${VERSION}
Detect stale references and context rot in your AGENTS.md files.

USAGE
  agents-lint [file] [options]

ARGUMENTS
  file                  Path to AGENTS.md (default: auto-detected in cwd)

OPTIONS
  --root <path>         Repository root to resolve paths against (default: cwd)
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

  // Parse args
  let filePath: string | undefined;
  let repoRoot = process.cwd();
  let format: 'text' | 'json' = 'text';
  let maxWarnings: number | undefined;
  let quiet = false;

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
      case '--no-color':
        process.env.NO_COLOR = '1';
        break;
      default:
        if (!arg.startsWith('--') && !filePath) {
          filePath = path.resolve(arg);
        }
    }
  }

  try {
    const report = await lint({ filePath, repoRoot });

    if (format === 'json') {
      console.log(formatJson(report));
    } else {
      const output = formatReport(report);
      if (quiet) {
        // Only show error lines
        const errorLines = output.split('\n').filter((l) =>
          l.includes('✖') || l.includes('agents-lint') || l.includes('Score') || l.includes('─')
        );
        console.log(errorLines.join('\n'));
      } else {
        console.log(output);
      }
    }

    // Determine exit code
    if (report.errors > 0) {
      process.exit(1);
    }
    if (maxWarnings !== undefined && report.warnings > maxWarnings) {
      if (format === 'text') {
        console.error(`\n✖ Exceeded max warnings threshold (${report.warnings} > ${maxWarnings})`);
      }
      process.exit(1);
    }

    process.exit(0);
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
