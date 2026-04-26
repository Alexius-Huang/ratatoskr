import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { readAppConfigSync } from './appConfig';
import { fetchPullRequest, parsePrPath } from './github';
import type { PrPathParts } from './github';
import type {
  ArchivedTicketRecord,
  PlanResult,
  ProjectSummary,
  PullRequestInfo,
  RatatoskrConfig,
  TicketDetail,
  TicketState,
  TicketSummary,
  TicketType,
} from './types';

export const _gh = { fetchPullRequest };

export function getWorkspaceRoot(): string | null {
  const fromEnv = process.env.RATATOSKR_WORKSPACE_ROOT;
  if (fromEnv) return fromEnv;
  const fromConfig = readAppConfigSync();
  if (fromConfig) return fromConfig.workspaceRoot;
  return null;
}

export function getWorkspaceRootSource(): 'env' | 'file' | null {
  if (process.env.RATATOSKR_WORKSPACE_ROOT) return 'env';
  if (readAppConfigSync()) return 'file';
  return null;
}

export async function readProjectConfig(projectName: string): Promise<{
  config: RatatoskrConfig | null;
  hasConfig: boolean;
  warnings: string[];
}> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    return { config: null, hasConfig: false, warnings: ['Workspace not configured'] };
  }
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
  if (!workspaceRoot) return [];
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

export const TICKET_FILENAME_RE = /^(\d+)\.md$/;

const TICKET_TYPES: readonly TicketType[] = ['Task', 'Epic', 'Bug'];
export const TICKET_STATES: readonly TicketState[] = [
  'NOT_READY',
  'PLANNING',
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'WONT_DO',
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

export function metaRoot(projectName: string): string {
  const root = getWorkspaceRoot();
  if (!root) throw new Error('Workspace root not configured');
  return path.join(root, 'projects', projectName, '.meta', 'ratatoskr');
}

export function tasksDir(projectName: string): string {
  return path.join(metaRoot(projectName), 'tasks');
}

export function archiveDir(projectName: string): string {
  return path.join(metaRoot(projectName), 'archive');
}

export async function parseTicketFileRaw(
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

  const isDisplayId = (p: unknown): p is string =>
    typeof p === 'string' && /^[A-Z]+-\d+$/.test(p);

  const summary: TicketSummary = {
    number: num,
    displayId: `${prefix}-${num}`,
    type: fm.type,
    title: fm.title,
    state: fm.state,
    created,
    updated,
    blocks: Array.isArray(fm.blocks) ? fm.blocks.filter(isDisplayId) : [],
    blockedBy: Array.isArray(fm.blocked_by) ? fm.blocked_by.filter(isDisplayId) : [],
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

  if (fm.type === 'Epic' && typeof fm.color === 'string' && /^#[0-9a-f]{6}$/i.test(fm.color)) {
    summary.color = fm.color;
  }

  if (typeof fm.branch === 'string' && fm.branch.length > 0) {
    summary.branch = fm.branch;
  }

  if (Array.isArray(fm.prs)) {
    const valid = fm.prs.filter((p): p is string => typeof p === 'string' && p.length > 0);
    if (valid.length > 0) summary.prs = valid;
  }

  if (fm.state === 'WONT_DO' && typeof fm.wont_do_reason === 'string' && fm.wont_do_reason.length > 0) {
    summary.wontDoReason = fm.wont_do_reason;
  }

  if (
    typeof fm.resolution === 'string' &&
    (fm.resolution === 'VIBED' || fm.resolution === 'PLANNED' || fm.resolution === 'MANUAL')
  ) {
    summary.resolution = fm.resolution;
  }

  if (typeof fm.is_reviewed === 'boolean') {
    summary.isReviewed = fm.is_reviewed;
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
      if (epicRaw.summary.color) raw.summary.epicColor = epicRaw.summary.color;
    }
  }

  let pullRequests: PullRequestInfo[] | undefined;
  if (raw.summary.prs && raw.summary.prs.length > 0) {
    const { config } = await readProjectConfig(projectName);
    const fallback = config?.github_repo;
    const parts = raw.summary.prs
      .map((p) => parsePrPath(p, fallback))
      .filter((x): x is PrPathParts => x !== null);
    const results = await Promise.all(parts.map((p) => _gh.fetchPullRequest(p)));
    const enriched = results.filter((r): r is PullRequestInfo => r !== null);
    if (enriched.length > 0) pullRequests = enriched;
  }

  return {
    ...raw.summary,
    body: stripLeadingH1(raw.content),
    ...(pullRequests ? { pullRequests } : {}),
  };
}

export async function readTicketPlan(
  projectName: string,
  num: number,
  prefix: string,
): Promise<PlanResult> {
  const ticketPath = path.join(tasksDir(projectName), `${num}.md`);
  const raw = await parseTicketFileRaw(ticketPath, num, prefix);
  if (!raw) return { ok: false, reason: 'ticket-not-found' };
  const planRel = raw.summary.planDoc;
  if (!planRel) return { ok: false, reason: 'no-plan-doc' };

  const root = metaRoot(projectName);
  const absPlan = path.resolve(root, planRel);
  if (absPlan !== root && !absPlan.startsWith(root + path.sep)) {
    console.warn(
      `[plan] refused out-of-scope plan path for ${raw.summary.displayId}: ${planRel}`,
    );
    return { ok: false, reason: 'out-of-scope' };
  }

  let body: string;
  try {
    body = await readFile(absPlan, 'utf8');
  } catch (err) {
    console.warn(`[plan] could not read plan file ${absPlan}`, err);
    return { ok: false, reason: 'file-not-found' };
  }

  return { ok: true, data: { path: planRel, body } };
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
  const epicColors = new Map<number, string>();
  for (const t of valid) {
    if (t.type === 'Epic') {
      epicIds.add(t.number);
      epicTitles.set(t.number, t.title);
      if (t.color) epicColors.set(t.number, t.color);
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
      const color = epicColors.get(t.epic);
      if (color !== undefined) t.epicColor = color;
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

  // Also count archived tickets so DONE work is not invisible in epic progress.
  const archivedPath = archiveDir(projectName);
  let archivedEntries: import('node:fs').Dirent[] = [];
  try {
    archivedEntries = await readdir(archivedPath, { withFileTypes: true });
  } catch {
    // archive dir may not exist yet
  }
  const archivedNums = archivedEntries
    .filter((e) => e.isFile())
    .flatMap((e) => {
      const m = e.name.match(TICKET_FILENAME_RE);
      return m ? [Number(m[1])] : [];
    });
  await Promise.all(
    archivedNums.map(async (num) => {
      const fp = path.join(archivedPath, `${num}.md`);
      const summary = await parseTicketFile(fp, num, prefix);
      if (!summary) return;
      if ((summary.type !== 'Task' && summary.type !== 'Bug') || summary.epic === undefined) return;
      let bucket = childCountsByEpic.get(summary.epic);
      if (!bucket) {
        bucket = emptyStateCounts();
        childCountsByEpic.set(summary.epic, bucket);
      }
      bucket[summary.state] += 1;
    }),
  );

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
    WONT_DO: 0,
  };
}

export async function listArchivedTickets(
  projectName: string,
  prefix: string,
): Promise<ArchivedTicketRecord[]> {
  const dir = archiveDir(projectName);

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
      console.warn(`[archive] Skipping non-numeric filename: ${entry.name}`);
      continue;
    }
    candidates.push({ name: entry.name, num: Number(match[1]) });
  }

  const records: ArchivedTicketRecord[] = [];

  await Promise.all(
    candidates.map(async ({ name, num }) => {
      const filePath = path.join(dir, name);
      let raw: string;
      try {
        raw = await readFile(filePath, 'utf8');
      } catch {
        console.warn(`[archive] Could not read ${filePath}`);
        return;
      }

      let parsed;
      try {
        parsed = matter(raw);
      } catch (err) {
        console.warn(`[archive] Frontmatter parse failed: ${filePath}`, err);
        return;
      }

      const result = await parseTicketFileRaw(filePath, num, prefix);
      if (!result) return;

      const fm = parsed.data as Record<string, unknown>;
      const archived = coerceIsoString(fm.archived);
      if (!archived) {
        console.warn(`[archive] Missing/invalid 'archived' field in ${filePath}`);
        return;
      }

      records.push({
        ...result.summary,
        archived,
        body: stripLeadingH1(result.content),
      });
    }),
  );

  records.sort((a, b) => b.archived.localeCompare(a.archived));
  return records;
}
