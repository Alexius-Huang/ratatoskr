import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import {
  archiveDir,
  listTickets,
  readTicketDetail,
  TICKET_FILENAME_RE,
  tasksDir,
} from './fs';
import type {
  CreateTicketRequest,
  TicketDetail,
  TicketState,
  TicketType,
  UpdateTicketRequest,
} from './types';

export function nowIso(): string {
  return new Date().toISOString();
}

export async function computeNextTicketNumber(projectName: string): Promise<number> {
  const [taskEntries, archiveEntries] = await Promise.all([
    readdir(tasksDir(projectName)).catch(() => [] as string[]),
    readdir(archiveDir(projectName)).catch(() => [] as string[]),
  ]);
  let max = 0;
  for (const name of [...taskEntries, ...archiveEntries]) {
    const m = name.match(TICKET_FILENAME_RE);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function scaffoldBody(title: string): string {
  return `# ${title}\n\n## Description\n\n\n\n## Acceptance Criteria\n\n`;
}

const VALID_TYPES: readonly TicketType[] = ['Task', 'Epic', 'Bug'];
const VALID_STATES: readonly TicketState[] = [
  'NOT_READY',
  'PLANNING',
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
];

type DomainError =
  | { kind: 'not-found'; message: string }
  | { kind: 'epic-guard-violated'; message: string; blockers: Partial<Record<TicketState, number>> }
  | { kind: 'already-exists'; message: string }
  | { kind: 'invalid-input'; message: string };

export type WriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DomainError };

export async function createTicket(
  projectName: string,
  prefix: string,
  input: CreateTicketRequest,
): Promise<WriteResult<TicketDetail>> {
  const title = input.title?.trim();
  if (!title) return { ok: false, error: { kind: 'invalid-input', message: 'title is required' } };
  if (!VALID_TYPES.includes(input.type as TicketType)) {
    return { ok: false, error: { kind: 'invalid-input', message: `invalid type: ${input.type}` } };
  }
  const ticketType = input.type as TicketType;
  const ticketState: TicketState = (input.state && VALID_STATES.includes(input.state as TicketState))
    ? input.state as TicketState
    : 'NOT_READY';

  if (input.epic !== undefined && input.epic !== null) {
    if (ticketType === 'Epic') {
      return { ok: false, error: { kind: 'invalid-input', message: 'Epics cannot have a parent epic' } };
    }
    const tickets = await listTickets(projectName, prefix);
    const parent = tickets.find((t) => t.number === input.epic);
    if (!parent || parent.type !== 'Epic') {
      return { ok: false, error: { kind: 'invalid-input', message: `Epic #${input.epic} not found` } };
    }
  }

  const num = await computeNextTicketNumber(projectName);
  const now = nowIso();

  const fm: Record<string, unknown> = {
    type: ticketType,
    title,
    state: ticketState,
    created: now,
    updated: now,
  };
  if ((ticketType === 'Task' || ticketType === 'Bug') && input.epic !== undefined && input.epic !== null) {
    fm.epic = input.epic;
  }

  const body = input.body !== undefined ? input.body : scaffoldBody(title);
  const fileContent = matter.stringify(body, fm);

  const dir = tasksDir(projectName);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${num}.md`), fileContent, 'utf8');

  const detail = await readTicketDetail(projectName, num, prefix);
  if (!detail) {
    return { ok: false, error: { kind: 'not-found', message: 'Failed to read newly created ticket' } };
  }
  return { ok: true, data: detail };
}

export async function updateTicket(
  projectName: string,
  prefix: string,
  num: number,
  patch: UpdateTicketRequest,
): Promise<WriteResult<TicketDetail>> {
  const filePath = path.join(tasksDir(projectName), `${num}.md`);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return { ok: false, error: { kind: 'not-found', message: `Ticket ${prefix}-${num} not found` } };
  }

  const parsed = matter(raw);
  const fm = parsed.data as Record<string, unknown>;

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: { kind: 'invalid-input', message: 'title cannot be empty' } };
    fm.title = t;
  }
  if (patch.state !== undefined) {
    if (!VALID_STATES.includes(patch.state as TicketState)) {
      return { ok: false, error: { kind: 'invalid-input', message: `invalid state: ${patch.state}` } };
    }
    fm.state = patch.state;
  }
  if (patch.type !== undefined) {
    if (fm.type === 'Epic') {
      return { ok: false, error: { kind: 'invalid-input', message: 'Cannot change type of an Epic' } };
    }
    if (patch.type === 'Epic') {
      return { ok: false, error: { kind: 'invalid-input', message: 'Cannot change type to Epic' } };
    }
    if (!VALID_TYPES.includes(patch.type as TicketType)) {
      return { ok: false, error: { kind: 'invalid-input', message: `invalid type: ${patch.type}` } };
    }
    fm.type = patch.type;
  }
  if ('epic' in patch) {
    if (patch.epic === null || patch.epic === undefined) {
      delete fm.epic;
    } else {
      const tickets = await listTickets(projectName, prefix);
      const parent = tickets.find((t) => t.number === patch.epic);
      if (!parent || parent.type !== 'Epic') {
        return { ok: false, error: { kind: 'invalid-input', message: `Epic #${patch.epic} not found` } };
      }
      fm.epic = patch.epic;
    }
  }

  fm.updated = nowIso();

  const newContent = patch.body !== undefined ? patch.body : parsed.content;
  const fileContent = matter.stringify(newContent, fm);
  await writeFile(filePath, fileContent, 'utf8');

  const detail = await readTicketDetail(projectName, num, prefix);
  if (!detail) {
    return { ok: false, error: { kind: 'not-found', message: `Ticket ${prefix}-${num} not found after update` } };
  }
  return { ok: true, data: detail };
}

export async function archiveTicket(
  projectName: string,
  prefix: string,
  num: number,
): Promise<WriteResult<void>> {
  const srcPath = path.join(tasksDir(projectName), `${num}.md`);
  let raw: string;
  try {
    raw = await readFile(srcPath, 'utf8');
  } catch {
    return { ok: false, error: { kind: 'not-found', message: `Ticket ${prefix}-${num} not found` } };
  }

  const parsed = matter(raw);
  const fm = parsed.data as Record<string, unknown>;

  if (fm.type === 'Epic') {
    const tickets = await listTickets(projectName, prefix);
    const children = tickets.filter((t) => (t.type === 'Task' || t.type === 'Bug') && t.epic === num);
    const blockers: Partial<Record<TicketState, number>> = {};
    for (const child of children) {
      if (child.state !== 'DONE') {
        blockers[child.state] = (blockers[child.state] ?? 0) + 1;
      }
    }
    if (Object.keys(blockers).length > 0) {
      const total = Object.values(blockers).reduce((a, b) => a + b, 0);
      return {
        ok: false,
        error: {
          kind: 'epic-guard-violated',
          message: `Epic has ${total} active non-DONE ${total === 1 ? 'child' : 'children'}`,
          blockers,
        },
      };
    }
  }

  fm.archived = nowIso();
  const fileContent = matter.stringify(parsed.content, fm);

  const destDir = archiveDir(projectName);
  await mkdir(destDir, { recursive: true });
  const destPath = path.join(destDir, `${num}.md`);

  await writeFile(destPath, fileContent, 'utf8');
  await unlink(srcPath);

  return { ok: true, data: undefined };
}

export async function unarchiveTicket(
  projectName: string,
  prefix: string,
  num: number,
): Promise<WriteResult<void>> {
  const srcPath = path.join(archiveDir(projectName), `${num}.md`);
  const destPath = path.join(tasksDir(projectName), `${num}.md`);

  try {
    await readFile(destPath, 'utf8');
    return { ok: false, error: { kind: 'already-exists', message: `Ticket ${prefix}-${num} already exists in tasks/` } };
  } catch {
    // expected — file should not exist
  }

  let raw: string;
  try {
    raw = await readFile(srcPath, 'utf8');
  } catch {
    return { ok: false, error: { kind: 'not-found', message: `Archived ticket ${prefix}-${num} not found` } };
  }

  const parsed = matter(raw);
  const fm = parsed.data as Record<string, unknown>;
  delete fm.archived;

  fm.updated = nowIso();

  const fileContent = matter.stringify(parsed.content, fm);

  const destDir = tasksDir(projectName);
  await mkdir(destDir, { recursive: true });

  await writeFile(destPath, fileContent, 'utf8');
  await unlink(srcPath);

  return { ok: true, data: undefined };
}

export async function archiveDoneTickets(
  projectName: string,
  prefix: string,
): Promise<WriteResult<{ archived: number }>> {
  const tickets = await listTickets(projectName, prefix);
  const done = tickets.filter(
    (t) => t.state === 'DONE' && (t.type === 'Task' || t.type === 'Bug'),
  );
  let archived = 0;
  for (const ticket of done) {
    const result = await archiveTicket(projectName, prefix, ticket.number);
    if (result.ok) archived++;
  }
  return { ok: true, data: { archived } };
}
