# agents-lint

**Detect stale references and context rot in your AGENTS.md, CLAUDE.md, and AI memory files.**

[![npm version](https://img.shields.io/npm/v/agents-lint?color=brightgreen)](https://www.npmjs.com/package/agents-lint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

```
$ npx agents-lint

agents-lint v0.4.5
────────────────────────────────────────────────────────────
Found 3 context files: AGENTS.md, CLAUDE.md, ~/.claude/projects/my-repo/memory/MEMORY.md

File: AGENTS.md  ·  100/100 (A)
  ✓ No issues

File: CLAUDE.md  ·  42/100 (F)
  ✖ Path does not exist: "./src/services/auth"
    → Remove this reference or update to the correct path.
  ⚠ References NgModules — Angular 14+ uses standalone components
    → Update CLAUDE.md to reflect standalone component architecture.

File: ~/.claude/.../memory/MEMORY.md  ·  85/100 (B)
  ✖ Memory index link broken: old-project-notes.md
    → "old-project-notes.md" no longer exists. Remove this entry or update the link.

Cross-File Consistency (1 issue)
  ℹ Path "./src/payments" referenced in AGENTS.md but not in CLAUDE.md
    → Consider documenting in all context files, or run --fix to suppress.

────────────────────────────────────────────────────────────
Overall: 71/100  ·  2 errors  1 warning  1 info
```

---

## Why this exists

AGENTS.md files rot. You write them once, then the codebase evolves — directories move, scripts rename, dependencies change — and the file silently misleads your AI coding agents.

Two 2026 research papers confirmed what many teams had noticed:

> *"LLM-generated context files reduced task success by 2–3% while increasing cost by over 20%"* — ETH Zurich, ICSE 2026

> *"None of the major coding agents expose the lifecycle hooks to make this architecture easy to build. That's a tooling gap waiting to be filled."* — Addy Osmani, Google

`agents-lint` fills that gap. It's a zero-dependency CLI that verifies your AGENTS.md, CLAUDE.md, and AI memory files stay accurate as your repo evolves.

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
# Generate a starter AGENTS.md for this project
agents-lint init

# Lint all context files in the current directory (auto-detected)
agents-lint

# Lint a specific file
agents-lint ./docs/AGENTS.md

# Interactive fix mode — review and apply suggested fixes
agents-lint --fix

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
Verifies every path mentioned in your context files (`./src/services`, `./packages/ui`, etc.) still exists on disk.

### ⚙️ npm Scripts
Validates that `npm run <script>` commands referenced in your file are present in `package.json`. Works with workspaces and monorepos.

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
- File too short (< 100 chars) or too long (> 15,000 chars — costs 20%+ more)
- Unresolved `TODO`/`FIXME` markers
- References to years before 2024

### 🔗 Cross-File Consistency
When multiple context files are detected, checks for conflicts between them:
- **Package manager conflict** — one file says `npm`, another says `yarn` (error)
- **Script role conflict** — different test or build commands across files (warning)
- **Path asymmetry** — a significant path mentioned in one file but missing from others (info)

### 🧠 Claude Memory Files
Validates Claude Code memory files (auto-detected from `~/.claude/projects/<repo>/memory/`):
- **Broken index links** — `MEMORY.md` entries pointing to files that no longer exist (error)
- **Missing frontmatter** — individual memory entries missing the `---` block (error)
- **Invalid memory type** — `type:` must be `user`, `feedback`, `project`, or `reference` (warning)
- **Missing required fields** — `name` and `description` must be present in frontmatter (warning)

---

## Freshness Score

Every run produces a score from **0 to 100**:

| Score | Grade | Meaning |
|-------|-------|---------|
| 90–100 | A | Context files are fresh and accurate |
| 80–89 | B | Minor issues, still reliable |
| 70–79 | C | Some stale references |
| 50–69 | D | Significant context rot |
| 0–49 | F | Agents may produce incorrect or costly outputs |

Errors cost 15 points, warnings 7, infos 2.

---

## Supported file names

`agents-lint` auto-detects any of these in the repo root and from your Claude Code memory directory:

| File | Used by |
|------|---------|
| `AGENTS.md` | Codex, general |
| `CLAUDE.md` | Claude Code |
| `GEMINI.md` | Gemini CLI |
| `COPILOT.md` | GitHub Copilot |
| `.cursorrules` | Cursor |
| `.github/copilot-instructions.md` | GitHub Copilot |
| `.claude/MEMORY.md` | Claude Code (project-local) |
| `~/.claude/projects/<repo>/memory/*.md` | Claude Code (user memory) |

The Claude user memory directory is automatically derived from your repo path — no configuration needed.

Pass an explicit path to lint any file: `agents-lint ~/.claude/projects/my-repo/memory/MEMORY.md`

---

## Interactive fix mode

Run `agents-lint --fix` to review and apply suggested fixes one at a time:

```
agents-lint — Fix Mode
────────────────────────────────────────────────────────────
Cross-file issues  ·  1 fixable, 0 advisory

Issue 1/1  [fixable]
  ℹ Path "src/tests/helpers.ts" referenced in AGENTS.md but not in CLAUDE.md

  Fix: Add "src/tests/helpers.ts" to ignorePatterns in .agents-lint.json

  Apply? (y)es / (n)o / (q)uit  › y
  ✓ Will add to ignorePatterns

────────────────────────────────────────────────────────────
✓ Updated .agents-lint.json — added 1 pattern to ignorePatterns
```

Fix mode handles:
- **Stale path references** — remove the line
- **Missing sections** — append a template section
- **Cross-file path asymmetry** — add the path to `ignorePatterns` in `.agents-lint.json`

---

## GitHub Actions

```yaml
# .github/workflows/agents-lint.yml
name: agents-lint
on:
  push:
    paths: ['AGENTS.md', 'CLAUDE.md', 'package.json']
  schedule:
    - cron: '0 9 * * 1'  # Weekly — catch silent rot

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx agents-lint --max-warnings 5
```

The weekly schedule is intentional — **context rot happens even when your context files haven't changed**, because your codebase evolves around them.

---

## Quick start: `agents-lint init`

Generate a well-structured starter file based on your project's detected stack:

```bash
npx agents-lint init
```

This creates `AGENTS.md` with sections for Setup, Structure, Testing, Build, and Conventions — pre-populated from your `package.json`. Fill in the `TODO` comments, then run `agents-lint` to validate.

---

## Custom rules (`.agents-lint.json`)

Place `.agents-lint.json` in your repo root to override defaults:

```json
{
  "requiredSections": ["Architecture", "Deployment"],
  "ignorePatterns": ["./legacy", "node_modules", "src/tests/helpers.ts"],
  "severity": {
    "missingPath": "warn",
    "missingScript": "error",
    "staleDependency": "warn",
    "missingSection": "error"
  }
}
```

| Option | Type | Description |
|--------|------|-------------|
| `requiredSections` | `string[]` | Extra section names that must exist |
| `ignorePatterns` | `string[]` | Substrings — matching paths/deps are skipped in all checks including cross-file |
| `severity.missingPath` | `error\|warn\|info` | Override severity for missing filesystem paths (default: `error`) |
| `severity.missingScript` | `error\|warn\|info` | Override for missing npm scripts (default: `warn`) |
| `severity.staleDependency` | `error\|warn\|info` | Override for deprecated packages (default: `info`) |
| `severity.missingSection` | `error\|warn\|info` | Override for missing recommended sections (default: `warn`) |

---

## Programmatic API

```typescript
import { lint, lintAll } from 'agents-lint';

// Lint a single file
const report = await lint({
  filePath: './AGENTS.md',  // optional, auto-detected
  repoRoot: process.cwd(),  // optional
});

console.log(report.score);    // 0–100
console.log(report.errors);   // number of errors
console.log(report.results);  // per-checker detailed results

// Lint all detected files (including Claude memory files)
const multi = await lintAll({ repoRoot: process.cwd() });

console.log(multi.overallScore);   // combined score
console.log(multi.crossCheck);     // cross-file consistency results
console.log(multi.files);          // list of detected files
```

---

## CLI Reference

```
USAGE
  agents-lint [file] [options]
  agents-lint init

COMMANDS
  init                  Generate a starter AGENTS.md for this project

OPTIONS
  --root <path>         Repository root (default: cwd)
  --fix                 Interactive mode: review and apply suggested fixes
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

- [x] `--fix` mode: interactive suggestions for updating stale references and cross-file issues
- [x] `agents-lint init` — generate a well-structured AGENTS.md from scratch
- [x] Support for `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `COPILOT.md`
- [x] Claude Code memory file support — auto-detect and validate `~/.claude/projects/*/memory/`
- [x] Cross-file consistency checks across multiple context files
- [x] Custom rules via `.agents-lint.json` config
- [ ] VS Code extension with inline diagnostics
- [ ] Git-blame integration: flag sections that haven't been touched in > 90 days

---

## Contributing

```bash
git clone https://github.com/giacomo/agents-lint
cd agents-lint
npm install
npm run build
node dist/cli.js  # test against this repo's own context files
npm test          # run the test suite (62 tests, no extra dependencies)
```

Issues and PRs welcome. If you have a checker idea, open an issue first so we can discuss the design.

---

## Background

The AGENTS.md standard was contributed to the [Agentic AI Foundation](https://openai.com/index/agentic-ai-foundation/) (Linux Foundation) by Anthropic, OpenAI, and Block in late 2025. It's now used by 60,000+ open-source projects.

As adoption grew, so did the problem of stale context. This tool exists to solve that — automatically, in CI, before your agents start giving expensive wrong answers.

---

## License

MIT © [Giacomo Barbalinardo](https://giacomo.dev)
