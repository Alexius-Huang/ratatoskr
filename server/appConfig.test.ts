import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAppConfigPath, readAppConfigSync, writeAppConfig } from './appConfig';

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
