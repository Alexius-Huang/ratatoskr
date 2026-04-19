// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import matter from 'gray-matter';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  archiveTicketHandler,
  createTicketHandler,
  getTicketHandler,
  listProjectsHandler,
  listTicketsHandler,
  patchTicketHandler,
} from './mcp';

const PROJECT = 'demo';
const PREFIX = 'TST';

let tmpRoot: string;
let tasksDir: string;
let configDir: string;

async function makeTicket(
  num: number,
  overrides: Record<string, unknown> = {},
) {
  await mkdir(tasksDir, { recursive: true });
  const fm = {
    type: 'Task',
    title: `ticket ${num}`,
    state: 'NOT_READY',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  await writeFile(
    path.join(tasksDir, `${num}.md`),
    matter.stringify('', fm),
    'utf8',
  );
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'rat-mcp-test-'));
  configDir = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr');
  tasksDir = path.join(configDir, 'tasks');
  await mkdir(configDir, { recursive: true });
  await writeFile(
    path.join(configDir, 'config.json'),
    JSON.stringify({ prefix: PREFIX, name: 'Demo' }),
    'utf8',
  );
  process.env.RATATOSKR_WORKSPACE_ROOT = tmpRoot;
});

afterEach(async () => {
  delete process.env.RATATOSKR_WORKSPACE_ROOT;
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('mcp tools', () => {
  it('list_projects returns the demo project', async () => {
    const result = await listProjectsHandler();
    expect(result.isError).toBeUndefined();
    const projects = JSON.parse(result.content[0].text) as { name: string }[];
    expect(projects.some((p) => p.name === PROJECT)).toBe(true);
  });

  it('list_tickets returns the seeded ticket', async () => {
    await makeTicket(1, { title: 'seeded ticket' });
    const result = await listTicketsHandler({ project: PROJECT });
    expect(result.isError).toBeUndefined();
    const tickets = JSON.parse(result.content[0].text) as {
      number: number;
      title: string;
    }[];
    expect(tickets).toHaveLength(1);
    expect(tickets[0].title).toBe('seeded ticket');
  });

  it('get_ticket returns body and frontmatter', async () => {
    await makeTicket(1, { title: 'detail ticket' });
    const result = await getTicketHandler({ project: PROJECT, number: 1 });
    expect(result.isError).toBeUndefined();
    const ticket = JSON.parse(result.content[0].text) as {
      number: number;
      title: string;
      body: string;
    };
    expect(ticket.number).toBe(1);
    expect(ticket.title).toBe('detail ticket');
    expect(typeof ticket.body).toBe('string');
  });

  it('create_ticket produces a file and assigns the next number', async () => {
    await makeTicket(1);
    const result = await createTicketHandler({
      project: PROJECT,
      type: 'Task',
      title: 'new ticket',
      body: '## Description\n\nCreated by test.',
    });
    expect(result.isError).toBeUndefined();
    const created = JSON.parse(result.content[0].text) as {
      number: number;
      title: string;
    };
    expect(created.number).toBe(2);
    expect(created.title).toBe('new ticket');
    const file = await readFile(path.join(tasksDir, '2.md'), 'utf8');
    expect(file).toContain('new ticket');
  });

  it('patch_ticket updates state and bumps updated', async () => {
    await makeTicket(1);
    const before = await getTicketHandler({ project: PROJECT, number: 1 });
    const beforeData = JSON.parse(before.content[0].text) as { updated: string };

    const result = await patchTicketHandler({
      project: PROJECT,
      number: 1,
      state: 'IN_PROGRESS',
    });
    expect(result.isError).toBeUndefined();
    const patched = JSON.parse(result.content[0].text) as {
      state: string;
      updated: string;
    };
    expect(patched.state).toBe('IN_PROGRESS');
    expect(patched.updated).not.toBe(beforeData.updated);
  });

  it('archive_ticket moves ticket out of active list', async () => {
    await makeTicket(1, { state: 'DONE' });
    const result = await archiveTicketHandler({ project: PROJECT, number: 1 });
    expect(result.isError).toBeUndefined();
    // After archiving, active list should be empty
    const list = await listTicketsHandler({ project: PROJECT });
    const tickets = JSON.parse(list.content[0].text) as unknown[];
    expect(tickets).toHaveLength(0);
  });

  it('errors surface isError true with the error body', async () => {
    // get_ticket on a non-existent ticket should 404
    const result = await getTicketHandler({ project: PROJECT, number: 999 });
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text) as { error: string };
    expect(body.error).toBeDefined();
  });

  it('patch_ticket sets the branch field', async () => {
    await makeTicket(1);
    const result = await patchTicketHandler({
      project: PROJECT,
      number: 1,
      branch: 'rat-74-mcp-branch-pr',
    });
    expect(result.isError).toBeUndefined();
    const patched = JSON.parse(result.content[0].text) as { branch?: string };
    expect(patched.branch).toBe('rat-74-mcp-branch-pr');
  });

  it('patch_ticket appends a pr to the prs array', async () => {
    await makeTicket(1);
    const result = await patchTicketHandler({
      project: PROJECT,
      number: 1,
      pr: 'owner/repo/pull/42',
    });
    expect(result.isError).toBeUndefined();
    const patched = JSON.parse(result.content[0].text) as { prs?: string[] };
    expect(patched.prs).toEqual(['owner/repo/pull/42']);
  });

  it('get_ticket returns branch and prs when present', async () => {
    await makeTicket(1, {
      branch: 'feature/x',
      prs: ['owner/repo/pull/7'],
    });
    const result = await getTicketHandler({ project: PROJECT, number: 1 });
    expect(result.isError).toBeUndefined();
    const ticket = JSON.parse(result.content[0].text) as {
      branch?: string;
      prs?: string[];
    };
    expect(ticket.branch).toBe('feature/x');
    expect(ticket.prs).toEqual(['owner/repo/pull/7']);
  });
});
