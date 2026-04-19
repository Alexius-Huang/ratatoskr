import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type AppConfig = { workspaceRoot: string };

export function getAppConfigPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'ratatoskr', 'config.json');
}

export function readAppConfigSync(): AppConfig | null {
  try {
    const raw = readFileSync(getAppConfigPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    if (typeof parsed.workspaceRoot === 'string' && parsed.workspaceRoot.length > 0) {
      return { workspaceRoot: parsed.workspaceRoot };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeAppConfig(config: AppConfig): void {
  const p = getAppConfigPath();
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(config, null, 2) + '\n', 'utf8');
}
