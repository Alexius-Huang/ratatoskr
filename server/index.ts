import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { writeAppConfig } from './appConfig';
import {
  getWorkspaceRoot,
  getWorkspaceRootSource,
  listArchivedTickets,
  listTickets,
  readTicketDetail,
  readTicketPlan,
  scanProjects,
} from './fs';
import { HttpError, parseJsonBody, requireProjectConfig, requireTicketNumber } from './routeHelpers';
import type { CreateTicketRequest, TicketType, UpdateTicketRequest } from './types';
import {
  archiveDoneTickets,
  archiveTicket,
  createTicket,
  markEpicDone,
  unarchiveTicket,
  updateTicket,
} from './writeFs';

const VALID_TYPES: readonly TicketType[] = ['Task', 'Epic', 'Bug'];

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json(err.payload, err.status as Parameters<typeof c.json>[1]);
  }
  throw err;
});

app.get('/api/config', (c) => {
  const workspaceRoot = getWorkspaceRoot();
  const source = getWorkspaceRootSource();
  return c.json({ configured: workspaceRoot !== null, workspaceRoot, source });
});

app.put('/api/config', async (c) => {
  const body = await parseJsonBody(c);
  const candidate = (body as { workspaceRoot?: unknown })?.workspaceRoot;
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return c.json({ error: 'workspaceRoot must be a non-empty string' }, 400);
  }
  if (!path.isAbsolute(candidate)) {
    return c.json({ error: 'workspaceRoot must be an absolute path' }, 400);
  }
  try {
    const s = await stat(candidate);
    if (!s.isDirectory()) return c.json({ error: 'Path is not an existing directory' }, 400);
  } catch {
    return c.json({ error: 'Path is not an existing directory' }, 400);
  }
  writeAppConfig({ workspaceRoot: candidate });
  return c.json({ configured: true, workspaceRoot: candidate, source: getWorkspaceRootSource() });
});

app.get('/api/projects', async (c) => {
  const projects = await scanProjects();
  return c.json(projects);
});

app.get('/api/projects/:name/tickets', async (c) => {
  const name = c.req.param('name');
  const typeParam = c.req.query('type');
  const { prefix } = await requireProjectConfig(name);
  let tickets = await listTickets(name, prefix);
  if (typeParam) {
    const allowed = new Set<TicketType>(
      typeParam
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is TicketType =>
          (VALID_TYPES as readonly string[]).includes(s),
        ),
    );
    if (allowed.size > 0) {
      tickets = tickets.filter((t) => allowed.has(t.type));
    }
  }
  return c.json(tickets);
});

app.get('/api/projects/:name/tickets/:number', async (c) => {
  const name = c.req.param('name');
  const n = requireTicketNumber(c.req.param('number'));
  const { prefix } = await requireProjectConfig(name);
  const detail = await readTicketDetail(name, n, prefix);
  if (!detail) return c.json({ error: `Ticket ${prefix}-${n} not found` }, 404);
  return c.json(detail);
});

app.get('/api/projects/:name/tickets/:number/plan', async (c) => {
  const name = c.req.param('name');
  const n = requireTicketNumber(c.req.param('number'));
  const { prefix } = await requireProjectConfig(name);
  const result = await readTicketPlan(name, n, prefix);
  if (!result.ok) {
    switch (result.reason) {
      case 'ticket-not-found':
        return c.json({ error: `Ticket ${prefix}-${n} not found` }, 404);
      case 'no-plan-doc':
        return c.json({ error: 'Ticket has no plan_doc' }, 404);
      case 'out-of-scope':
        return c.json({ error: 'Plan path escapes project' }, 400);
      case 'file-not-found':
        return c.json({ error: 'Plan file not found' }, 404);
    }
  }
  return c.json(result.data);
});

app.get('/api/tickets/by-id/:displayId', async (c) => {
  const raw = c.req.param('displayId');
  const match = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/.exec(raw);
  if (!match) {
    return c.json(
      { error: `Invalid displayId: '${raw}'. Expected '{prefix}-{number}' (e.g. RAT-76).` },
      400,
    );
  }
  const [, prefixRaw, numStr] = match;
  const prefix = prefixRaw.toUpperCase();
  const number = Number(numStr);

  const projects = await scanProjects();
  const project = projects.find(
    (p) => p.config?.prefix?.toUpperCase() === prefix,
  );
  if (!project || !project.config) {
    return c.json({ error: `No project found for prefix '${prefix}'.` }, 404);
  }

  const detail = await readTicketDetail(project.name, number, project.config.prefix);
  if (!detail) {
    return c.json({ error: `Ticket ${prefix}-${number} not found.` }, 404);
  }
  return c.json({ ...detail, project: project.name });
});

app.get('/api/projects/:name/archive', async (c) => {
  const name = c.req.param('name');
  const { prefix } = await requireProjectConfig(name);
  return c.json(await listArchivedTickets(name, prefix));
});

app.post('/api/projects/:name/tickets/archive-done', async (c) => {
  const name = c.req.param('name');
  const { prefix } = await requireProjectConfig(name);
  const result = await archiveDoneTickets(name, prefix);
  if (!result.ok) return c.json({ error: result.error.message }, 400);
  return c.json(result.data);
});

app.post('/api/projects/:name/tickets', async (c) => {
  const name = c.req.param('name');
  const { prefix } = await requireProjectConfig(name);
  const body = await parseJsonBody(c);
  const result = await createTicket(name, prefix, body as CreateTicketRequest);
  if (!result.ok) {
    const status = result.error.kind === 'not-found' ? 404 : 400;
    return c.json({ error: result.error.message }, status);
  }
  return c.json(result.data, 201);
});

app.patch('/api/projects/:name/tickets/:number', async (c) => {
  const name = c.req.param('name');
  const n = requireTicketNumber(c.req.param('number'));
  const { prefix } = await requireProjectConfig(name);
  const body = await parseJsonBody(c);
  const result = await updateTicket(name, prefix, n, body as UpdateTicketRequest);
  if (!result.ok) {
    const status = result.error.kind === 'not-found' ? 404 : 400;
    return c.json({ error: result.error.message }, status);
  }
  return c.json(result.data);
});

app.post('/api/projects/:name/tickets/:number/archive', async (c) => {
  const name = c.req.param('name');
  const n = requireTicketNumber(c.req.param('number'));
  const { prefix } = await requireProjectConfig(name);
  const result = await archiveTicket(name, prefix, n);
  if (!result.ok) {
    if (result.error.kind === 'not-found') {
      return c.json({ error: result.error.message }, 404);
    }
    if (result.error.kind === 'epic-guard-violated') {
      return c.json({ error: result.error.message, blockers: result.error.blockers }, 409);
    }
    return c.json({ error: result.error.message }, 400);
  }
  return c.json({ ok: true });
});

app.post('/api/projects/:name/tickets/:number/mark-epic-done', async (c) => {
  const name = c.req.param('name');
  const n = requireTicketNumber(c.req.param('number'));
  const { prefix } = await requireProjectConfig(name);
  const result = await markEpicDone(name, prefix, n);
  if (!result.ok) {
    const status = result.error.kind === 'not-found' ? 404 : 400;
    return c.json({ error: result.error.message }, status);
  }
  return c.json(result.data);
});

app.post('/api/projects/:name/archive/:number/unarchive', async (c) => {
  const name = c.req.param('name');
  const n = requireTicketNumber(c.req.param('number'));
  const { prefix } = await requireProjectConfig(name);
  const result = await unarchiveTicket(name, prefix, n);
  if (!result.ok) {
    if (result.error.kind === 'not-found') {
      return c.json({ error: result.error.message }, 404);
    }
    if (result.error.kind === 'already-exists') {
      return c.json({ error: result.error.message }, 409);
    }
    return c.json({ error: result.error.message }, 400);
  }
  return c.json({ ok: true });
});

export { app };
export default app;
