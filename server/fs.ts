import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type {
  ProjectSummary,
  RatatoskrConfig,
  TicketDetail,
  TicketState,
  TicketSummary,
  TicketType,
} from './types';

export function getWorkspaceRoot(): string {
  const fromEnv = process.env.RATATOSKR_WORKSPACE_ROOT;
  if (fromEnv) return fromEnv;
  return path.resolve(process.cwd(), '..', '..');
}

export async function readProjectConfig(projectName: string): Promise<{
  config: RatatoskrConfig | null;
  hasConfig: boolean;
  warnings: string[];
}> {
  const workspaceRoot = getWorkspaceRoot();
  const configPath = path.join(
    workspaceRoot,
    'projects',
    projectName,
    '.meta',
    'ratatoskr',
    'config.json',
  );

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch {
    return { config: null, hasConfig: false, warnings: ['Missing config.json'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      config: null,
      hasConfig: true,
      warnings: ['Invalid JSON in config.json'],
    };
  }

  const candidate = parsed as Partial<RatatoskrConfig> | null;
  if (
    !candidate ||
    typeof candidate.prefix !== 'string' ||
    candidate.prefix.length === 0
  ) {
    return {
      config: null,
      hasConfig: true,
      warnings: ['Missing prefix field'],
    };
  }

  return {
    config: candidate as RatatoskrConfig,
    hasConfig: true,
    warnings: [],
  };
}

export async function scanProjects(): Promise<ProjectSummary[]> {
  const workspaceRoot = getWorkspaceRoot();
  const projectsDir = path.join(workspaceRoot, 'projects');

  let entries;
  try {
    entries = await readdir(projectsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const directoryNames = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  const results = await Promise.all(
    directoryNames.map(async (name) => {
      const { config, hasConfig, warnings } = await readProjectConfig(name);
      return { name, config, hasConfig, warnings } satisfies ProjectSummary;
    }),
  );

  return results;
}

// ---------- Tickets ----------

const TICKET_FILENAME_RE = /^(\d+)\.md$/;

const TICKET_TYPES: readonly TicketType[] = ['Task', 'Epic', 'Bug'];
const TICKET_STATES: readonly TicketState[] = [
  'NOT_READY',
  'PLANNING',
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
];

function isTicketType(value: unknown): value is TicketType {
  return (
    typeof value === 'string' &&
    (TICKET_TYPES as readonly string[]).includes(value)
  );
}

function isTicketState(value: unknown): value is TicketState {
  return (
    typeof value === 'string' &&
    (TICKET_STATES as readonly string[]).includes(value)
  );
}

// YAML frontmatter auto-parses ISO 8601 timestamps into Date objects.
// Accept either form and normalize to a string for the API response.
function coerceIsoString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

function tasksDir(projectName: string): string {
  return path.join(
    getWorkspaceRoot(),
    'projects',
    projectName,
    '.meta',
    'ratatoskr',
    'tasks',
  );
}

async function parseTicketFileRaw(
  filePath: string,
  num: number,
  prefix: string,
): Promise<{ summary: TicketSummary; content: string } | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    console.warn(`[tickets] Could not read ${filePath}`);
    return null;
  }

  let parsed;
  try {
    parsed = matter(raw);
  } catch (err) {
    console.warn(`[tickets] Frontmatter parse failed: ${filePath}`, err);
    return null;
  }

  const fm = parsed.data as Record<string, unknown>;

  if (!isTicketType(fm.type)) {
    console.warn(`[tickets] Invalid/missing 'type' in ${filePath}`);
    return null;
  }
  if (typeof fm.title !== 'string' || fm.title.length === 0) {
    console.warn(`[tickets] Missing 'title' in ${filePath}`);
    return null;
  }
  if (!isTicketState(fm.state)) {
    console.warn(`[tickets] Invalid/missing 'state' in ${filePath}`);
    return null;
  }
  const created = coerceIsoString(fm.created);
  if (!created) {
    console.warn(`[tickets] Invalid/missing 'created' in ${filePath}`);
    return null;
  }
  const updated = coerceIsoString(fm.updated);
  if (!updated) {
    console.warn(`[tickets] Invalid/missing 'updated' in ${filePath}`);
    return null;
  }

  const summary: TicketSummary = {
    number: num,
    displayId: `${prefix}-${num}`,
    type: fm.type,
    title: fm.title,
    state: fm.state,
    created,
    updated,
  };

  if (
    (fm.type === 'Task' || fm.type === 'Bug') &&
    typeof fm.epic === 'number'
  ) {
    summary.epic = fm.epic;
  }

  if (typeof fm.plan_doc === 'string' && fm.plan_doc.length > 0) {
    summary.planDoc = fm.plan_doc;
  }

  return { summary, content: parsed.content };
}

async function parseTicketFile(
  filePath: string,
  num: number,
  prefix: string,
): Promise<TicketSummary | null> {
  const raw = await parseTicketFileRaw(filePath, num, prefix);
  return raw?.summary ?? null;
}

function stripLeadingH1(body: string): string {
  return body.replace(/^\s*#\s+.*\n+/, '').trim();
}

export async function readTicketDetail(
  projectName: string,
  num: number,
  prefix: string,
): Promise<TicketDetail | null> {
  const filePath = path.join(tasksDir(projectName), `${num}.md`);
  const raw = await parseTicketFileRaw(filePath, num, prefix);
  if (!raw) return null;

  if (
    (raw.summary.type === 'Task' || raw.summary.type === 'Bug') &&
    raw.summary.epic !== undefined
  ) {
    const epicPath = path.join(tasksDir(projectName), `${raw.summary.epic}.md`);
    const epicRaw = await parseTicketFileRaw(
      epicPath,
      raw.summary.epic,
      prefix,
    );
    if (epicRaw && epicRaw.summary.type === 'Epic') {
      raw.summary.epicTitle = epicRaw.summary.title;
    }
  }

  return {
    ...raw.summary,
    body: stripLeadingH1(raw.content),
  };
}

export async function listTickets(
  projectName: string,
  prefix: string,
): Promise<TicketSummary[]> {
  const dir = tasksDir(projectName);

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const candidates: { name: string; num: number }[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(TICKET_FILENAME_RE);
    if (!match) {
      console.warn(`[tickets] Skipping non-numeric filename: ${entry.name}`);
      continue;
    }
    candidates.push({ name: entry.name, num: Number(match[1]) });
  }

  const results = await Promise.all(
    candidates.map(({ name, num }) =>
      parseTicketFile(path.join(dir, name), num, prefix),
    ),
  );

  const valid = results.filter((t): t is TicketSummary => t !== null);

  // Resolve each work-item's parent epic title server-side so the list
  // response is self-contained (pagination-safe — a ticket in page N can
  // reference an epic in page M without the client needing both).
  const epicIds = new Set<number>();
  const epicTitles = new Map<number, string>();
  for (const t of valid) {
    if (t.type === 'Epic') {
      epicIds.add(t.number);
      epicTitles.set(t.number, t.title);
    }
  }
  for (const t of valid) {
    if ((t.type === 'Task' || t.type === 'Bug') && t.epic !== undefined) {
      if (!epicIds.has(t.epic)) {
        console.warn(
          `[tickets] ${t.displayId} references epic #${t.epic} that is not an Epic-typed ticket`,
        );
        continue;
      }
      const title = epicTitles.get(t.epic);
      if (title !== undefined) t.epicTitle = title;
    }
  }

  // Roll up child counts onto each Epic so the Epics tab can show
  // per-state distribution without a second round-trip. Tasks and Bugs
  // both count as children.
  const childCountsByEpic = new Map<number, Record<TicketState, number>>();
  for (const t of valid) {
    if ((t.type === 'Task' || t.type === 'Bug') && t.epic !== undefined) {
      let bucket = childCountsByEpic.get(t.epic);
      if (!bucket) {
        bucket = emptyStateCounts();
        childCountsByEpic.set(t.epic, bucket);
      }
      bucket[t.state] += 1;
    }
  }
  for (const t of valid) {
    if (t.type !== 'Epic') continue;
    const byState = childCountsByEpic.get(t.number) ?? emptyStateCounts();
    const total = Object.values(byState).reduce((a, b) => a + b, 0);
    t.childCounts = { total, byState };
  }

  valid.sort((a, b) => a.number - b.number);
  return valid;
}

function emptyStateCounts(): Record<TicketState, number> {
  return {
    NOT_READY: 0,
    PLANNING: 0,
    READY: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  };
}
