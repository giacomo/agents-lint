# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dev dependencies (typescript, @types/node only)
npm run build        # compile src/ → dist/ via tsc
npm run dev          # watch mode compilation
npm test             # compile + run all tests via Node built-in test runner
npm start            # run dist/cli.js against cwd
node dist/cli.js --root /path/to/repo   # test against an external repo
```

No external runtime dependencies — only `typescript` and `@types/node` in devDependencies.

## Testing

Tests use the **Node.js built-in test runner** (`node:test` + `node:assert/strict`) — no extra packages needed.

```bash
npm test                                           # compile + run all 41 tests
node --test dist/tests/parser.test.js              # run a single test file
node --test dist/tests/checkers/filesystem.test.js # run one checker's tests
```

**Test layout** (mirrors `src/` structure):
```
src/tests/
  helpers.ts                  # writeTmp(), makeParsed(), makeTmpRepo(), parsedFromContent()
  parser.test.ts              # parseAgentsMd() — path extraction, negation context, scripts, sections
  reporter.test.ts            # computeScore() — penalty math, floor/ceiling
  checkers/
    filesystem.test.ts        # path existence, ignorePatterns, custom severity
    npm-scripts.test.ts       # script validation, missing-test-script warning
    structure.test.ts         # section detection, TODO markers, stale years
    dependencies.test.ts      # dep presence, deprecated packages
    framework.test.ts         # ReactDOM.render, @NgModule, Node version refs
```

Each checker test creates isolated temp directories with `makeTmpRepo()` and cleans up in `finally` blocks. Tests compile into `dist/tests/` alongside source output.

## Architecture

The tool is a pipeline: **parse → check → report**.

1. **`src/parser.ts`** — Reads an AGENTS.md file and extracts structured data (`ParsedAgentsMd`): sections, mentioned file paths, `npm run` script references, dependency names, and framework patterns via regex.

2. **`src/linter.ts`** — Orchestrator. Auto-detects `AGENTS.md`/`agents.md`/`.agents.md`, calls `parseAgentsMd()`, runs all five checkers in sequence, and assembles a `LintReport`.

3. **`src/checkers/`** — Five independent checker modules, each exporting a function with the signature:
   ```ts
   checkXxx(parsed: ParsedAgentsMd, repoRoot: string): CheckResult
   ```
   - `filesystem.ts` — verifies mentioned paths exist on disk
   - `npm-scripts.ts` — validates `npm run <script>` references against `package.json`
   - `dependencies.ts` — checks mentioned packages are in `package.json`; flags deprecated packages
   - `framework.ts` — detects outdated patterns (e.g. `@NgModule` in Angular 14+, `ReactDOM.render` in React 19)
   - `structure.ts` — validates recommended sections (Setup, Testing, Build), file length, TODO markers, stale year references

4. **`src/reporter.ts`** — Formats `LintReport` as colored text or JSON. `computeScore()` subtracts weighted penalties (15/error, 7/warn, 2/info) from a base pass-rate score.

5. **`src/cli.ts`** — Argument parsing and process exit codes (0 = clean, 1 = issues, 2 = fatal).

6. **`src/types.ts`** — All shared types: `LintIssue`, `CheckResult`, `LintReport`, `ParsedAgentsMd`, `LintConfig`.

## Key Conventions

- **ESM project**: `"type": "module"` in package.json; all imports use `.js` extension (NodeNext resolution), even for `.ts` source files.
- **Strict TypeScript**: `strict: true`, target `ES2022`, `moduleResolution: NodeNext`.
- **Checkers never throw** — always return `CheckResult` with issues.
- **No runtime deps** — the tool must work with `npx agents-lint` instantly.

## Adding a Checker

1. Create `src/checkers/my-checker.ts` exporting `checkMyThing(parsed: ParsedAgentsMd, repoRoot: string): CheckResult`
2. Import and add it to the `results` array in `src/linter.ts`
3. The score recalculates automatically — no other changes needed
