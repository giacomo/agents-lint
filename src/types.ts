export type Severity = 'error' | 'warn' | 'info';

export interface LintIssue {
  rule: string;
  severity: Severity;
  message: string;
  line?: number;
  context?: string;
  suggestion?: string;
}

export interface CheckResult {
  checker: string;
  issues: LintIssue[];
  passed: number;
  failed: number;
}

export interface LintReport {
  file: string;
  score: number;
  results: CheckResult[];
  totalIssues: number;
  errors: number;
  warnings: number;
  infos: number;
  timestamp: string;
}

export interface ParsedSection {
  title: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface ParsedAgentsMd {
  rawContent: string;
  sections: ParsedSection[];
  mentionedPaths: string[];
  mentionedScripts: string[];
  mentionedDependencies: string[];
  mentionedFrameworks: string[];
  lines: string[];
}

export interface LintConfig {
  severity?: {
    missingPath?: Severity;
    missingScript?: Severity;
    staleDependency?: Severity;
    staleFramework?: Severity;
    missingSection?: Severity;
  };
  ignorePatterns?: string[];
  requiredSections?: string[];
  maxFileAgeDays?: number;
}
