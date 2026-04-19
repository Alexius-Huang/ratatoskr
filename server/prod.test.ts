// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
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
