import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach } from 'vitest';
import { computeNextTicketNumber } from './writeFs';

const PROJECT = 'ratatoskr';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'rat-test-'));
  process.env.RATATOSKR_WORKSPACE_ROOT = tmpRoot;
});

afterEach(async () => {
  delete process.env.RATATOSKR_WORKSPACE_ROOT;
  await rm(tmpRoot, { recursive: true, force: true });
});

async function makeTicketFile(dir: string, num: number) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${num}.md`), `---\ntitle: ticket ${num}\n---\n`, 'utf8');
}

describe('computeNextTicketNumber', () => {
  it('should return 1 when workspace has no tasks and no archive', async () => {
    const result = await computeNextTicketNumber(PROJECT);
    expect(result).toBe(1);
  });

  it('should return max + 1 when only tasks exist', async () => {
    const tasksDir = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr', 'tasks');
    await makeTicketFile(tasksDir, 3);
    await makeTicketFile(tasksDir, 7);
    await makeTicketFile(tasksDir, 1);
    const result = await computeNextTicketNumber(PROJECT);
    expect(result).toBe(8);
  });

  it('should return max + 1 across tasks and archive combined', async () => {
    const tasksDir = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr', 'tasks');
    const archiveDir = path.join(tmpRoot, 'projects', PROJECT, '.meta', 'ratatoskr', 'archive');
    await makeTicketFile(tasksDir, 2);
    await makeTicketFile(tasksDir, 5);
    await makeTicketFile(archiveDir, 9);
    await makeTicketFile(archiveDir, 3);
    const result = await computeNextTicketNumber(PROJECT);
    expect(result).toBe(10);
  });
});
