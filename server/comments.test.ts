import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentNotFoundError, commentsDir, editComment, listComments, writeComment } from './comments';

const PROJECT = 'ratatoskr';
const TICKET = 12;

let tmpRoot: string;
let commentsBasePath: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'rat-comments-test-'));
  process.env.RATATOSKR_WORKSPACE_ROOT = tmpRoot;
  commentsBasePath = path.join(
    tmpRoot,
    'projects',
    PROJECT,
    '.meta',
    'ratatoskr',
    'comments',
  );
});

afterEach(async () => {
  delete process.env.RATATOSKR_WORKSPACE_ROOT;
  await rm(tmpRoot, { recursive: true, force: true });
});

async function makeCommentFile(
  dir: string,
  n: number,
  overrides: Record<string, unknown> = {},
) {
  await mkdir(dir, { recursive: true });
  const fm = {
    author: 'j.huang',
    display_name: 'Jun-Xin Huang',
    timestamp: '2026-04-19T12:00:00.000Z',
    ...overrides,
  };
  const content = matter.stringify('Comment body here.', fm);
  await writeFile(path.join(dir, `${n}.md`), content, 'utf8');
}

// ---------------------------------------------------------------------------

describe('commentsDir', () => {
  it('should return a path under .meta/ratatoskr/comments/<ticketNumber>/', () => {
    const result = commentsDir(PROJECT, TICKET);
    expect(result).toContain(path.join('.meta', 'ratatoskr', 'comments', String(TICKET)));
    expect(result).toContain(PROJECT);
  });
});

// ---------------------------------------------------------------------------

describe('listComments', () => {
  it('should return an empty array when the comments folder is missing', async () => {
    const result = await listComments(PROJECT, TICKET);
    expect(result).toEqual([]);
  });

  it('should return an empty array when the folder exists but is empty', async () => {
    const dir = path.join(commentsBasePath, String(TICKET));
    await mkdir(dir, { recursive: true });
    const result = await listComments(PROJECT, TICKET);
    expect(result).toEqual([]);
  });

  it('should parse frontmatter into typed Comment objects', async () => {
    const dir = path.join(commentsBasePath, String(TICKET));
    await makeCommentFile(dir, 1, {
      author: 'j.huang',
      display_name: 'Jun-Xin Huang',
      timestamp: '2026-04-19T12:00:00.000Z',
    });

    const result = await listComments(PROJECT, TICKET);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      n: 1,
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      timestamp: '2026-04-19T12:00:00.000Z',
      body: 'Comment body here.',
    });
  });

  it('should sort results by numeric filename ascending', async () => {
    const dir = path.join(commentsBasePath, String(TICKET));
    await makeCommentFile(dir, 2);
    await makeCommentFile(dir, 10);
    await makeCommentFile(dir, 1);

    const result = await listComments(PROJECT, TICKET);
    expect(result.map((c) => c.n)).toEqual([1, 2, 10]);
  });

  it('should skip and warn on files whose frontmatter fails to parse', async () => {
    const dir = path.join(commentsBasePath, String(TICKET));
    await mkdir(dir, { recursive: true });
    // Write malformed YAML frontmatter
    await writeFile(
      path.join(dir, '1.md'),
      '---\n: bad: yaml: [\n---\nbody',
      'utf8',
    );
    await makeCommentFile(dir, 2);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await listComments(PROJECT, TICKET);
    warnSpy.mockRestore();

    expect(result).toHaveLength(1);
    expect(result[0].n).toBe(2);
  });

  it.each([
    ['author', { author: '' }],
    ['display_name', { display_name: '' }],
    ['timestamp', { timestamp: '' }],
  ])(
    'should skip and warn on files missing required frontmatter field: %s',
    async (_field, override) => {
      const dir = path.join(commentsBasePath, String(TICKET));
      await makeCommentFile(dir, 1, override);
      await makeCommentFile(dir, 2);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await listComments(PROJECT, TICKET);
      warnSpy.mockRestore();

      expect(result).toHaveLength(1);
      expect(result[0].n).toBe(2);
    },
  );

  it('should surface the updated timestamp when present in frontmatter', async () => {
    const dir = path.join(commentsBasePath, String(TICKET));
    const updated = '2026-04-26T10:00:00.000Z';
    await mkdir(dir, { recursive: true });
    const fm = {
      author: 'j.huang',
      display_name: 'Jun-Xin Huang',
      timestamp: '2026-04-19T12:00:00.000Z',
      updated,
    };
    await writeFile(path.join(dir, '1.md'), matter.stringify('Edited body.', fm), 'utf8');

    const result = await listComments(PROJECT, TICKET);
    expect(result).toHaveLength(1);
    expect(result[0].updated).toBe(updated);
    expect(result[0].body).toBe('Edited body.');
  });

  it('should skip and warn on non-<n>.md filenames', async () => {
    const dir = path.join(commentsBasePath, String(TICKET));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'foo.md'), matter.stringify('body', { author: 'a', display_name: 'A', timestamp: '2026-01-01T00:00:00Z' }), 'utf8');
    await writeFile(path.join(dir, '1.txt'), 'body', 'utf8');
    await makeCommentFile(dir, 1);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await listComments(PROJECT, TICKET);
    warnSpy.mockRestore();

    expect(result).toHaveLength(1);
    expect(result[0].n).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('writeComment', () => {
  it('should create the comments/<n>/ folder on first write', async () => {
    const result = await writeComment(PROJECT, TICKET, {
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      body: 'Hello world.',
    });
    expect(result.n).toBe(1);
  });

  it('should throw when author is empty', async () => {
    await expect(
      writeComment(PROJECT, TICKET, { author: '', displayName: 'James', body: 'body' }),
    ).rejects.toThrow(/author/);
  });

  it('should throw when displayName is empty', async () => {
    await expect(
      writeComment(PROJECT, TICKET, { author: 'j.huang', displayName: '', body: 'body' }),
    ).rejects.toThrow(/displayName/);
  });

  it('should throw when body is empty', async () => {
    await expect(
      writeComment(PROJECT, TICKET, { author: 'j.huang', displayName: 'James', body: '' }),
    ).rejects.toThrow(/body/);
  });

  it.each([
    [[], 1],
    [['1.md'], 2],
    [['1.md', '2.md', '3.md'], 4],
    [['1.md', '3.md'], 4], // gap — max wins
    [['5.md'], 6],
    [['10.md', '2.md'], 11], // out-of-order — max wins
  ])('should assign nextN correctly given existing filenames %j → %i', async (filenames, expectedN) => {
    const dir = path.join(commentsBasePath, String(TICKET));
    await mkdir(dir, { recursive: true });
    for (const name of filenames) {
      await writeFile(path.join(dir, name), matter.stringify('body', { author: 'a', display_name: 'A', timestamp: '2026-01-01T00:00:00Z' }), 'utf8');
    }

    const result = await writeComment(PROJECT, TICKET, {
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      body: 'A comment.',
    });
    expect(result.n).toBe(expectedN);
  });

  it('should write YAML frontmatter containing author, display_name, timestamp and body', async () => {
    await writeComment(PROJECT, TICKET, {
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      body: 'Written comment.',
    });

    const dir = path.join(commentsBasePath, String(TICKET));
    const raw = await import('node:fs/promises').then((m) =>
      m.readFile(path.join(dir, '1.md'), 'utf8'),
    );
    const parsed = matter(raw);
    expect(parsed.data.author).toBe('j.huang');
    expect(parsed.data.display_name).toBe('Jun-Xin Huang');
    expect(typeof parsed.data.timestamp).toBe('string');
    expect(parsed.content.trim()).toBe('Written comment.');
  });

  it('should set timestamp server-side (round-trip returns timestamp within 5s of now)', async () => {
    const before = Date.now();
    await writeComment(PROJECT, TICKET, {
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      body: 'Timestamp test.',
    });
    const after = Date.now();

    const comments = await listComments(PROJECT, TICKET);
    expect(comments).toHaveLength(1);
    const ts = new Date(comments[0].timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 5000);
    expect(ts).toBeLessThanOrEqual(after + 5000);
  });

  it('should return the Comment object with its assigned n', async () => {
    const result = await writeComment(PROJECT, TICKET, {
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      body: 'Return value check.',
    });
    expect(result).toMatchObject({
      n: 1,
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      body: 'Return value check.',
    });
    expect(typeof result.timestamp).toBe('string');
  });
});

// ---------------------------------------------------------------------------

describe('editComment', () => {
  it('should update the body and write a fresh updated timestamp', async () => {
    await writeComment(PROJECT, TICKET, {
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      body: 'Original body.',
    });
    const before = Date.now();
    const result = await editComment(PROJECT, TICKET, 1, 'Edited body.');
    const after = Date.now();

    expect(result.body).toBe('Edited body.');
    expect(typeof result.updated).toBe('string');
    const updatedMs = new Date(result.updated!).getTime();
    expect(updatedMs).toBeGreaterThanOrEqual(before - 5000);
    expect(updatedMs).toBeLessThanOrEqual(after + 5000);

    const comments = await listComments(PROJECT, TICKET);
    expect(comments[0].body).toBe('Edited body.');
    expect(comments[0].updated).toBe(result.updated);
  });

  it('should preserve author, display_name, and original timestamp', async () => {
    const original = await writeComment(PROJECT, TICKET, {
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      body: 'Original.',
    });
    await editComment(PROJECT, TICKET, 1, 'Updated.');

    const dir = path.join(commentsBasePath, String(TICKET));
    const raw = await import('node:fs/promises').then((m) => m.readFile(path.join(dir, '1.md'), 'utf8'));
    const parsed = matter(raw);
    expect(parsed.data.author).toBe('j.huang');
    expect(parsed.data.display_name).toBe('Jun-Xin Huang');
    expect(parsed.data.timestamp).toBe(original.timestamp);
  });

  it('should throw CommentNotFoundError when the comment file is missing', async () => {
    await expect(editComment(PROJECT, TICKET, 999, 'body')).rejects.toBeInstanceOf(CommentNotFoundError);
  });

  it('should reject an empty body', async () => {
    await writeComment(PROJECT, TICKET, {
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      body: 'Original.',
    });
    await expect(editComment(PROJECT, TICKET, 1, '')).rejects.toThrow(/body/);
  });

  it('should overwrite a previous updated timestamp on a second edit', async () => {
    await writeComment(PROJECT, TICKET, {
      author: 'j.huang',
      displayName: 'Jun-Xin Huang',
      body: 'First.',
    });
    const first = await editComment(PROJECT, TICKET, 1, 'Second.');
    await new Promise((r) => setTimeout(r, 5));
    const second = await editComment(PROJECT, TICKET, 1, 'Third.');

    expect(new Date(second.updated!).getTime()).toBeGreaterThanOrEqual(
      new Date(first.updated!).getTime(),
    );
  });
});
