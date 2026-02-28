import * as fs from 'fs';
import * as path from 'path';
import type { ParsedAgentsMd, ParsedSection } from './types.js';

// Regex patterns for extracting references from markdown
const PATH_PATTERNS = [
  /`([./][^\s`]+)`/g,               // backtick paths: `./src/index.ts`
  /\*\*([./][^\s*]+)\*\*/g,          // bold paths: **./src/**
  /(?:in|at|to|from|see)\s+`([^`]+\/[^`]+)`/gi, // "in `src/foo`"
  /(?:directory|folder|file|path):\s*`([^`]+)`/gi,
];

const SCRIPT_PATTERNS = [
  /`npm run ([\w:-]+)`/g,
  /`yarn ([\w:-]+)`/g,
  /`pnpm ([\w:-]+)`/g,
  /`bun ([\w:-]+)`/g,
  /npm run ([\w:-]+)/g,
  /yarn ([\w:-]+)/g,
];

const DEPENDENCY_PATTERNS = [
  /`([@\w][\w/.-]+@[\d.^~*]+)`/g,   // `package@version`
  /\b(react|vue|angular|next|nuxt|svelte|solid|astro|remix|express|fastify|hono|nestjs|prisma|drizzle|zod|typescript)\b/gi,
];

// Phrases that indicate a path is being referenced as absent/removed, not as a live location
const NEGATING_PHRASES = [
  /no longer/i,
  /removed/i,
  /not exist/i,
  /doesn't exist/i,
  /does not exist/i,
  /deprecated/i,
];

function isInNegatingContext(content: string, matchIndex: number): boolean {
  const lineStart = content.lastIndexOf('\n', matchIndex) + 1;
  const lineEnd = content.indexOf('\n', matchIndex);
  const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
  return NEGATING_PHRASES.some((p) => p.test(line));
}

const FRAMEWORK_PATTERNS: Record<string, RegExp[]> = {
  angular: [/NgModule/g, /forRoot\(\)/g, /ngcc/g, /ViewChild/g],
  react: [/React\.Component/g, /componentDidMount/g, /componentWillMount/g],
  vue: [/Vue\.use/g, /new Vue\(/g],
  node: [/require\(/g, /module\.exports/g],
};

export function parseAgentsMd(filePath: string): ParsedAgentsMd {
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const lines = rawContent.split('\n');

  const sections = parseSections(lines);
  const mentionedPaths = extractPaths(rawContent);
  const mentionedScripts = extractScripts(rawContent);
  const mentionedDependencies = extractDependencies(rawContent);
  const mentionedFrameworks = extractFrameworks(rawContent);

  return {
    rawContent,
    sections,
    mentionedPaths,
    mentionedScripts,
    mentionedDependencies,
    mentionedFrameworks,
    lines,
  };
}

function parseSections(lines: string[]): ParsedSection[] {
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      if (currentSection) {
        currentSection.endLine = index - 1;
        sections.push(currentSection);
      }
      currentSection = {
        title: headingMatch[2].trim(),
        content: '',
        startLine: index,
        endLine: index,
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }
  });

  if (currentSection !== null) {
    (currentSection as ParsedSection).endLine = lines.length - 1;
    sections.push(currentSection as ParsedSection);
  }

  return sections;
}

function extractPaths(content: string): string[] {
  const paths = new Set<string>();

  for (const pattern of PATH_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const candidate = match[1];
      // Filter: must look like a real path
      if (candidate && (candidate.startsWith('./') || candidate.startsWith('../') || candidate.startsWith('/') || candidate.includes('/'))) {
        // Skip paths mentioned in a negating context (e.g. "no longer exists in `app/Http/Kernel.php`")
        if (isInNegatingContext(content, match.index)) continue;
        // Remove trailing punctuation
        paths.add(candidate.replace(/[,;:.]$/, ''));
      }
    }
  }

  return [...paths];
}

function extractScripts(content: string): string[] {
  const scripts = new Set<string>();

  for (const pattern of SCRIPT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1] && match[1] !== 'install' && match[1] !== 'init') {
        scripts.add(match[1]);
      }
    }
  }

  return [...scripts];
}

function extractDependencies(content: string): string[] {
  const deps = new Set<string>();

  for (const pattern of DEPENDENCY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) deps.add(match[1].toLowerCase().split('@')[0]);
    }
  }

  return [...deps];
}

function extractFrameworks(content: string): string[] {
  const frameworks: string[] = [];

  for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        frameworks.push(framework);
        break;
      }
    }
  }

  return frameworks;
}
