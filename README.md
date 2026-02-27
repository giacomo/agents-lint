# agents-lint

**Detect stale references and context rot in your AGENTS.md files.**

[![npm version](https://img.shields.io/npm/v/agents-lint?color=brightgreen)](https://www.npmjs.com/package/agents-lint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

```
$ npx agents-lint

agents-lint v0.1.0
────────────────────────────────────────────────────────────

File: AGENTS.md

Freshness Score
  ████████░░░░░░░░░░░░  42/100 (F)

Structure (1 issue)
  ⚠ No testing section found — agents need to know how to run tests
    → Add a "Testing" section with the exact test command.

Filesystem (2 issues)
  ✖ Path does not exist: "./src/services/auth"   :23
    ./src/services/auth — Run `npm test` to validate
    → Remove this reference or update to the correct path.

  ✖ Path does not exist: "./packages/ui"          :41
    → Did the monorepo structure change?

Framework Staleness (1 issue)
  ⚠ References NgModules — Angular 14+ uses standalone components
    @NgModule({ declarations: [...] })
    → Update AGENTS.md to reflect standalone component architecture.

────────────────────────────────────────────────────────────
2 errors  1 warning  0 info

Context rot detected. Agents using this file may produce incorrect
or costly outputs. Run with --fix to get suggestions.
```

---

## Why this exists

AGENTS.md files rot. You write them once, then the codebase evolves — directories move, scripts rename, dependencies change — and the file silently misleads your AI coding agents.

Two 2026 research papers confirmed what many teams had noticed:

> *"LLM-generated context files reduced task success by 2–3% while increasing cost by over 20%"* — ETH Zurich, ICSE 2026

> *"None of the major coding agents expose the lifecycle hooks to make this architecture easy to build. That's a tooling gap waiting to be filled."* — Addy Osmani, Google

`agents-lint` fills that gap. It's a zero-dependency CLI that verifies your AGENTS.md stays accurate as your repo evolves.

---

## Installation

```bash
# Run once (no install)
npx agents-lint

# Install globally
npm install -g agents-lint

# Install as a dev dependency
npm install --save-dev agents-lint
```

---

## Usage

```bash
# Lint AGENTS.md in current directory
agents-lint

# Lint a specific file
agents-lint ./docs/AGENTS.md

# Fail CI if any errors found
agents-lint --max-warnings 0

# JSON output for tooling
agents-lint --format json > report.json

# Quiet mode (errors only)
agents-lint --quiet
```

### Add to package.json

```json
{
  "scripts": {
    "lint:agents": "agents-lint --max-warnings 5"
  }
}
```

---

## What it checks

### 📁 Filesystem
Verifies every path mentioned in your AGENTS.md (`./src/services`, `./packages/ui`, etc.) still exists on disk.

### ⚙️ npm Scripts
Validates that `npm run <script>` commands referenced in AGENTS.md are present in `package.json`. Works with workspaces and monorepos.

### 📦 Dependencies
Detects references to packages not in `package.json`, and flags deprecated packages (`moment`, `request`, `tslint`, etc.).

### 🏗️ Framework Staleness
Catches outdated patterns for your detected framework:

| Framework | Example check |
|-----------|---------------|
| Angular   | `@NgModule` in an Angular 14+ project |
| Angular   | `ngcc` references (removed in v16) |
| React     | `ReactDOM.render()` (removed in React 19) |
| React     | Class component lifecycle methods |
| Next.js   | `getInitialProps` (legacy API) |
| Node.js   | CommonJS in ESM projects |

### 📋 Structure
Checks for recommended sections (Setup, Testing, Build) and quality indicators:
- AGENTS.md too short (< 100 chars) or too long (> 15,000 chars — costs 20%+ more)
- Unresolved `TODO`/`FIXME` markers
- References to years before 2024

---

## Freshness Score

Every run produces a score from **0 to 100**:

| Score | Grade | Meaning |
|-------|-------|---------|
| 90–100 | A | AGENTS.md is fresh and accurate |
| 80–89 | B | Minor issues, still reliable |
| 70–79 | C | Some stale references |
| 50–69 | D | Significant context rot |
| 0–49 | F | Agents may produce incorrect or costly outputs |

Errors cost 15 points, warnings 7, infos 2.

---

## GitHub Actions

Add to your CI pipeline with the included workflow:

```yaml
# .github/workflows/agents-lint.yml
name: agents-lint
on:
  push:
    paths: ['AGENTS.md', 'package.json']
  schedule:
    - cron: '0 9 * * 1'  # Weekly, to catch silent rot

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx agents-lint --max-warnings 5
```

The weekly schedule is intentional — **context rot happens even when AGENTS.md hasn't changed**, because your codebase evolves around it.

---

## Programmatic API

```typescript
import { lint } from 'agents-lint';

const report = await lint({
  filePath: './AGENTS.md',  // optional, auto-detected
  repoRoot: process.cwd(),  // optional
});

console.log(report.score);       // 0–100
console.log(report.errors);      // number of errors
console.log(report.warnings);    // number of warnings
console.log(report.results);     // per-checker detailed results
```

---

## CLI Reference

```
USAGE
  agents-lint [file] [options]

OPTIONS
  --root <path>         Repository root (default: cwd)
  --format <fmt>        text | json (default: text)
  --max-warnings <n>    Exit with error code 1 if warnings exceed n
  --quiet               Only show errors
  --no-color            Disable colored output
  --help                Show help
  --version             Show version

EXIT CODES
  0   No issues found
  1   Warnings or errors found
  2   Fatal error (file not found)
```

---

## Roadmap

- [ ] `--fix` mode: interactive suggestions for updating stale references
- [ ] VS Code extension with inline diagnostics
- [ ] `agents-lint init` — generate a well-structured AGENTS.md from scratch
- [ ] Support for `CLAUDE.md`, `GEMINI.md`, `.cursorrules`
- [ ] Git-blame integration: flag sections that haven't been touched in > 90 days
- [ ] Custom rules via `.agents-lint.json` config

---

## Contributing

```bash
git clone https://github.com/giacomo/agents-lint
cd agents-lint
npm install
npm run build
node dist/cli.js  # test against this repo's own AGENTS.md
```

Issues and PRs welcome. If you have a checker idea, open an issue first so we can discuss the design.

---

## Background

The AGENTS.md standard was contributed to the [Agentic AI Foundation](https://openai.com/index/agentic-ai-foundation/) (Linux Foundation) by Anthropic, OpenAI, and Block in late 2025. It's now used by 60,000+ open-source projects.

As adoption grew, so did the problem of stale context. This tool exists to solve that — automatically, in CI, before your agents start giving expensive wrong answers.

---

## License

MIT © [Giacomo Barbalinardo](https://giacomo.dev)
