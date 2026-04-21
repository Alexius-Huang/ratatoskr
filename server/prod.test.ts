// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from './index';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rat-prod-test-'));
  process.env.XDG_CONFIG_HOME = tmpDir;
  delete process.env.RATATOSKR_WORKSPACE_ROOT;
});

afterEach(async () => {
  delete process.env.XDG_CONFIG_HOME;
  delete process.env.RATATOSKR_WORKSPACE_ROOT;
  await rm(tmpDir, { recursive: true, force: true });
});

describe('prod server app', () => {
  it('should respond to /api/config when workspace unconfigured', async () => {
    const res = await app.request('/api/config');
    expect(res.status).toBe(200);
    const body = await res.json() as { configured: boolean; source: string | null };
    expect(body.configured).toBe(false);
    expect(body.source).toBeNull();
  });

  it('should reflect env-var workspace root on /api/config', async () => {
    process.env.RATATOSKR_WORKSPACE_ROOT = '/tmp/fake-ws';
    const res = await app.request('/api/config');
    expect(res.status).toBe(200);
    const body = await res.json() as { configured: boolean; source: string; workspaceRoot: string };
    expect(body.configured).toBe(true);
    expect(body.source).toBe('env');
    expect(body.workspaceRoot).toBe('/tmp/fake-ws');
  });
});

describe('GET /api/projects/:name/board-config', () => {
  async function setupProject(projectName: string, config: Record<string, unknown>) {
    const dir = path.join(tmpDir, 'projects', projectName, '.meta', 'ratatoskr');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf8');
  }

  beforeEach(() => {
    process.env.RATATOSKR_WORKSPACE_ROOT = tmpDir;
  });

  it('returns default columns when project config has no board field', async () => {
    await setupProject('myproj', { prefix: 'MYP' });
    const res = await app.request('/api/projects/myproj/board-config');
    expect(res.status).toBe(200);
    const body = await res.json() as { columns: string[] };
    expect(body.columns).toEqual(['READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']);
  });

  it('returns stored columns when board.columns is persisted', async () => {
    await setupProject('myproj', { prefix: 'MYP', board: { columns: ['READY', 'DONE'] } });
    const res = await app.request('/api/projects/myproj/board-config');
    expect(res.status).toBe(200);
    const body = await res.json() as { columns: string[] };
    expect(body.columns).toEqual(['READY', 'DONE']);
  });

  it('returns 400 when the project has no config.json', async () => {
    await mkdir(path.join(tmpDir, 'projects', 'noconfig', '.meta', 'ratatoskr'), { recursive: true });
    const res = await app.request('/api/projects/noconfig/board-config');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Project has no prefix configured');
  });
});

describe('PUT /api/projects/:name/board-config', () => {
  async function setupProject(projectName: string, config: Record<string, unknown>) {
    const dir = path.join(tmpDir, 'projects', projectName, '.meta', 'ratatoskr');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf8');
  }

  beforeEach(() => {
    process.env.RATATOSKR_WORKSPACE_ROOT = tmpDir;
  });

  it('persists a valid 5-column array and echoes it', async () => {
    await setupProject('myproj', { prefix: 'MYP' });
    const columns = ['NOT_READY', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
    const res = await app.request('/api/projects/myproj/board-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { columns: string[] };
    expect(body.columns).toEqual(columns);
  });

  it('returns 400 on malformed JSON', async () => {
    await setupProject('myproj', { prefix: 'MYP' });
    const res = await app.request('/api/projects/myproj/board-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid JSON body');
  });

  it('returns 400 on empty array', async () => {
    await setupProject('myproj', { prefix: 'MYP' });
    const res = await app.request('/api/projects/myproj/board-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('columns must be a non-empty array');
  });

  it('returns 400 on unknown state', async () => {
    await setupProject('myproj', { prefix: 'MYP' });
    const res = await app.request('/api/projects/myproj/board-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns: ['READY', 'BOGUS'] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid state: BOGUS');
  });

  it('returns 400 on duplicate state', async () => {
    await setupProject('myproj', { prefix: 'MYP' });
    const res = await app.request('/api/projects/myproj/board-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns: ['READY', 'READY'] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Duplicate state: READY');
  });

  it('round-trips: PUT then GET returns the PUT body', async () => {
    await setupProject('myproj', { prefix: 'MYP' });
    const columns = ['READY', 'WONT_DO'];
    await app.request('/api/projects/myproj/board-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns }),
    });
    const res = await app.request('/api/projects/myproj/board-config');
    expect(res.status).toBe(200);
    const body = await res.json() as { columns: string[] };
    expect(body.columns).toEqual(columns);
  });
});
