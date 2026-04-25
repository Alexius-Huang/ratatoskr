import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAppConfigPath, readAppConfigSync, readUserProfileSync, writeAppConfig } from './appConfig';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rat-appconfig-test-'));
  process.env.XDG_CONFIG_HOME = tmpDir;
});

afterEach(async () => {
  delete process.env.XDG_CONFIG_HOME;
  await rm(tmpDir, { recursive: true, force: true });
});

describe('getAppConfigPath', () => {
  it('should honor XDG_CONFIG_HOME', () => {
    const p = getAppConfigPath();
    expect(p).toBe(path.join(tmpDir, 'ratatoskr', 'config.json'));
  });
});

describe('readAppConfigSync', () => {
  it('should return null when file missing', () => {
    expect(readAppConfigSync()).toBeNull();
  });

  it('should return null when JSON malformed', () => {
    const dir = path.join(tmpDir, 'ratatoskr');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'config.json'), 'not-json', 'utf8');
    expect(readAppConfigSync()).toBeNull();
  });

  it('should return null when workspaceRoot missing', () => {
    const dir = path.join(tmpDir, 'ratatoskr');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'config.json'), JSON.stringify({}), 'utf8');
    expect(readAppConfigSync()).toBeNull();
  });

  it('should return null when workspaceRoot is empty string', () => {
    const dir = path.join(tmpDir, 'ratatoskr');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ workspaceRoot: '' }), 'utf8');
    expect(readAppConfigSync()).toBeNull();
  });

  it('should return AppConfig when file is valid', () => {
    const dir = path.join(tmpDir, 'ratatoskr');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ workspaceRoot: '/some/path' }), 'utf8');
    const result = readAppConfigSync();
    expect(result).not.toBeNull();
    expect(result?.workspaceRoot).toBe('/some/path');
  });
});

describe('writeAppConfig', () => {
  it('should create parent dirs and write JSON', () => {
    writeAppConfig({ workspaceRoot: '/my/workspace' });
    const result = readAppConfigSync();
    expect(result?.workspaceRoot).toBe('/my/workspace');
  });

  it('should overwrite existing config', () => {
    writeAppConfig({ workspaceRoot: '/first' });
    writeAppConfig({ workspaceRoot: '/second' });
    expect(readAppConfigSync()?.workspaceRoot).toBe('/second');
  });
});

// ---------------------------------------------------------------------------

function writeConfigFile(data: unknown) {
  const dir = path.join(tmpDir, 'ratatoskr');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'config.json'), JSON.stringify(data), 'utf8');
}

describe('readUserProfileSync', () => {
  it('should return null when the config file does not exist', () => {
    expect(readUserProfileSync()).toBeNull();
  });

  it('should return null when the file exists but has no user block', () => {
    writeConfigFile({ workspaceRoot: '/some/path' });
    expect(readUserProfileSync()).toBeNull();
  });

  it.each([
    ['username', { display_name: 'James Huang' }],
    ['display_name', { username: 'j.huang' }],
  ])('should return null when user block is missing required field: %s', (_field, partial) => {
    writeConfigFile({ workspaceRoot: '/some/path', user: partial });
    expect(readUserProfileSync()).toBeNull();
  });

  it.each([
    ['username', { username: '', display_name: 'James Huang' }],
    ['display_name', { username: 'j.huang', display_name: '' }],
  ])('should return null when %s is an empty string', (_field, user) => {
    writeConfigFile({ workspaceRoot: '/some/path', user });
    expect(readUserProfileSync()).toBeNull();
  });

  it('should return a UserProfile when username and display_name are present', () => {
    writeConfigFile({
      workspaceRoot: '/some/path',
      user: { username: 'j.huang', display_name: 'James Huang' },
    });
    const result = readUserProfileSync();
    expect(result).toEqual({ username: 'j.huang', display_name: 'James Huang' });
  });

  it('should include email when present and string-typed', () => {
    writeConfigFile({
      workspaceRoot: '/some/path',
      user: { username: 'j.huang', display_name: 'James Huang', email: 'j@example.com' },
    });
    const result = readUserProfileSync();
    expect(result?.email).toBe('j@example.com');
  });

  it.each([
    ['missing', { username: 'j.huang', display_name: 'James Huang' }],
    ['non-string', { username: 'j.huang', display_name: 'James Huang', email: 42 }],
  ])('should omit email when %s', (_desc, user) => {
    writeConfigFile({ workspaceRoot: '/some/path', user });
    const result = readUserProfileSync();
    expect(result).not.toBeNull();
    expect(result?.email).toBeUndefined();
  });
});
