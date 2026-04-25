// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from './index';
import type { Comment } from './types';

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

  it.each([
    ['malformed JSON', 'not-json', 'Invalid JSON body'],
    ['empty array', JSON.stringify({ columns: [] }), 'columns must be a non-empty array'],
    ['unknown state', JSON.stringify({ columns: ['READY', 'BOGUS'] }), 'Invalid state: BOGUS'],
    ['duplicate state', JSON.stringify({ columns: ['READY', 'READY'] }), 'Duplicate state: READY'],
  ])('returns 400 on %s', async (_desc, requestBody, expectedError) => {
    await setupProject('myproj', { prefix: 'MYP' });
    const res = await app.request('/api/projects/myproj/board-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe(expectedError);
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

// ---------------------------------------------------------------------------

describe('GET /api/projects/:name/tickets/:number/comments', () => {
  async function setupProject(projectName: string, config: Record<string, unknown> = { prefix: 'TST' }) {
    const dir = path.join(tmpDir, 'projects', projectName, '.meta', 'ratatoskr');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'config.json'), JSON.stringify(config) + '\n', 'utf8');
  }

  async function seedComment(projectName: string, ticketNumber: number, n: number, overrides: Record<string, string> = {}) {
    const dir = path.join(tmpDir, 'projects', projectName, '.meta', 'ratatoskr', 'comments', String(ticketNumber));
    await mkdir(dir, { recursive: true });
    const fm = {
      author: 'j.huang',
      display_name: 'James Huang',
      timestamp: '2026-04-19T12:00:00.000Z',
      ...overrides,
    };
    const content = `---\nauthor: ${fm.author}\ndisplay_name: ${fm.display_name}\ntimestamp: ${fm.timestamp}\n---\nComment body ${n}.\n`;
    await writeFile(path.join(dir, `${n}.md`), content, 'utf8');
  }

  beforeEach(() => {
    process.env.RATATOSKR_WORKSPACE_ROOT = tmpDir;
  });

  it('should return [] when the comments folder is missing', async () => {
    await setupProject('myproj');
    const res = await app.request('/api/projects/myproj/tickets/1/comments');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('should return parsed comments sorted by n ascending', async () => {
    await setupProject('myproj');
    await seedComment('myproj', 1, 2);
    await seedComment('myproj', 1, 1);
    const res = await app.request('/api/projects/myproj/tickets/1/comments');
    expect(res.status).toBe(200);
    const body = await res.json() as Comment[];
    expect(body.map((c) => c.n)).toEqual([1, 2]);
    expect(body[0].author).toBe('j.huang');
    expect(body[0].body).toBe('Comment body 1.');
  });

  it('should return [] for a ticket that does not exist (no parent-ticket check on read)', async () => {
    await setupProject('myproj');
    const res = await app.request('/api/projects/myproj/tickets/99999/comments');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('should return 400 when the project has no config.json', async () => {
    await mkdir(path.join(tmpDir, 'projects', 'noconfig', '.meta', 'ratatoskr'), { recursive: true });
    const res = await app.request('/api/projects/noconfig/tickets/1/comments');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Project has no prefix configured');
  });

  it('should return 400 when the ticket number is invalid', async () => {
    await setupProject('myproj');
    const res = await app.request('/api/projects/myproj/tickets/abc/comments');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid ticket number');
  });
});

// ---------------------------------------------------------------------------

describe('POST /api/projects/:name/tickets/:number/comments', () => {
  const PROJECT = 'myproj';
  const TICKET = 12;

  async function setupProject(projectName = PROJECT, config: Record<string, unknown> = { prefix: 'TST' }) {
    const dir = path.join(tmpDir, 'projects', projectName, '.meta', 'ratatoskr');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'config.json'), JSON.stringify(config) + '\n', 'utf8');
  }

  async function setupTicket(projectName = PROJECT, ticketNumber = TICKET) {
    const dir = path.join(tmpDir, 'projects', projectName, '.meta', 'ratatoskr', 'tasks');
    await mkdir(dir, { recursive: true });
    const content = `---\ntype: Task\ntitle: Test ticket\nstate: NOT_READY\ncreated: 2026-01-01T00:00:00.000Z\nupdated: 2026-01-01T00:00:00.000Z\n---\n`;
    await writeFile(path.join(dir, `${ticketNumber}.md`), content, 'utf8');
  }

  async function setupAppUser(user: Record<string, unknown>) {
    const dir = path.join(tmpDir, 'ratatoskr');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'config.json'), JSON.stringify({ workspaceRoot: tmpDir, user }) + '\n', 'utf8');
  }

  function postComment(body: unknown) {
    return app.request(`/api/projects/${PROJECT}/tickets/${TICKET}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeEach(async () => {
    process.env.RATATOSKR_WORKSPACE_ROOT = tmpDir;
    await setupProject();
    await setupTicket();
  });

  it('should create a comment with explicit author and return 201', async () => {
    const res = await postComment({ body: 'Hello world.', author: { username: 'claude', display_name: 'Claude' } });
    expect(res.status).toBe(201);
    const body = await res.json() as Comment;
    expect(body.n).toBe(1);
    expect(body.author).toBe('claude');
    expect(body.displayName).toBe('Claude');
    expect(body.body).toBe('Hello world.');
    expect(typeof body.timestamp).toBe('string');
  });

  it('should fall back to root config user when author is omitted', async () => {
    await setupAppUser({ username: 'j.huang', display_name: 'James Huang' });
    const res = await postComment({ body: 'Fallback comment.' });
    expect(res.status).toBe(201);
    const body = await res.json() as Comment;
    expect(body.author).toBe('j.huang');
    expect(body.displayName).toBe('James Huang');
  });

  it('should round-trip via GET (POST then GET returns the new comment)', async () => {
    await postComment({ body: 'Round trip.', author: { username: 'a', display_name: 'A' } });
    const res = await app.request(`/api/projects/${PROJECT}/tickets/${TICKET}/comments`);
    expect(res.status).toBe(200);
    const comments = await res.json() as Comment[];
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe('Round trip.');
  });

  it.each([
    ['empty body string', { body: '', author: { username: 'a', display_name: 'A' } }, 'body must be a non-empty string'],
    ['missing body field', { author: { username: 'a', display_name: 'A' } }, 'body must be a non-empty string'],
    ['body is not a string', { body: 42, author: { username: 'a', display_name: 'A' } }, 'body must be a non-empty string'],
    ['empty author.username', { body: 'hi', author: { username: '', display_name: 'A' } }, 'author.username must be a non-empty string'],
    ['empty author.display_name', { body: 'hi', author: { username: 'a', display_name: '' } }, 'author.display_name must be a non-empty string'],
    ['no author and no config user', { body: 'hi' }, 'No author provided and no default user configured'],
  ])('should return 400 on %s', async (_desc, payload, expectedError) => {
    const res = await postComment(payload);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe(expectedError);
  });

  it('should return 400 on malformed JSON body', async () => {
    const res = await app.request(`/api/projects/${PROJECT}/tickets/${TICKET}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid JSON body');
  });

  it('should return 404 when the parent ticket file does not exist', async () => {
    const res = await app.request(`/api/projects/${PROJECT}/tickets/99999/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'hi', author: { username: 'a', display_name: 'A' } }),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/not found/);
  });

  it('should return 404 when the ticket exists only in archive/', async () => {
    const archiveDir = path.join(tmpDir, 'projects', PROJECT, '.meta', 'ratatoskr', 'archive');
    await mkdir(archiveDir, { recursive: true });
    await writeFile(
      path.join(archiveDir, '99.md'),
      `---\ntype: Task\ntitle: Archived\nstate: DONE\ncreated: 2026-01-01T00:00:00.000Z\nupdated: 2026-01-01T00:00:00.000Z\n---\n`,
      'utf8',
    );
    const res = await app.request(`/api/projects/${PROJECT}/tickets/99/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'hi', author: { username: 'a', display_name: 'A' } }),
    });
    expect(res.status).toBe(404);
  });

  it('should ignore timestamp in request body (server sets it)', async () => {
    const before = Date.now();
    const res = await postComment({
      body: 'Timestamp test.',
      author: { username: 'a', display_name: 'A' },
      timestamp: '2020-01-01T00:00:00.000Z',
    });
    const after = Date.now();
    expect(res.status).toBe(201);
    const getRes = await app.request(`/api/projects/${PROJECT}/tickets/${TICKET}/comments`);
    const comments = await getRes.json() as Comment[];
    const ts = new Date(comments[0].timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 5000);
    expect(ts).toBeLessThanOrEqual(after + 5000);
  });
});
