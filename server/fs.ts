import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectSummary, RatatoskrConfig } from './types';

export function getWorkspaceRoot(): string {
  const fromEnv = process.env.RATATOSKR_WORKSPACE_ROOT;
  if (fromEnv) return fromEnv;
  return path.resolve(process.cwd(), '..', '..');
}

export async function readProjectConfig(projectName: string): Promise<{
  config: RatatoskrConfig | null;
  hasConfig: boolean;
  warnings: string[];
}> {
  const workspaceRoot = getWorkspaceRoot();
  const configPath = path.join(
    workspaceRoot,
    'projects',
    projectName,
    '.meta',
    'ratatoskr',
    'config.json',
  );

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch {
    return { config: null, hasConfig: false, warnings: ['Missing config.json'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      config: null,
      hasConfig: true,
      warnings: ['Invalid JSON in config.json'],
    };
  }

  const candidate = parsed as Partial<RatatoskrConfig> | null;
  if (
    !candidate ||
    typeof candidate.prefix !== 'string' ||
    candidate.prefix.length === 0
  ) {
    return {
      config: null,
      hasConfig: true,
      warnings: ['Missing prefix field'],
    };
  }

  return {
    config: candidate as RatatoskrConfig,
    hasConfig: true,
    warnings: [],
  };
}

export async function scanProjects(): Promise<ProjectSummary[]> {
  const workspaceRoot = getWorkspaceRoot();
  const projectsDir = path.join(workspaceRoot, 'projects');

  let entries;
  try {
    entries = await readdir(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const directoryNames = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  const results = await Promise.all(
    directoryNames.map(async (name) => {
      const { config, hasConfig, warnings } = await readProjectConfig(name);
      return { name, config, hasConfig, warnings } satisfies ProjectSummary;
    }),
  );

  return results;
}
