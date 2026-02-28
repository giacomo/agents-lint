# AGENTS.md

> Context file for AI coding agents working on this repository.

## Project

`agents-lint` is a TypeScript CLI that lints AGENTS.md files for stale references,
outdated framework patterns, and missing sections.

## Setup

```bash
npm install
npm run build
```

Requires Node.js >=18.

## Structure

```
src/
  cli.ts          CLI entry point (argument parsing, output)
  linter.ts       lint() single file; lintAll() multi-file + cross-check
  parser.ts       Parses context files into ParsedAgentsMd
  reporter.ts     Formats output (text + JSON), computes score
  types.ts        Shared TypeScript types (LintReport, MultiLintReport, …)
  config.ts       Loads .agents-lint.json config
  init.ts         Generates starter AGENTS.md
  fix.ts          --fix interactive mode engine
  checkers/
    filesystem.ts    Checks if mentioned paths exist
    npm-scripts.ts   Validates npm run <script> references
    dependencies.ts  Checks package.json for mentioned deps
    framework.ts     Framework-specific staleness checks
    structure.ts     Validates recommended sections and quality
    cross.ts         Cross-file consistency (PM, scripts, paths)
  tests/
    helpers.ts       Shared test utilities (writeTmp, makeParsed, …)
    parser.test.ts
    reporter.test.ts
    checkers/        One test file per checker
```

## Testing

Tests use the **Node.js built-in test runner** — no extra packages required.

```bash
npm test                                           # compile + run all tests
node --test dist/tests/parser.test.js              # run a single test file
node --test dist/tests/checkers/filesystem.test.js # run one checker's tests
```

Test files live in `src/tests/` and compile to `dist/tests/` alongside the source.
Shared utilities (`writeTmp`, `makeParsed`, `makeTmpRepo`, `parsedFromContent`) are in `src/tests/helpers.ts`.

To test manually against a real repo:
```bash
npm run build
node dist/cli.js --root /path/to/some/repo
```

When adding a new checker, add a corresponding `src/tests/checkers/my-checker.test.ts`.

## Build

```bash
npm run build   # tsc → dist/
```

The build output goes to `./dist`. The CLI entry is `dist/cli.js` and has a
`#!/usr/bin/env node` shebang.

## Conventions

- All source files use `.ts` with strict TypeScript
- Imports use the `.js` extension (NodeNext ESM resolution)
- No external runtime dependencies — the tool must work with `npx` instantly
- Checker functions return `CheckResult` — never throw, always return issues
- All user-visible strings are in the file that uses them (no i18n needed)

## Adding a new checker

1. Create `src/checkers/my-checker.ts`
2. Export a function `checkMyThing(parsed: ParsedAgentsMd, repoRoot: string): CheckResult`
3. Import and call it in `src/linter.ts` inside the `results` array
4. The score is automatically recalculated — no other changes needed

## PR guidelines

- Keep checkers focused and independent
- Add test cases for new rules
- Update `ROADMAP` section in README if closing a roadmap item
