import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { UserProfile } from './types';

export type AppConfig = { workspaceRoot: string; user?: UserProfile };

export function getAppConfigPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'ratatoskr', 'config.json');
}

export function readAppConfigSync(): AppConfig | null {
  try {
    const raw = readFileSync(getAppConfigPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    if (typeof parsed.workspaceRoot === 'string' && parsed.workspaceRoot.length > 0) {
      const config: AppConfig = { workspaceRoot: parsed.workspaceRoot };
      if (
        parsed.user &&
        typeof parsed.user.username === 'string' &&
        parsed.user.username.length > 0 &&
        typeof parsed.user.display_name === 'string' &&
        parsed.user.display_name.length > 0
      ) {
        config.user = {
          username: parsed.user.username,
          display_name: parsed.user.display_name,
          ...(typeof parsed.user.email === 'string' ? { email: parsed.user.email } : {}),
        };
      }
      return config;
    }
    return null;
  } catch {
    return null;
  }
}

export function readUserProfileSync(): UserProfile | null {
  try {
    const raw = readFileSync(getAppConfigPath(), 'utf8');
    const parsed = JSON.parse(raw) as { user?: Partial<UserProfile> };
    const u = parsed.user;
    if (
      u &&
      typeof u.username === 'string' &&
      u.username.length > 0 &&
      typeof u.display_name === 'string' &&
      u.display_name.length > 0
    ) {
      return {
        username: u.username,
        display_name: u.display_name,
        ...(typeof u.email === 'string' ? { email: u.email } : {}),
      };
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
