// @vitest-environment node
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_COLUMNS, readBoardConfig, validateBoardColumns, writeBoardConfig } from './boardConfig';
import type { TicketState } from './types';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rat-board-config-test-'));
  process.env.RATATOSKR_WORKSPACE_ROOT = tmpDir;
});

afterEach(async () => {
  delete process.env.RATATOSKR_WORKSPACE_ROOT;
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeProjectConfig(projectName: string, config: Record<string, unknown>) {
  const dir = path.join(tmpDir, 'projects', projectName, '.meta', 'ratatoskr');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf8');
}

describe('validateBoardColumns', () => {
  it('accepts the default 4-column list', () => {
    const result = validateBoardColumns(['READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.columns).toEqual(['READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']);
  });

  it('accepts a 7-column list covering every state', () => {
    const all = ['NOT_READY', 'PLANNING', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'WONT_DO'];
    const result = validateBoardColumns(all);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.columns).toEqual(all);
  });

  it('rejects null', () => {
    const result = validateBoardColumns(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('columns must be a non-empty array');
  });

  it('rejects non-array', () => {
    const result = validateBoardColumns('READY');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('columns must be a non-empty array');
  });

  it('rejects empty array', () => {
    const result = validateBoardColumns([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('columns must be a non-empty array');
  });

  it('rejects an array containing an unknown state', () => {
    const result = validateBoardColumns(['READY', 'FOO']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Invalid state: FOO');
  });

  it('rejects duplicates', () => {
    const result = validateBoardColumns(['READY', 'READY']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Duplicate state: READY');
  });

  it('preserves order', () => {
    const input = ['DONE', 'READY', 'IN_PROGRESS'];
    const result = validateBoardColumns(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.columns).toEqual(input);
  });
});

describe('readBoardConfig', () => {
  it('returns the default when config.json is missing entirely', async () => {
    await mkdir(path.join(tmpDir, 'projects', 'myproj', '.meta', 'ratatoskr'), { recursive: true });
    const columns = await readBoardConfig('myproj');
    expect(columns).toEqual(DEFAULT_BOARD_COLUMNS);
  });

  it('returns the default when config.json exists but has no board key', async () => {
    await writeProjectConfig('myproj', { prefix: 'MYP' });
    const columns = await readBoardConfig('myproj');
    expect(columns).toEqual(DEFAULT_BOARD_COLUMNS);
  });

  it('returns the default when config.json has board.columns that fail validation', async () => {
    await writeProjectConfig('myproj', { prefix: 'MYP', board: { columns: ['BOGUS'] } });
    const columns = await readBoardConfig('myproj');
    expect(columns).toEqual(DEFAULT_BOARD_COLUMNS);
  });

  it('returns the stored array when config.json has a valid board.columns', async () => {
    const stored = ['READY', 'DONE'];
    await writeProjectConfig('myproj', { prefix: 'MYP', board: { columns: stored } });
    const columns = await readBoardConfig('myproj');
    expect(columns).toEqual(stored);
  });
});

describe('writeBoardConfig', () => {
  it('writes the columns array to config.json under board.columns', async () => {
    await writeProjectConfig('myproj', { prefix: 'MYP' });
    await writeBoardConfig('myproj', ['READY', 'IN_PROGRESS', 'DONE'] as TicketState[]);
    const columns = await readBoardConfig('myproj');
    expect(columns).toEqual(['READY', 'IN_PROGRESS', 'DONE']);
  });

  it('preserves prefix, name, and arbitrary unknown keys', async () => {
    await writeProjectConfig('myproj', { prefix: 'MYP', name: 'My Project', custom_key: 'keep me' });
    await writeBoardConfig('myproj', ['READY', 'DONE'] as TicketState[]);

    const configPath = path.join(tmpDir, 'projects', 'myproj', '.meta', 'ratatoskr', 'config.json');
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.prefix).toBe('MYP');
    expect(parsed.name).toBe('My Project');
    expect(parsed.custom_key).toBe('keep me');
    expect(parsed.board.columns).toEqual(['READY', 'DONE']);
  });

  it('round-trips: read after write returns exactly what was written', async () => {
    await writeProjectConfig('myproj', { prefix: 'MYP' });
    const written: TicketState[] = ['IN_PROGRESS', 'IN_REVIEW', 'DONE'];
    await writeBoardConfig('myproj', written);
    const columns = await readBoardConfig('myproj');
    expect(columns).toEqual(written);
  });

  it('completes without throwing when called with a valid columns array', async () => {
    await writeProjectConfig('myproj', { prefix: 'MYP' });
    await expect(writeBoardConfig('myproj', ['READY', 'DONE'] as TicketState[])).resolves.toEqual(['READY', 'DONE']);
  });
});
