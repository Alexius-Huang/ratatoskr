import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  archiveDoneTickets,
  archiveTicket,
  computeNextTicketNumber,
  createTicket,
  markEpicDone,
  unarchiveTicket,
  updateTicket,
} from './writeFs';

const PROJECT = 'ratatoskr';
const PREFIX = 'RAT';

let tmpRoot: string;
let tasksPath: string;
let archivePath: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'rat-test-'));
  process.env.RATATOSKR_WORKSPACE_ROOT = tmpRoot;
  tasksPath = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr', 'tasks');
  archivePath = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr', 'archive');
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

// ---------------------------------------------------------------------------

describe('computeNextTicketNumber', () => {
  it('should return 1 when workspace has no tasks and no archive', async () => {
    const result = await computeNextTicketNumber(PROJECT);
    expect(result).toBe(1);
  });

  it('should return max + 1 when only tasks exist', async () => {
    await makeTicketFile(tasksPath, 3);
    await makeTicketFile(tasksPath, 7);
    await makeTicketFile(tasksPath, 1);
    const result = await computeNextTicketNumber(PROJECT);
    expect(result).toBe(8);
  });

  it('should return max + 1 across tasks and archive combined', async () => {
    await makeTicketFile(tasksPath, 2);
    await makeTicketFile(tasksPath, 5);
    await makeTicketFile(archivePath, 9);
    await makeTicketFile(archivePath, 3);
    const result = await computeNextTicketNumber(PROJECT);
    expect(result).toBe(10);
  });
});

// ---------------------------------------------------------------------------

describe('createTicket', () => {
  it('should reject an empty title', async () => {
    const result = await createTicket(PROJECT, PREFIX, { type: 'Task', title: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it('should reject an invalid type', async () => {
    const result = await createTicket(PROJECT, PREFIX, { type: 'Foo' as 'Task', title: 'X' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it('should reject an epic ref that points to a non-Epic ticket', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Task' });
    const result = await createTicket(PROJECT, PREFIX, { type: 'Task', title: 'Child', epic: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it('should scaffold body when none provided', async () => {
    const result = await createTicket(PROJECT, PREFIX, { type: 'Task', title: 'My ticket' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = await readFile(path.join(tasksPath, `${result.data.number}.md`), 'utf8');
    expect(raw).toContain('## Acceptance Criteria');
  });

  it('should write correct frontmatter to tasks/', async () => {
    const result = await createTicket(PROJECT, PREFIX, {
      type: 'Bug',
      title: 'Test bug',
      state: 'READY',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = await readFile(path.join(tasksPath, `${result.data.number}.md`), 'utf8');
    const { data } = matter(raw);
    expect(data.type).toBe('Bug');
    expect(data.title).toBe('Test bug');
    expect(data.state).toBe('READY');
  });
});

// ---------------------------------------------------------------------------

describe('updateTicket', () => {
  it('should return not-found for a missing ticket', async () => {
    const result = await updateTicket(PROJECT, PREFIX, 999, { title: 'New' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not-found');
  });

  it('should reject an empty title patch', async () => {
    await makeTicketFile(tasksPath, 1);
    const result = await updateTicket(PROJECT, PREFIX, 1, { title: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it("should reject changing an Epic's type", async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic' });
    const result = await updateTicket(PROJECT, PREFIX, 1, { type: 'Task' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it("should reject changing any ticket's type to Epic", async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Task' });
    const result = await updateTicket(PROJECT, PREFIX, 1, { type: 'Epic' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it('should bump updated and preserve unknown frontmatter keys', async () => {
    await makeTicketFile(tasksPath, 1, { plan_doc: 'plans/1.md' });
    const result = await updateTicket(PROJECT, PREFIX, 1, { state: 'IN_PROGRESS' });
    expect(result.ok).toBe(true);
    const raw = await readFile(path.join(tasksPath, '1.md'), 'utf8');
    const { data } = matter(raw);
    expect(data.plan_doc).toBe('plans/1.md');
    expect(data.updated).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('should accept plan_doc and write it to frontmatter', async () => {
    await makeTicketFile(tasksPath, 1);
    const result = await updateTicket(PROJECT, PREFIX, 1, { plan_doc: 'plans/1.md' });
    expect(result.ok).toBe(true);
    const raw = await readFile(path.join(tasksPath, '1.md'), 'utf8');
    const { data } = matter(raw);
    expect(data.plan_doc).toBe('plans/1.md');
  });

  it('should strip plan_doc when patched with null', async () => {
    await makeTicketFile(tasksPath, 1, { plan_doc: 'plans/1.md' });
    const result = await updateTicket(PROJECT, PREFIX, 1, { plan_doc: null });
    expect(result.ok).toBe(true);
    const raw = await readFile(path.join(tasksPath, '1.md'), 'utf8');
    const { data } = matter(raw);
    expect(data.plan_doc).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('archiveTicket', () => {
  it('should move file from tasks/ to archive/ and add archived field', async () => {
    await makeTicketFile(tasksPath, 1);
    const result = await archiveTicket(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(true);
    await expect(stat(path.join(tasksPath, '1.md'))).rejects.toThrow();
    const raw = await readFile(path.join(archivePath, '1.md'), 'utf8');
    const { data } = matter(raw);
    expect(typeof data.archived).toBe('string');
    expect(data.archived.length).toBeGreaterThan(0);
  });

  it('should return epic-guard-violated with blocker counts when Epic has non-DONE children', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'My Epic' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', epic: 1, state: 'IN_PROGRESS' });
    await makeTicketFile(tasksPath, 3, { type: 'Task', epic: 1, state: 'DONE' });
    const result = await archiveTicket(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('epic-guard-violated');
      if (result.error.kind === 'epic-guard-violated') {
        expect(result.error.blockers).toMatchObject({ IN_PROGRESS: 1 });
      }
    }
  });

  it('should succeed when all Epic children are DONE', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'My Epic' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', epic: 1, state: 'DONE' });
    const result = await archiveTicket(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('unarchiveTicket', () => {
  it('should move file back to tasks/ and strip archived field', async () => {
    await makeTicketFile(archivePath, 1, { archived: '2026-01-02T00:00:00.000Z' });
    const result = await unarchiveTicket(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(true);
    await expect(stat(path.join(archivePath, '1.md'))).rejects.toThrow();
    const raw = await readFile(path.join(tasksPath, '1.md'), 'utf8');
    const { data } = matter(raw);
    expect(data.archived).toBeUndefined();
  });

  it('should return already-exists when tasks/<n>.md already present', async () => {
    await makeTicketFile(tasksPath, 1);
    await makeTicketFile(archivePath, 1, { archived: '2026-01-02T00:00:00.000Z' });
    const result = await unarchiveTicket(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('already-exists');
  });
});

// ---------------------------------------------------------------------------

describe('archiveDoneTickets', () => {
  it('should archive all DONE Task/Bug tickets', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Task', state: 'DONE' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', state: 'DONE' });
    await makeTicketFile(tasksPath, 3, { type: 'Bug', state: 'DONE' });
    const result = await archiveDoneTickets(PROJECT, PREFIX);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.archived).toBe(3);
    await expect(stat(path.join(tasksPath, '1.md'))).rejects.toThrow();
    await expect(stat(path.join(tasksPath, '2.md'))).rejects.toThrow();
    await expect(stat(path.join(tasksPath, '3.md'))).rejects.toThrow();
  });

  it('should skip non-DONE tickets', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Task', state: 'DONE' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', state: 'IN_PROGRESS' });
    await makeTicketFile(tasksPath, 3, { type: 'Task', state: 'NOT_READY' });
    const result = await archiveDoneTickets(PROJECT, PREFIX);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.archived).toBe(1);
    await expect(stat(path.join(tasksPath, '2.md'))).resolves.toBeDefined();
    await expect(stat(path.join(tasksPath, '3.md'))).resolves.toBeDefined();
  });

  it('should skip Epic tickets regardless of state', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'My Epic', state: 'DONE' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', state: 'DONE' });
    const result = await archiveDoneTickets(PROJECT, PREFIX);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.archived).toBe(1);
    await expect(stat(path.join(tasksPath, '1.md'))).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------

describe('auto-promote parent epic', () => {
  it('updateTicket: flips a NOT_READY epic to IN_PROGRESS when child patched to IN_PROGRESS', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'NOT_READY' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', epic: 1, state: 'NOT_READY' });
    const result = await updateTicket(PROJECT, PREFIX, 2, { state: 'IN_PROGRESS' });
    expect(result.ok).toBe(true);
    const { data } = matter(await readFile(path.join(tasksPath, '1.md'), 'utf8'));
    expect(data.state).toBe('IN_PROGRESS');
  });

  it('updateTicket: flips a NOT_READY epic when child patched to IN_REVIEW', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'NOT_READY' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', epic: 1, state: 'NOT_READY' });
    const result = await updateTicket(PROJECT, PREFIX, 2, { state: 'IN_REVIEW' });
    expect(result.ok).toBe(true);
    const { data } = matter(await readFile(path.join(tasksPath, '1.md'), 'utf8'));
    expect(data.state).toBe('IN_PROGRESS');
  });

  it('updateTicket: flips a NOT_READY epic when child patched to DONE', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'NOT_READY' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', epic: 1, state: 'NOT_READY' });
    const result = await updateTicket(PROJECT, PREFIX, 2, { state: 'DONE' });
    expect(result.ok).toBe(true);
    const { data } = matter(await readFile(path.join(tasksPath, '1.md'), 'utf8'));
    expect(data.state).toBe('IN_PROGRESS');
  });

  it('updateTicket: does NOT flip epic when child patched to READY or PLANNING', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'NOT_READY' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', epic: 1, state: 'NOT_READY' });
    await updateTicket(PROJECT, PREFIX, 2, { state: 'READY' });
    const { data: d1 } = matter(await readFile(path.join(tasksPath, '1.md'), 'utf8'));
    expect(d1.state).toBe('NOT_READY');

    await updateTicket(PROJECT, PREFIX, 2, { state: 'PLANNING' });
    const { data: d2 } = matter(await readFile(path.join(tasksPath, '1.md'), 'utf8'));
    expect(d2.state).toBe('NOT_READY');
  });

  it('updateTicket: does NOT mutate an epic already past NOT_READY (one-way rule)', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'IN_PROGRESS', updated: '2026-01-01T00:00:00.000Z' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', epic: 1, state: 'NOT_READY' });
    await updateTicket(PROJECT, PREFIX, 2, { state: 'IN_PROGRESS' });
    const { data } = matter(await readFile(path.join(tasksPath, '1.md'), 'utf8'));
    expect(data.state).toBe('IN_PROGRESS');
    const updatedStr = typeof data.updated === 'string' ? data.updated : (data.updated as Date).toISOString();
    expect(updatedStr).toBe('2026-01-01T00:00:00.000Z');
  });

  it('createTicket: flips a NOT_READY epic when child is created directly in IN_PROGRESS', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'NOT_READY' });
    const result = await createTicket(PROJECT, PREFIX, { type: 'Task', title: 'Child', state: 'IN_PROGRESS', epic: 1 });
    expect(result.ok).toBe(true);
    const { data } = matter(await readFile(path.join(tasksPath, '1.md'), 'utf8'));
    expect(data.state).toBe('IN_PROGRESS');
  });

  it('updateTicket: stale epic ref is a silent no-op — child patch still succeeds', async () => {
    await makeTicketFile(tasksPath, 2, { type: 'Task', epic: 999, state: 'NOT_READY' });
    const result = await updateTicket(PROJECT, PREFIX, 2, { state: 'IN_PROGRESS' });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('updateTicket — color field', () => {
  it('should persist a valid color on an Epic', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E' });
    const result = await updateTicket(PROJECT, PREFIX, 1, { color: '#A3BE8C' });
    expect(result.ok).toBe(true);
    const raw = await readFile(path.join(tasksPath, '1.md'), 'utf8');
    const { data } = matter(raw);
    expect(data.color).toBe('#A3BE8C');
  });

  it('should delete color when patched with null', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', color: '#A3BE8C' });
    const result = await updateTicket(PROJECT, PREFIX, 1, { color: null });
    expect(result.ok).toBe(true);
    const raw = await readFile(path.join(tasksPath, '1.md'), 'utf8');
    const { data } = matter(raw);
    expect(data.color).toBeUndefined();
  });

  it('should return invalid-input for a non-hex color string', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E' });
    const result = await updateTicket(PROJECT, PREFIX, 1, { color: 'purple' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it('should return invalid-input when setting color on a Task', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Task', title: 'T' });
    const result = await updateTicket(PROJECT, PREFIX, 1, { color: '#A3BE8C' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });
});

describe('DONE-epic assignment guardrail', () => {
  it('should reject createTicket when assigning a child to a DONE epic', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'DONE' });
    const result = await createTicket(PROJECT, PREFIX, { type: 'Task', title: 'T', epic: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-input');
      expect(result.error.message).toMatch(/completed epic/i);
    }
  });

  it('should reject updateTicket when patching epic field to a DONE epic', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'DONE' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', title: 'T' });
    const result = await updateTicket(PROJECT, PREFIX, 2, { epic: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-input');
      expect(result.error.message).toMatch(/completed epic/i);
    }
  });
});

describe('markEpicDone', () => {
  it('should append the summary block and flip state to DONE', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'My Epic', state: 'IN_PROGRESS' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', title: 'Child A', state: 'DONE', epic: 1, updated: '2026-03-01T00:00:00.000Z' });
    const result = await markEpicDone(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.state).toBe('DONE');
      expect(result.data.body).toContain('## Summary');
      expect(result.data.body).toContain('RAT-2');
      expect(result.data.body).toContain('Child A');
    }
  });

  it('should return invalid-input when ticket is not an Epic', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Task', title: 'T', state: 'IN_PROGRESS' });
    const result = await markEpicDone(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it('should return invalid-input when epic is NOT_READY', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'NOT_READY' });
    const result = await markEpicDone(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it('should return invalid-input when epic is already DONE', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'DONE' });
    const result = await markEpicDone(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-input');
  });

  it('should return invalid-input when an epic has a non-DONE child', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'IN_PROGRESS' });
    await makeTicketFile(tasksPath, 2, { type: 'Task', title: 'C', state: 'IN_PROGRESS', epic: 1 });
    const result = await markEpicDone(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-input');
      expect(result.error.message).toMatch(/non-DONE/i);
    }
  });

  it('should return invalid-input when the epic has no children', async () => {
    await makeTicketFile(tasksPath, 1, { type: 'Epic', title: 'E', state: 'IN_PROGRESS' });
    const result = await markEpicDone(PROJECT, PREFIX, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-input');
      expect(result.error.message).toMatch(/no children/i);
    }
  });

  it('should return not-found when the ticket file is missing', async () => {
    const result = await markEpicDone(PROJECT, PREFIX, 999);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('not-found');
  });
});
