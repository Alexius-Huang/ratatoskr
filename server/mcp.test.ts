// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import matter from 'gray-matter';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  archiveTicketHandler,
  createTicketHandler,
  getTicketByIdHandler,
  getTicketHandler,
  listProjectsHandler,
  listTicketsHandler,
  patchTicketHandler,
  shipTicketPrHandler,
} from './mcp';
import { _runner } from './github';
import type { GhPrCreateResult } from './github';

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

  it('list_tickets filters by epic when epic param is provided', async () => {
    await makeTicket(10, { type: 'Epic', title: 'epic ticket' });
    await makeTicket(1, { epic: 10, title: 'task in epic 10' });
    await makeTicket(2, { epic: 20, title: 'task in epic 20' });
    const result = await listTicketsHandler({ project: PROJECT, epic: 10 });
    expect(result.isError).toBeUndefined();
    const tickets = JSON.parse(result.content[0].text) as { number: number; title: string }[];
    expect(tickets).toHaveLength(1);
    expect(tickets[0].title).toBe('task in epic 10');
  });

  it('list_tickets returns all tickets when epic param is omitted', async () => {
    await makeTicket(10, { type: 'Epic', title: 'epic ticket' });
    await makeTicket(1, { epic: 10, title: 'task in epic 10' });
    await makeTicket(2, { epic: 20, title: 'task in epic 20' });
    const result = await listTicketsHandler({ project: PROJECT });
    expect(result.isError).toBeUndefined();
    const tickets = JSON.parse(result.content[0].text) as { number: number }[];
    expect(tickets).toHaveLength(3);
  });

  it('list_tickets combines type and epic filters', async () => {
    await makeTicket(10, { type: 'Epic', title: 'parent epic' });
    await makeTicket(1, { epic: 10, type: 'Task', title: 'task in epic' });
    await makeTicket(2, { epic: 10, type: 'Bug', title: 'bug in epic' });
    const result = await listTicketsHandler({ project: PROJECT, type: 'Task', epic: 10 });
    expect(result.isError).toBeUndefined();
    const tickets = JSON.parse(result.content[0].text) as { number: number; type: string }[];
    expect(tickets).toHaveLength(1);
    expect(tickets[0].type).toBe('Task');
  });

  it('list_tickets with unknown epic returns empty array', async () => {
    await makeTicket(1, { epic: 5, title: 'task in epic 5' });
    const result = await listTicketsHandler({ project: PROJECT, epic: 999 });
    expect(result.isError).toBeUndefined();
    const tickets = JSON.parse(result.content[0].text) as unknown[];
    expect(tickets).toHaveLength(0);
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

  it('get_ticket_by_id resolves a ticket from its display ID', async () => {
    await makeTicket(1, { title: 'by-id ticket' });
    const result = await getTicketByIdHandler({ displayId: `${PREFIX}-1` });
    expect(result.isError).toBeUndefined();
    const ticket = JSON.parse(result.content[0].text) as {
      number: number;
      displayId: string;
      project: string;
      title: string;
      body: string;
    };
    expect(ticket.number).toBe(1);
    expect(ticket.displayId).toBe(`${PREFIX}-1`);
    expect(ticket.project).toBe(PROJECT);
    expect(ticket.title).toBe('by-id ticket');
    expect(typeof ticket.body).toBe('string');
  });

  it('get_ticket_by_id is case-insensitive on the prefix', async () => {
    await makeTicket(1, { title: 'case-insensitive ticket' });
    const result = await getTicketByIdHandler({ displayId: `${PREFIX.toLowerCase()}-1` });
    expect(result.isError).toBeUndefined();
    const ticket = JSON.parse(result.content[0].text) as { project: string };
    expect(ticket.project).toBe(PROJECT);
  });

  it('get_ticket_by_id errors on malformed displayId', async () => {
    const result = await getTicketByIdHandler({ displayId: 'not-a-ticket' });
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text) as { error: string };
    expect(body.error).toMatch(/Invalid displayId/);
  });

  it('get_ticket_by_id errors when no project owns the prefix', async () => {
    const result = await getTicketByIdHandler({ displayId: 'ZZZ-1' });
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text) as { error: string };
    expect(body.error).toMatch(/No project found for prefix 'ZZZ'/);
  });

  it('get_ticket_by_id errors when the ticket does not exist', async () => {
    const result = await getTicketByIdHandler({ displayId: `${PREFIX}-999` });
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text) as { error: string };
    expect(body.error).toMatch(/Ticket TST-999 not found/);
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

  it('patch_ticket forwards resolution field and persists it', async () => {
    await makeTicket(1, { state: 'IN_PROGRESS' });
    const result = await patchTicketHandler({
      project: PROJECT,
      number: 1,
      state: 'IN_REVIEW',
      resolution: 'VIBED',
    });
    expect(result.isError).toBeUndefined();
    const patched = JSON.parse(result.content[0].text) as { resolution?: string };
    expect(patched.resolution).toBe('VIBED');
  });
});

describe('ship_ticket_pr', () => {
  const HAPPY_URL = 'https://github.com/owner/repo/pull/42';
  const HAPPY_RESULT: GhPrCreateResult = { kind: 'created', url: HAPPY_URL };

  let origCreate: typeof _runner.runGhPrCreate;
  let origList: typeof _runner.runGhPrList;
  let origBranch: typeof _runner.getCurrentBranch;

  beforeEach(() => {
    origCreate = _runner.runGhPrCreate;
    origList = _runner.runGhPrList;
    origBranch = _runner.getCurrentBranch;
    // Default stubs — happy path
    _runner.runGhPrCreate = async () => HAPPY_RESULT;
    _runner.runGhPrList = async () => null;
    _runner.getCurrentBranch = async () => 'feature/default';
    // Outer beforeEach already sets up tmpRoot, configDir, tasksDir, config.json, and
    // RATATOSKR_WORKSPACE_ROOT — no duplication needed here.
  });

  afterEach(() => {
    _runner.runGhPrCreate = origCreate;
    _runner.runGhPrList = origList;
    _runner.getCurrentBranch = origBranch;
    // Outer afterEach handles tmpRoot cleanup and env var removal.
  });

  it('should open PR and transition ticket atomically on happy path', async () => {
    await makeTicket(1, { state: 'IN_PROGRESS' });
    const result = await shipTicketPrHandler({
      project: PROJECT,
      number: 1,
      title: 'feat: my feature',
      body: 'Closes RAT-1.',
      resolution: 'PLANNED',
    });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text) as {
      pr_path: string;
      pr_url: string;
      pr_number: number;
      ticket: { state: string; prs: string[]; resolution: string };
    };
    expect(data.pr_path).toBe('owner/repo/pull/42');
    expect(data.pr_url).toBe(HAPPY_URL);
    expect(data.pr_number).toBe(42);
    expect(data.ticket.state).toBe('IN_REVIEW');
    expect(data.ticket.prs).toContain('owner/repo/pull/42');
    expect(data.ticket.resolution).toBe('PLANNED');
  });

  it('should default resolution to MANUAL when resolution is omitted', async () => {
    await makeTicket(1, { state: 'IN_PROGRESS' });
    const result = await shipTicketPrHandler({
      project: PROJECT,
      number: 1,
      title: 'feat: my feature',
      body: 'Closes RAT-1.',
    });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text) as { ticket: { resolution: string } };
    expect(data.ticket.resolution).toBe('MANUAL');
  });

  it('should forward merge_branch to gh pr create', async () => {
    await makeTicket(1, { state: 'IN_PROGRESS' });
    let capturedArgs: Parameters<typeof _runner.runGhPrCreate>[0] | undefined;
    _runner.runGhPrCreate = async (args) => {
      capturedArgs = args;
      return HAPPY_RESULT;
    };
    await shipTicketPrHandler({
      project: PROJECT,
      number: 1,
      title: 'feat: my feature',
      body: '',
      merge_branch: 'release/v2',
    });
    expect(capturedArgs?.mergeBranch).toBe('release/v2');
  });

  it('should fall back to existing PR on "already exists"', async () => {
    await makeTicket(1, { state: 'IN_PROGRESS' });
    _runner.runGhPrCreate = async () => ({ kind: 'already-exists' });
    _runner.getCurrentBranch = async () => 'feature/x';
    _runner.runGhPrList = async () => ({ url: 'https://github.com/owner/repo/pull/9' });
    const result = await shipTicketPrHandler({
      project: PROJECT,
      number: 1,
      title: 'feat: my feature',
      body: '',
    });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text) as {
      pr_number: number;
      ticket: { state: string };
    };
    expect(data.pr_number).toBe(9);
    expect(data.ticket.state).toBe('IN_REVIEW');
  });

  it('should return isError when gh pr create fails and leave ticket unchanged', async () => {
    await makeTicket(1, { state: 'IN_PROGRESS' });
    _runner.runGhPrCreate = async () => ({
      kind: 'error',
      stdout: '',
      stderr: 'auth failed',
    });
    const result = await shipTicketPrHandler({
      project: PROJECT,
      number: 1,
      title: 'feat: my feature',
      body: '',
    });
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text) as { error: string };
    expect(body.error).toMatch(/auth failed/);
    // Ticket must be unchanged — still IN_PROGRESS, no prs
    const ticket = await getTicketHandler({ project: PROJECT, number: 1 });
    const td = JSON.parse(ticket.content[0].text) as { state: string; prs?: string[] };
    expect(td.state).toBe('IN_PROGRESS');
    expect(td.prs).toBeUndefined();
  });

  it('should return partial-failure shape when PR opens but ticket PATCH fails', async () => {
    // Ticket number 999 does not exist — PATCH will fail
    const result = await shipTicketPrHandler({
      project: PROJECT,
      number: 999,
      title: 'feat: my feature',
      body: '',
      resolution: 'PLANNED',
    });
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text) as {
      error: string;
      pr_path: string;
      pr_url: string;
      pr_number: number;
      ticket_error: string;
    };
    expect(body.error).toBe('PR created but ticket PATCH failed');
    expect(body.pr_path).toBe('owner/repo/pull/42');
    expect(body.pr_url).toBe(HAPPY_URL);
    expect(body.pr_number).toBe(42);
    expect(body.ticket_error).toMatch(/not found/i);
  });

  it('should reject and skip gh pr create when project has no prefix config', async () => {
    // Remove config.json to simulate missing prefix
    await rm(path.join(configDir, 'config.json'));
    let createCalled = false;
    _runner.runGhPrCreate = async () => {
      createCalled = true;
      return HAPPY_RESULT;
    };
    const result = await shipTicketPrHandler({
      project: PROJECT,
      number: 1,
      title: 'feat: my feature',
      body: '',
    });
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text) as { error: string };
    expect(body.error).toMatch(/config\.prefix/);
    expect(createCalled).toBe(false);
  });
});
