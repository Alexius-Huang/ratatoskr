import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _gh,
  getWorkspaceRoot,
  listArchivedTickets,
  listTickets,
  parseTicketFileRaw,
  readProjectConfig,
  readTicketDetail,
  readTicketPlan,
} from './fs';
import type { PullRequestInfo } from './types';

const PROJECT = 'ratatoskr';
const PREFIX = 'RAT';

let tmpRoot: string;
let tasksDirPath: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'rat-fs-test-'));
  process.env.RATATOSKR_WORKSPACE_ROOT = tmpRoot;
  tasksDirPath = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr', 'tasks');
});

afterEach(async () => {
  delete process.env.RATATOSKR_WORKSPACE_ROOT;
  await rm(tmpRoot, { recursive: true, force: true });
});

async function makeTicketFile(
  dir: string,
  num: number,
  overrides: Record<string, unknown> = {},
) {
  await mkdir(dir, { recursive: true });
  const fm = {
    type: 'Task',
    title: `ticket ${num}`,
    state: 'NOT_READY',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  const content = matter.stringify('', fm);
  await writeFile(path.join(dir, `${num}.md`), content, 'utf8');
}

async function makeRawFile(dir: string, num: number, rawYaml: string) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${num}.md`), `---\n${rawYaml}\n---\n`, 'utf8');
}

// ---------------------------------------------------------------------------

describe('parseTicketFileRaw', () => {
  it('should return null for invalid type', async () => {
    await makeRawFile(tasksDirPath, 1, 'type: Foo\ntitle: X\nstate: NOT_READY\ncreated: "2026-01-01T00:00:00.000Z"\nupdated: "2026-01-01T00:00:00.000Z"');
    const filePath = path.join(tasksDirPath, '1.md');
    const result = await parseTicketFileRaw(filePath, 1, PREFIX);
    expect(result).toBeNull();
  });

  it('should return null for invalid state', async () => {
    await makeRawFile(tasksDirPath, 1, 'type: Task\ntitle: X\nstate: BOGUS\ncreated: "2026-01-01T00:00:00.000Z"\nupdated: "2026-01-01T00:00:00.000Z"');
    const filePath = path.join(tasksDirPath, '1.md');
    const result = await parseTicketFileRaw(filePath, 1, PREFIX);
    expect(result).toBeNull();
  });

  it('should coerce Date-typed timestamps to ISO strings', async () => {
    // gray-matter parses unquoted YYYY-MM-DD as a JS Date object
    await makeRawFile(tasksDirPath, 1, 'type: Task\ntitle: X\nstate: NOT_READY\ncreated: 2026-01-15\nupdated: 2026-01-15');
    const filePath = path.join(tasksDirPath, '1.md');
    const result = await parseTicketFileRaw(filePath, 1, PREFIX);
    expect(result).not.toBeNull();
    expect(typeof result?.summary.created).toBe('string');
    expect(result?.summary.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof result?.summary.updated).toBe('string');
  });

  it('should return null for missing title', async () => {
    await makeRawFile(tasksDirPath, 1, 'type: Task\nstate: NOT_READY\ncreated: "2026-01-01T00:00:00.000Z"\nupdated: "2026-01-01T00:00:00.000Z"');
    const filePath = path.join(tasksDirPath, '1.md');
    const result = await parseTicketFileRaw(filePath, 1, PREFIX);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('listTickets', () => {
  it('should include child-count rollup on Epics', async () => {
    await makeTicketFile(tasksDirPath, 1, { type: 'Epic', title: 'My Epic' });
    await makeTicketFile(tasksDirPath, 2, { type: 'Task', epic: 1, state: 'NOT_READY' });
    await makeTicketFile(tasksDirPath, 3, { type: 'Task', epic: 1, state: 'DONE' });

    const tickets = await listTickets(PROJECT, PREFIX);
    const epic = tickets.find((t) => t.number === 1);
    expect(epic?.childCounts?.total).toBe(2);
    expect(epic?.childCounts?.byState.DONE).toBe(1);
    expect(epic?.childCounts?.byState.NOT_READY).toBe(1);
  });

  it('should resolve epicTitle on tasks', async () => {
    await makeTicketFile(tasksDirPath, 1, { type: 'Epic', title: 'The Epic' });
    await makeTicketFile(tasksDirPath, 2, { type: 'Task', epic: 1 });

    const tickets = await listTickets(PROJECT, PREFIX);
    const task = tickets.find((t) => t.number === 2);
    expect(task?.epicTitle).toBe('The Epic');
  });

  it('should include archived tickets in epic child counts', async () => {
    const archiveDirPath = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr', 'archive');
    await makeTicketFile(tasksDirPath, 1, { type: 'Epic', title: 'My Epic' });
    await makeTicketFile(tasksDirPath, 2, { type: 'Task', epic: 1, state: 'DONE' });
    // ticket 3 in archive — not returned by listTickets itself but counts toward epic totals
    await makeTicketFile(archiveDirPath, 3, { type: 'Task', epic: 1, state: 'DONE', archived: '2026-01-02T00:00:00.000Z' });

    const tickets = await listTickets(PROJECT, PREFIX);
    expect(tickets.find((t) => t.number === 3)).toBeUndefined();
    const epic = tickets.find((t) => t.number === 1);
    expect(epic?.childCounts?.total).toBe(2);
    expect(epic?.childCounts?.byState.DONE).toBe(2);
  });
});

// ---------------------------------------------------------------------------

describe('readProjectConfig', () => {
  it('should return null config when config.json missing', async () => {
    const result = await readProjectConfig(PROJECT);
    expect(result.config).toBeNull();
    expect(result.hasConfig).toBe(false);
  });

  it('should return null config when prefix field absent', async () => {
    const configDir = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr');
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, 'config.json'), JSON.stringify({}), 'utf8');
    const result = await readProjectConfig(PROJECT);
    expect(result.config).toBeNull();
    expect(result.hasConfig).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('readTicketPlan', () => {
  it('should return out-of-scope error when plan path traverses above metaRoot', async () => {
    await makeTicketFile(tasksDirPath, 1, {
      plan_doc: '../../../etc/passwd',
      state: 'READY',
    });
    const result = await readTicketPlan(PROJECT, 1, PREFIX);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('out-of-scope');
  });
});

// ---------------------------------------------------------------------------

describe('getWorkspaceRoot', () => {
  let xdgTmpDir: string;

  beforeEach(async () => {
    xdgTmpDir = await mkdtemp(path.join(os.tmpdir(), 'rat-ws-root-test-'));
    // ensure XDG_CONFIG_HOME points to a clean tmp dir (no real config leaks in)
    process.env.XDG_CONFIG_HOME = xdgTmpDir;
  });

  afterEach(async () => {
    delete process.env.XDG_CONFIG_HOME;
    await rm(xdgTmpDir, { recursive: true, force: true });
  });

  it('should return env var value when RATATOSKR_WORKSPACE_ROOT is set', () => {
    // env var is already set in outer beforeEach (tmpRoot)
    expect(getWorkspaceRoot()).toBe(tmpRoot);
  });

  it('should return config file value when env var is absent', () => {
    const savedEnv = process.env.RATATOSKR_WORKSPACE_ROOT;
    delete process.env.RATATOSKR_WORKSPACE_ROOT;
    try {
      const configDir = path.join(xdgTmpDir, 'ratatoskr');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ workspaceRoot: '/from/config' }), 'utf8');
      expect(getWorkspaceRoot()).toBe('/from/config');
    } finally {
      process.env.RATATOSKR_WORKSPACE_ROOT = savedEnv;
    }
  });

  it('should return null when both env var and config file are absent', () => {
    const savedEnv = process.env.RATATOSKR_WORKSPACE_ROOT;
    delete process.env.RATATOSKR_WORKSPACE_ROOT;
    try {
      expect(getWorkspaceRoot()).toBeNull();
    } finally {
      process.env.RATATOSKR_WORKSPACE_ROOT = savedEnv;
    }
  });
});

// ---------------------------------------------------------------------------

describe('parseTicketFileRaw — color field', () => {
  it('should extract color from an Epic with a valid hex color', async () => {
    await makeTicketFile(tasksDirPath, 1, { type: 'Epic', title: 'E', color: '#BF616A' });
    const filePath = path.join(tasksDirPath, '1.md');
    const result = await parseTicketFileRaw(filePath, 1, PREFIX);
    expect(result?.summary.color).toBe('#BF616A');
  });

  it('should ignore color on a Task (only Epics may carry color)', async () => {
    await makeTicketFile(tasksDirPath, 1, { type: 'Task', title: 'T', color: '#BF616A' });
    const filePath = path.join(tasksDirPath, '1.md');
    const result = await parseTicketFileRaw(filePath, 1, PREFIX);
    expect(result?.summary.color).toBeUndefined();
  });

  it('should ignore an invalid hex color on an Epic', async () => {
    await makeTicketFile(tasksDirPath, 1, { type: 'Epic', title: 'E', color: 'purple' });
    const filePath = path.join(tasksDirPath, '1.md');
    const result = await parseTicketFileRaw(filePath, 1, PREFIX);
    expect(result?.summary.color).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('listTickets — epicColor propagation', () => {
  it('should propagate the parent Epic color to child task epicColor', async () => {
    await makeTicketFile(tasksDirPath, 1, { type: 'Epic', title: 'E', color: '#A3BE8C' });
    await makeTicketFile(tasksDirPath, 2, { type: 'Task', title: 'T', epic: 1 });

    const tickets = await listTickets(PROJECT, PREFIX);
    const task = tickets.find((t) => t.number === 2);
    expect(task?.epicColor).toBe('#A3BE8C');
  });

  it('should leave epicColor undefined when parent Epic has no color', async () => {
    await makeTicketFile(tasksDirPath, 1, { type: 'Epic', title: 'E' });
    await makeTicketFile(tasksDirPath, 2, { type: 'Task', title: 'T', epic: 1 });

    const tickets = await listTickets(PROJECT, PREFIX);
    const task = tickets.find((t) => t.number === 2);
    expect(task?.epicColor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('readTicketDetail — epicColor propagation', () => {
  it('should populate epicColor when parent Epic has a color', async () => {
    await makeTicketFile(tasksDirPath, 1, { type: 'Epic', title: 'E', color: '#88C0D0' });
    await makeTicketFile(tasksDirPath, 2, { type: 'Task', title: 'T', epic: 1 });

    const detail = await readTicketDetail(PROJECT, 2, PREFIX);
    expect(detail?.epicColor).toBe('#88C0D0');
  });

  it('should leave epicColor undefined when parent Epic has no color', async () => {
    await makeTicketFile(tasksDirPath, 1, { type: 'Epic', title: 'E' });
    await makeTicketFile(tasksDirPath, 2, { type: 'Task', title: 'T', epic: 1 });

    const detail = await readTicketDetail(PROJECT, 2, PREFIX);
    expect(detail?.epicColor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

async function makeConfigFile(overrides: Record<string, unknown> = {}) {
  const { mkdir: mkdirFs } = await import('node:fs/promises');
  const configDir = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr');
  await mkdirFs(configDir, { recursive: true });
  const config = { prefix: PREFIX, name: PROJECT, ...overrides };
  await writeFile(path.join(configDir, 'config.json'), JSON.stringify(config), 'utf8');
}

describe('parseTicketFileRaw — branch and prs fields', () => {
  it('should extract branch when present', async () => {
    await makeTicketFile(tasksDirPath, 1, { branch: 'feat/my-branch' });
    const result = await parseTicketFileRaw(path.join(tasksDirPath, '1.md'), 1, PREFIX);
    expect(result?.summary.branch).toBe('feat/my-branch');
  });

  it('should extract prs array when present', async () => {
    await makeTicketFile(tasksDirPath, 1, { prs: ['owner/repo/pull/5', 'owner/repo/pull/6'] });
    const result = await parseTicketFileRaw(path.join(tasksDirPath, '1.md'), 1, PREFIX);
    expect(result?.summary.prs).toEqual(['owner/repo/pull/5', 'owner/repo/pull/6']);
  });

  it('should ignore non-string entries in prs', async () => {
    await makeTicketFile(tasksDirPath, 1, { prs: ['owner/repo/pull/1', 42, null, ''] });
    const result = await parseTicketFileRaw(path.join(tasksDirPath, '1.md'), 1, PREFIX);
    expect(result?.summary.prs).toEqual(['owner/repo/pull/1']);
  });

  it('should leave summary unchanged when branch/prs absent', async () => {
    await makeTicketFile(tasksDirPath, 1, {});
    const result = await parseTicketFileRaw(path.join(tasksDirPath, '1.md'), 1, PREFIX);
    expect(result?.summary.branch).toBeUndefined();
    expect(result?.summary.prs).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('parseTicketFileRaw — is_reviewed field', () => {
  it.each([
    { input: true,      expected: true },
    { input: false,     expected: false },
    { input: undefined, expected: undefined },
    { input: 'yes',     expected: undefined },
  ] as const)('is_reviewed=$input → isReviewed=$expected', async ({ input, expected }) => {
    const overrides: Record<string, unknown> = {};
    if (input !== undefined) overrides.is_reviewed = input;
    await makeTicketFile(tasksDirPath, 1, overrides);
    const result = await parseTicketFileRaw(path.join(tasksDirPath, '1.md'), 1, PREFIX);
    expect(result?.summary.isReviewed).toBe(expected);
  });
});

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

describe('parseTicketFileRaw — blocks and blockedBy fields', () => {
  it.each([
    {
      label: 'both fields present',
      overrides: { blocks: ['RAT-1'], blocked_by: ['MUN-2'] },
      expectedBlocks: ['RAT-1'],
      expectedBlockedBy: ['MUN-2'],
    },
    {
      label: 'both fields absent',
      overrides: {},
      expectedBlocks: [],
      expectedBlockedBy: [],
    },
    {
      label: 'both fields explicit empty arrays',
      overrides: { blocks: [], blocked_by: [] },
      expectedBlocks: [],
      expectedBlockedBy: [],
    },
    {
      label: 'cross-project display IDs',
      overrides: { blocks: ['MUN-6', 'RAT-3'], blocked_by: ['MUN-1'] },
      expectedBlocks: ['MUN-6', 'RAT-3'],
      expectedBlockedBy: ['MUN-1'],
    },
    {
      label: 'non-string and malformed entries filtered',
      overrides: { blocks: ['RAT-1', 42, null, '', 'not-valid', 'rat-2'] },
      expectedBlocks: ['RAT-1'],
      expectedBlockedBy: [],
    },
    {
      label: 'only blocks set',
      overrides: { blocks: ['RAT-2'] },
      expectedBlocks: ['RAT-2'],
      expectedBlockedBy: [],
    },
    {
      label: 'only blocked_by set',
      overrides: { blocked_by: ['RAT-2'] },
      expectedBlocks: [],
      expectedBlockedBy: ['RAT-2'],
    },
  ] as const)(
    '$label → blocks=$expectedBlocks, blockedBy=$expectedBlockedBy',
    async ({ overrides, expectedBlocks, expectedBlockedBy }) => {
      await makeTicketFile(tasksDirPath, 1, overrides as Record<string, unknown>);
      const result = await parseTicketFileRaw(path.join(tasksDirPath, '1.md'), 1, PREFIX);
      expect(result?.summary.blocks).toEqual(expectedBlocks);
      expect(result?.summary.blockedBy).toEqual(expectedBlockedBy);
    },
  );

  it('readTicketDetail propagates blocks and blockedBy', async () => {
    await makeTicketFile(tasksDirPath, 1, { blocks: ['RAT-2'], blocked_by: ['MUN-3'] });
    const detail = await readTicketDetail(PROJECT, 1, PREFIX);
    expect(detail?.blocks).toEqual(['RAT-2']);
    expect(detail?.blockedBy).toEqual(['MUN-3']);
  });

  it('listTickets propagates blocks and blockedBy on each summary', async () => {
    await makeTicketFile(tasksDirPath, 1, { blocks: ['RAT-5'], blocked_by: ['MUN-1'] });
    const tickets = await listTickets(PROJECT, PREFIX);
    const ticket = tickets.find((t) => t.number === 1);
    expect(ticket?.blocks).toEqual(['RAT-5']);
    expect(ticket?.blockedBy).toEqual(['MUN-1']);
  });

  it('listArchivedTickets propagates blocks and blockedBy on archived records', async () => {
    const archiveDirPath = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr', 'archive');
    await makeTicketFile(archiveDirPath, 1, {
      blocks: ['RAT-9'],
      blocked_by: ['MUN-2'],
      state: 'DONE',
      archived: '2026-01-02T00:00:00.000Z',
    });
    const records = await listArchivedTickets(PROJECT, PREFIX);
    const record = records.find((r) => r.number === 1);
    expect(record?.blocks).toEqual(['RAT-9']);
    expect(record?.blockedBy).toEqual(['MUN-2']);
  });
});

// ---------------------------------------------------------------------------

describe('readTicketDetail — pullRequests enrichment', () => {
  const fakePR: PullRequestInfo = {
    url: 'https://github.com/owner/repo/pull/1',
    number: 1,
    title: 'Test PR',
    state: 'OPEN',
  };
  const originalFetch = _gh.fetchPullRequest;

  afterEach(() => {
    _gh.fetchPullRequest = originalFetch;
  });

  it('should return pullRequests populated by the injected fetcher', async () => {
    _gh.fetchPullRequest = async () => ({ ...fakePR });
    await makeTicketFile(tasksDirPath, 1, { prs: ['owner/repo/pull/1'] });

    const detail = await readTicketDetail(PROJECT, 1, PREFIX);
    expect(detail?.pullRequests).toHaveLength(1);
    expect(detail?.pullRequests?.[0].number).toBe(1);
    expect(detail?.pullRequests?.[0].title).toBe('Test PR');
  });

  it('should omit pullRequests when prs is empty', async () => {
    _gh.fetchPullRequest = async () => ({ ...fakePR });
    await makeTicketFile(tasksDirPath, 1, {});

    const detail = await readTicketDetail(PROJECT, 1, PREFIX);
    expect(detail?.pullRequests).toBeUndefined();
  });

  it('should drop entries the fetcher returns null for', async () => {
    _gh.fetchPullRequest = async () => null;
    await makeTicketFile(tasksDirPath, 1, { prs: ['owner/repo/pull/1'] });

    const detail = await readTicketDetail(PROJECT, 1, PREFIX);
    expect(detail?.pullRequests).toBeUndefined();
  });

  it('should skip prs entries that cannot be parsed and have no fallback', async () => {
    _gh.fetchPullRequest = async () => ({ ...fakePR });
    await makeTicketFile(tasksDirPath, 1, { prs: ['not-a-valid-path'] });

    const detail = await readTicketDetail(PROJECT, 1, PREFIX);
    expect(detail?.pullRequests).toBeUndefined();
  });

  it('should use github_repo from config.json as fallback for bare-number prs entries', async () => {
    await makeConfigFile({ github_repo: 'owner/repo' });
    _gh.fetchPullRequest = async (parts) => ({
      url: `https://github.com/${parts.owner}/${parts.repo}/pull/${parts.number}`,
      number: parts.number,
      title: 'Fallback PR',
      state: 'MERGED',
    });
    await makeTicketFile(tasksDirPath, 1, { prs: ['42'] });

    const detail = await readTicketDetail(PROJECT, 1, PREFIX);
    expect(detail?.pullRequests).toHaveLength(1);
    expect(detail?.pullRequests?.[0].number).toBe(42);
  });
});
