import type { CheckResult, LintIssue, ParsedAgentsMd, LintConfig, Severity } from '../types.js';

interface RecommendedSection {
  keywords: string[];
  rule: string;
  message: string;
  suggestion: string;
  severity: 'error' | 'warn' | 'info';
}

const RECOMMENDED_SECTIONS: RecommendedSection[] = [
  {
    keywords: ['setup', 'install', 'getting started', 'quick start', 'prerequisites'],
    rule: 'missing-setup-section',
    message: 'No setup/installation section found',
    suggestion: 'Add a "Setup" or "Getting Started" section explaining how to install dependencies and configure the environment.',
    severity: 'warn',
  },
  {
    keywords: ['test', 'testing', 'run tests', 'unit test', 'e2e'],
    rule: 'missing-test-section',
    message: 'No testing section found — agents need to know how to run tests to verify their changes',
    suggestion: 'Add a "Testing" section with the exact commands to run tests (e.g., `npm test` or `npm run test:unit`).',
    severity: 'warn',
  },
  {
    keywords: ['build', 'compile', 'bundle'],
    rule: 'missing-build-section',
    message: 'No build section found',
    suggestion: 'Add a "Build" section with the command to build the project (e.g., `npm run build`).',
    severity: 'info',
  },
];

const QUALITY_CHECKS = [
  {
    check: (parsed: ParsedAgentsMd) => parsed.rawContent.length < 100,
    rule: 'too-short',
    severity: 'warn' as const,
    message: 'Context file is very short (< 100 characters) — agents may lack sufficient context',
    suggestion: 'Add more context about your project structure, conventions, and workflows.',
  },
  {
    check: (parsed: ParsedAgentsMd) => parsed.rawContent.length > 15000,
    rule: 'too-long',
    severity: 'info' as const,
    message: 'Context file is very long (> 15,000 characters) — context bloat increases cost by 20%+',
    suggestion: 'Trim to only non-discoverable information. Remove sections that describe things agents can infer from code.',
  },
  {
    check: (parsed: ParsedAgentsMd) => {
      const todoCount = (parsed.rawContent.match(/TODO|FIXME|XXX|HACK/gi) ?? []).length;
      return todoCount > 3;
    },
    rule: 'too-many-todos',
    severity: 'info' as const,
    message: 'Context file contains multiple TODO/FIXME markers — stale notes can mislead agents',
    suggestion: 'Resolve TODOs or remove them from AGENTS.md. Outdated notes are worse than no notes.',
  },
  {
    check: (parsed: ParsedAgentsMd) => {
      // Check if the file mentions a year that's more than 1 year old
      const oldYearPattern = /\b(201[0-9]|202[0-3])\b/;
      return oldYearPattern.test(parsed.rawContent);
    },
    rule: 'old-year-reference',
    severity: 'info' as const,
    message: 'Context file references years before 2024 — may contain stale information',
    suggestion: 'Review and update any time-sensitive references.',
  },
];

export function checkStructure(parsed: ParsedAgentsMd, config: LintConfig = {}): CheckResult {
  const issues: LintIssue[] = [];
  let passed = 0;
  const missingSectionSeverity: Severity = config.severity?.missingSection ?? 'warn';

  // Build list of sections to check (defaults + any extra from config)
  const sectionsToCheck = [...RECOMMENDED_SECTIONS];
  for (const customSection of config.requiredSections ?? []) {
    sectionsToCheck.push({
      keywords: [customSection.toLowerCase()],
      rule: `missing-custom-section-${customSection.toLowerCase().replace(/\s+/g, '-')}`,
      message: `Required section "${customSection}" not found`,
      suggestion: `Add a "${customSection}" section as required by your .agents-lint.json config.`,
      severity: missingSectionSeverity,
    });
  }

  // Check for recommended sections
  for (const section of sectionsToCheck) {
    const sectionTitles = parsed.sections.map((s) => s.title.toLowerCase());
    const contentLower = parsed.rawContent.toLowerCase();

    const found = section.keywords.some(
      (kw) =>
        sectionTitles.some((t) => t.includes(kw)) ||
        contentLower.includes(kw)
    );

    if (found) {
      passed++;
    } else {
      issues.push({
        rule: section.rule,
        severity: missingSectionSeverity,
        message: section.message,
        suggestion: section.suggestion,
      });
    }
  }

  // Quality checks
  for (const qc of QUALITY_CHECKS) {
    if (qc.check(parsed)) {
      issues.push({
        rule: qc.rule,
        severity: qc.severity,
        message: qc.message,
        suggestion: qc.suggestion,
      });
    } else {
      passed++;
    }
  }

  return {
    checker: 'structure',
    issues,
    passed,
    failed: issues.length,
  };
}
