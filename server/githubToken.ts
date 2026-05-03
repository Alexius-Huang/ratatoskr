import { chmod, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function getTokenFilePath(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'ratatoskr', 'github_token');
}

export async function tokenExists(): Promise<boolean> {
  try {
    await stat(getTokenFilePath());
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

export async function readToken(): Promise<string | null> {
  try {
    const raw = await readFile(getTokenFilePath(), 'utf8');
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeToken(token: string): Promise<void> {
  const p = getTokenFilePath();
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, token, { mode: 0o600 });
  await chmod(p, 0o600);
}

export async function deleteToken(): Promise<void> {
  try {
    await unlink(getTokenFilePath());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
