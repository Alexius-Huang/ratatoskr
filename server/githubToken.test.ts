import { chmod, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteToken, getTokenFilePath, readToken, tokenExists, writeToken } from './githubToken';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rat-github-token-test-'));
  process.env.XDG_CONFIG_HOME = tmpDir;
});

afterEach(async () => {
  delete process.env.XDG_CONFIG_HOME;
  await rm(tmpDir, { recursive: true, force: true });
});

describe('getTokenFilePath', () => {
  it('should honor XDG_CONFIG_HOME', () => {
    const p = getTokenFilePath();
    expect(p).toBe(path.join(tmpDir, 'ratatoskr', 'github_token'));
  });
});

describe('tokenExists', () => {
  it.each([
    ['returns false when file missing', false, null],
    ['returns true after writeToken', true, 'ghp_token'],
  ] as [string, boolean, string | null][])('%s', async (_label, expected, writeFirst) => {
    if (writeFirst !== null) await writeToken(writeFirst);
    expect(await tokenExists()).toBe(expected);
  });
});

describe('readToken', () => {
  it.each([
    ['returns null when file missing', null, null],
    ['returns trimmed contents after write', 'ghp_abc123', 'ghp_abc123\n'],
  ] as [string, string | null, string | null][])('%s', async (_label, expected, content) => {
    if (content !== null) {
      const p = getTokenFilePath();
      const { mkdir } = await import('node:fs/promises');
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, content, 'utf8');
    }
    expect(await readToken()).toBe(expected);
  });
});

describe('writeToken', () => {
  it('should create the parent directory if missing', async () => {
    await writeToken('ghp_newtoken');
    const { stat: statFn } = await import('node:fs/promises');
    const s = await statFn(path.dirname(getTokenFilePath()));
    expect(s.isDirectory()).toBe(true);
  });

  it('should write the token content', async () => {
    await writeToken('ghp_testvalue');
    expect(await readToken()).toBe('ghp_testvalue');
  });

  it('should set mode 0600 on a new file', async () => {
    await writeToken('ghp_secure');
    const s = await stat(getTokenFilePath());
    expect(s.mode & 0o777).toBe(0o600);
  });

  it('should re-apply mode 0600 when overwriting an existing file that had 0644', async () => {
    await writeToken('ghp_first');
    await chmod(getTokenFilePath(), 0o644);
    await writeToken('ghp_second');
    const s = await stat(getTokenFilePath());
    expect(s.mode & 0o777).toBe(0o600);
    expect(await readToken()).toBe('ghp_second');
  });
});

describe('deleteToken', () => {
  it('should remove an existing token file', async () => {
    await writeToken('ghp_todelete');
    expect(await tokenExists()).toBe(true);
    await deleteToken();
    expect(await tokenExists()).toBe(false);
  });

  it('should not throw when the file does not exist', async () => {
    await expect(deleteToken()).resolves.toBeUndefined();
  });
});
