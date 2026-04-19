import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  listTickets,
  parseTicketFileRaw,
  readProjectConfig,
  readTicketPlan,
} from './fs';

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
