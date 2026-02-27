import * as fs from 'fs';
import * as path from 'path';
import type { LintConfig } from './types.js';

const CONFIG_FILES = ['.agents-lint.json', '.agents-lint.config.json'];

export function loadConfig(repoRoot: string): LintConfig {
  for (const configFile of CONFIG_FILES) {
    const configPath = path.join(repoRoot, configFile);
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(raw) as LintConfig;
      } catch {
        // Ignore malformed config and use defaults
      }
    }
  }
  return {};
}
