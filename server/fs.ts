import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type {
  ProjectSummary,
  RatatoskrConfig,
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

const TICKET_TYPES: readonly TicketType[] = ['Task', 'Epic'];
const TICKET_STATES: readonly TicketState[] = [
  'NOT_READY',
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

async function parseTicketFile(
  filePath: string,
  num: number,
  prefix: string,
): Promise<TicketSummary | null> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    console.warn(`[tickets] Could not read ${filePath}`);
    return null;
  }

  let parsed;
  try {
    parsed = matter(content);
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

  if (fm.type === 'Task' && typeof fm.epic === 'number') {
    summary.epic = fm.epic;
  }

  return summary;
}

export async function listTickets(
  projectName: string,
  prefix: string,
): Promise<TicketSummary[]> {
  const workspaceRoot = getWorkspaceRoot();
  const tasksDir = path.join(
    workspaceRoot,
    'projects',
    projectName,
    '.meta',
    'ratatoskr',
    'tasks',
  );

  let entries;
  try {
    entries = await readdir(tasksDir, { withFileTypes: true });
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
      parseTicketFile(path.join(tasksDir, name), num, prefix),
    ),
  );

  const valid = results.filter((t): t is TicketSummary => t !== null);

  // Resolve each task's parent epic title server-side so the list
  // response is self-contained (pagination-safe — a task in page N can
  // reference an epic in page M without the client needing both).
  const epicTitles = new Map<number, string>();
  for (const t of valid) {
    if (t.type === 'Epic') epicTitles.set(t.number, t.title);
  }
  for (const t of valid) {
    if (t.type === 'Task' && t.epic !== undefined) {
      const title = epicTitles.get(t.epic);
      if (title !== undefined) t.epicTitle = title;
    }
  }

  valid.sort((a, b) => a.number - b.number);
  return valid;
}
