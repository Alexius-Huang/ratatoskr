import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { metaRoot } from './fs';
import type { Comment, CommentInput } from './types';

export class CommentNotFoundError extends Error {
  readonly code = 'COMMENT_NOT_FOUND';
  constructor(n: number) {
    super(`Comment ${n} not found`);
    this.name = 'CommentNotFoundError';
  }
}

export const COMMENT_FILENAME_RE = /^(\d+)\.md$/;

export function commentsDir(projectName: string, ticketNumber: number): string {
  return path.join(metaRoot(projectName), 'comments', String(ticketNumber));
}

function coerceIsoString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

export async function listComments(
  projectName: string,
  ticketNumber: number,
): Promise<Comment[]> {
  const dir = commentsDir(projectName, ticketNumber);

  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }

  const comments: Comment[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      console.warn(`[comments] Skipping non-file entry: ${entry.name}`);
      continue;
    }
    const match = entry.name.match(COMMENT_FILENAME_RE);
    if (!match) {
      console.warn(`[comments] Skipping non-matching filename: ${entry.name}`);
      continue;
    }
    const n = Number(match[1]);

    let raw: string;
    try {
      raw = await readFile(path.join(dir, entry.name), 'utf8');
    } catch {
      console.warn(`[comments] Could not read ${entry.name}`);
      continue;
    }

    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(raw);
    } catch (err) {
      console.warn(`[comments] Frontmatter parse failed: ${entry.name}`, err);
      continue;
    }

    const fm = parsed.data as Record<string, unknown>;

    if (typeof fm.author !== 'string' || fm.author.length === 0) {
      console.warn(`[comments] Missing 'author' in ${entry.name}`);
      continue;
    }
    if (typeof fm.display_name !== 'string' || fm.display_name.length === 0) {
      console.warn(`[comments] Missing 'display_name' in ${entry.name}`);
      continue;
    }
    const timestamp = coerceIsoString(fm.timestamp);
    if (!timestamp) {
      console.warn(`[comments] Missing/invalid 'timestamp' in ${entry.name}`);
      continue;
    }

    const updated = coerceIsoString(fm.updated) ?? undefined;

    comments.push({
      n,
      author: fm.author,
      displayName: fm.display_name,
      timestamp,
      ...(updated !== undefined ? { updated } : {}),
      body: parsed.content.trimEnd(),
    });
  }

  comments.sort((a, b) => a.n - b.n);
  return comments;
}

export async function writeComment(
  projectName: string,
  ticketNumber: number,
  input: CommentInput,
): Promise<Comment> {
  if (typeof input.author !== 'string' || input.author.length === 0) {
    throw new Error('writeComment: author must be a non-empty string');
  }
  if (typeof input.displayName !== 'string' || input.displayName.length === 0) {
    throw new Error('writeComment: displayName must be a non-empty string');
  }
  if (typeof input.body !== 'string' || input.body.length === 0) {
    throw new Error('writeComment: body must be a non-empty string');
  }

  const dir = commentsDir(projectName, ticketNumber);

  let existingNames: string[];
  try {
    existingNames = await readdir(dir);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      existingNames = [];
    } else {
      throw err;
    }
  }

  let max = 0;
  for (const name of existingNames) {
    const m = name.match(COMMENT_FILENAME_RE);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  const nextN = max + 1;

  const timestamp = new Date().toISOString();
  const fm = { author: input.author, display_name: input.displayName, timestamp };
  const content = matter.stringify(input.body, fm);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${nextN}.md`), content, 'utf8');

  return {
    n: nextN,
    author: input.author,
    displayName: input.displayName,
    timestamp,
    body: input.body,
  };
}

export async function editComment(
  projectName: string,
  ticketNumber: number,
  n: number,
  newBody: string,
): Promise<Comment> {
  const trimmed = newBody.trim();
  if (trimmed.length === 0) {
    throw new Error('editComment: body must be a non-empty string');
  }

  const filePath = path.join(commentsDir(projectName, ticketNumber), `${n}.md`);

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CommentNotFoundError(n);
    }
    throw err;
  }

  const parsed = matter(raw);
  const data = { ...parsed.data as Record<string, unknown> };
  const updated = new Date().toISOString();
  data.updated = updated;

  const content = matter.stringify(trimmed, data);
  await writeFile(filePath, content, 'utf8');

  return {
    n,
    author: data.author as string,
    displayName: data.display_name as string,
    timestamp: coerceIsoString(data.timestamp) as string,
    updated,
    body: trimmed,
  };
}
