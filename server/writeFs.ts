import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import {
  archiveDir,
  listArchivedTickets,
  listTickets,
  readProjectConfig,
  readTicketDetail,
  TICKET_FILENAME_RE,
  tasksDir,
} from './fs';
import { parsePrPath } from './github';
import { buildEpicSummaryBlock } from './epicSummary';
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
  'WONT_DO',
];

const PROMOTING_STATES: ReadonlySet<TicketState> = new Set([
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'WONT_DO',
]);

// Best-effort: lift a NOT_READY parent epic to IN_PROGRESS in the same handler
// call. Sequential writes mean the next client read sees a consistent pair —
// true cross-file atomicity is impossible on POSIX without a journal.
// Only called when the caller has already confirmed the child's new state is
// in PROMOTING_STATES. Failures (stale ref, unreadable file) are swallowed.
async function maybePromoteParentEpic(
  projectName: string,
  epicNumber: number | undefined,
): Promise<void> {
  if (epicNumber === undefined) return;
  const epicPath = path.join(tasksDir(projectName), `${epicNumber}.md`);
  let raw: string;
  try {
    raw = await readFile(epicPath, 'utf8');
  } catch {
    return; // stale epic ref — skip
  }
  const parsed = matter(raw);
  const srcFm = parsed.data as Record<string, unknown>;
  if (srcFm.type !== 'Epic' || srcFm.state !== 'NOT_READY') return;
  const fm = { ...srcFm, state: 'IN_PROGRESS', updated: nowIso() };
  await writeFile(epicPath, matter.stringify(parsed.content, fm), 'utf8');
}

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

  if (ticketState === 'WONT_DO') {
    const reason = input.wont_do_reason?.trim();
    if (!reason) {
      return { ok: false, error: { kind: 'invalid-input', message: 'wont_do_reason is required when state is WONT_DO' } };
    }
  } else if (input.wont_do_reason) {
    return { ok: false, error: { kind: 'invalid-input', message: 'wont_do_reason can only be set when state is WONT_DO' } };
  }

  if (input.epic !== undefined && input.epic !== null) {
    if (ticketType === 'Epic') {
      return { ok: false, error: { kind: 'invalid-input', message: 'Epics cannot have a parent epic' } };
    }
    const tickets = await listTickets(projectName, prefix);
    const parent = tickets.find((t) => t.number === input.epic);
    if (!parent || parent.type !== 'Epic') {
      return { ok: false, error: { kind: 'invalid-input', message: `Epic #${input.epic} not found` } };
    }
    if (parent.state === 'DONE') {
      return { ok: false, error: { kind: 'invalid-input', message: `Cannot assign tickets to a completed epic (${parent.displayId})` } };
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

  if (ticketState === 'WONT_DO') {
    fm.wont_do_reason = input.wont_do_reason!.trim();
  }

  const body = input.body !== undefined ? input.body : scaffoldBody(title);
  const fileContent = matter.stringify(body, fm);

  const dir = tasksDir(projectName);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${num}.md`), fileContent, 'utf8');

  if (ticketType !== 'Epic' && PROMOTING_STATES.has(ticketState)) {
    await maybePromoteParentEpic(projectName, input.epic ?? undefined);
  }

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
  const fm = { ...parsed.data } as Record<string, unknown>;

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

  {
    const resultingState = (patch.state ?? fm.state) as TicketState;
    const wasWontDo = parsed.data.state === 'WONT_DO';
    const isWontDo = resultingState === 'WONT_DO';

    if (isWontDo) {
      if ('wont_do_reason' in patch && patch.wont_do_reason !== undefined && patch.wont_do_reason !== null) {
        const trimmed = patch.wont_do_reason.trim();
        if (!trimmed) {
          return { ok: false, error: { kind: 'invalid-input', message: 'wont_do_reason cannot be empty when state is WONT_DO' } };
        }
        fm.wont_do_reason = trimmed;
      } else if (!wasWontDo) {
        return { ok: false, error: { kind: 'invalid-input', message: 'wont_do_reason is required when state is WONT_DO' } };
      }
      // wasWontDo && no new reason supplied → keep existing fm.wont_do_reason unchanged
    } else {
      if ('wont_do_reason' in patch && patch.wont_do_reason) {
        return { ok: false, error: { kind: 'invalid-input', message: 'wont_do_reason can only be set when state is WONT_DO' } };
      }
      if (wasWontDo) {
        delete fm.wont_do_reason;
      }
    }
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
      if (parent.state === 'DONE') {
        return { ok: false, error: { kind: 'invalid-input', message: `Cannot assign tickets to a completed epic (${parent.displayId})` } };
      }
      fm.epic = patch.epic;
    }
  }

  if ('plan_doc' in patch) {
    if (patch.plan_doc === null || patch.plan_doc === '' || patch.plan_doc === undefined) {
      delete fm.plan_doc;
    } else if (typeof patch.plan_doc !== 'string') {
      return { ok: false, error: { kind: 'invalid-input', message: 'plan_doc must be a string' } };
    } else {
      fm.plan_doc = patch.plan_doc;
    }
  }

  if ('color' in patch) {
    if (fm.type !== 'Epic') {
      return { ok: false, error: { kind: 'invalid-input', message: 'color only allowed on Epic' } };
    }
    if (patch.color === null || patch.color === '' || patch.color === undefined) {
      delete fm.color;
    } else if (typeof patch.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(patch.color)) {
      return { ok: false, error: { kind: 'invalid-input', message: 'color must be a 6-digit hex (e.g. #7C3AED)' } };
    } else {
      fm.color = patch.color;
    }
  }

  if ('branch' in patch) {
    if (patch.branch === null || patch.branch === '' || patch.branch === undefined) {
      delete fm.branch;
    } else if (typeof patch.branch !== 'string') {
      return { ok: false, error: { kind: 'invalid-input', message: 'branch must be a string' } };
    } else {
      fm.branch = patch.branch;
    }
  }

  const VALID_RESOLUTIONS = ['VIBED', 'PLANNED', 'MANUAL'] as const;

  if ('resolution' in patch) {
    if (patch.resolution === null || patch.resolution === undefined) {
      delete fm.resolution;
    } else if (!VALID_RESOLUTIONS.includes(patch.resolution as typeof VALID_RESOLUTIONS[number])) {
      return { ok: false, error: { kind: 'invalid-input', message: `invalid resolution: ${patch.resolution}` } };
    } else {
      fm.resolution = patch.resolution;
    }
  }

  {
    const finalState = fm.state as TicketState;
    if (
      (finalState === 'IN_REVIEW' || finalState === 'DONE') &&
      fm.resolution === undefined &&
      !('resolution' in patch)
    ) {
      fm.resolution = 'MANUAL';
    }
  }

  if ('is_reviewed' in patch) {
    if (patch.is_reviewed === null || patch.is_reviewed === undefined) {
      delete fm.is_reviewed;
    } else if (typeof patch.is_reviewed !== 'boolean') {
      return { ok: false, error: { kind: 'invalid-input', message: 'is_reviewed must be a boolean' } };
    } else {
      fm.is_reviewed = patch.is_reviewed;
    }
  }

  if (patch.pr !== undefined) {
    if (typeof patch.pr !== 'string' || patch.pr.length === 0) {
      return { ok: false, error: { kind: 'invalid-input', message: 'pr must be a non-empty string' } };
    }
    const { config } = await readProjectConfig(projectName);
    if (!parsePrPath(patch.pr, config?.github_repo)) {
      return { ok: false, error: { kind: 'invalid-input', message: `invalid pr path: ${patch.pr}` } };
    }
    const existing = Array.isArray(fm.prs)
      ? (fm.prs as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];
    if (!existing.includes(patch.pr)) existing.push(patch.pr);
    fm.prs = existing;
  }

  fm.updated = nowIso();

  const newContent = patch.body !== undefined ? patch.body : parsed.content;
  const fileContent = matter.stringify(newContent, fm);
  await writeFile(filePath, fileContent, 'utf8');

  if (patch.state !== undefined && PROMOTING_STATES.has(patch.state as TicketState)) {
    await maybePromoteParentEpic(
      projectName,
      typeof fm.epic === 'number' ? fm.epic : undefined,
    );
  }

  const detail = await readTicketDetail(projectName, num, prefix);
  if (!detail) {
    return { ok: false, error: { kind: 'not-found', message: `Ticket ${prefix}-${num} not found after update` } };
  }
  return { ok: true, data: detail };
}

export async function markEpicDone(
  projectName: string,
  prefix: string,
  num: number,
): Promise<WriteResult<TicketDetail>> {
  const filePath = path.join(tasksDir(projectName), `${num}.md`);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return { ok: false, error: { kind: 'not-found', message: `Ticket ${prefix}-${num} not found` } };
  }
  const parsed = matter(raw);
  const fm = { ...parsed.data } as Record<string, unknown>;

  if (fm.type !== 'Epic') {
    return { ok: false, error: { kind: 'invalid-input', message: 'Only Epics can be marked as done via this endpoint' } };
  }
  if (fm.state !== 'IN_PROGRESS') {
    return { ok: false, error: { kind: 'invalid-input', message: `Epic must be IN_PROGRESS (currently ${fm.state})` } };
  }

  const isChild = (t: { type: string; epic?: number }) =>
    (t.type === 'Task' || t.type === 'Bug') && t.epic === num;
  const [tickets, archivedTickets] = await Promise.all([
    listTickets(projectName, prefix),
    listArchivedTickets(projectName, prefix),
  ]);
  const children = [
    ...tickets.filter(isChild),
    ...archivedTickets.filter(isChild),
  ];
  if (children.length === 0) {
    return { ok: false, error: { kind: 'invalid-input', message: 'Epic has no children — nothing to summarize' } };
  }
  const nonDone = children.filter((c) => c.state !== 'DONE' && c.state !== 'WONT_DO');
  if (nonDone.length > 0) {
    return { ok: false, error: { kind: 'invalid-input', message: `Epic still has ${nonDone.length} non-terminal children` } };
  }

  const now = nowIso();
  const newBody = parsed.content.trimEnd() + buildEpicSummaryBlock(children, now);
  fm.state = 'DONE';
  fm.updated = now;
  await writeFile(filePath, matter.stringify(newBody, fm), 'utf8');

  const detail = await readTicketDetail(projectName, num, prefix);
  if (!detail) {
    return { ok: false, error: { kind: 'not-found', message: `Ticket ${prefix}-${num} not found after finalize` } };
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
      if (child.state !== 'DONE' && child.state !== 'WONT_DO') {
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
    (t) => (t.state === 'DONE' || t.state === 'WONT_DO') && (t.type === 'Task' || t.type === 'Bug'),
  );
  let archived = 0;
  for (const ticket of done) {
    const result = await archiveTicket(projectName, prefix, ticket.number);
    if (result.ok) archived++;
  }
  return { ok: true, data: { archived } };
}
