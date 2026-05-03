import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { readUserProfileSync, writeAppConfig } from './appConfig';
import { CommentNotFoundError, deleteComment, editComment, listComments, writeComment } from './comments';
import {
  getWorkspaceRoot,
  getWorkspaceRootSource,
  listArchivedTickets,
  listTickets,
  readTicketDetail,
  readTicketPlan,
  scanProjects,
  tasksDir,
} from './fs';
import { readBoardConfig, validateBoardColumns, writeBoardConfig } from './boardConfig';
import { HttpError, parseJsonBody, requirePositiveIntParam, requireProjectConfig, requireTicketNumber } from './routeHelpers';
import type { CreateCommentRequest, EditCommentRequest, CreateTicketRequest, TicketType, UpdateTicketRequest } from './types';
import {
  archiveDoneTickets,
  archiveTicket,
  createTicket,
  markEpicDone,
  unarchiveTicket,
  updateTicket,
} from './writeFs';
import { deleteToken, readToken, tokenExists, writeToken } from './githubToken';
import { mergePullRequest } from './githubMerge';

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
  const user = readUserProfileSync();
  return c.json({ configured: workspaceRoot !== null, workspaceRoot, source, user });
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

app.get('/api/github-token', async (c) => {
  return c.json({ configured: await tokenExists() });
});

app.put('/api/github-token', async (c) => {
  const body = await parseJsonBody(c);
  const token = (body as { token?: unknown })?.token;
  if (typeof token !== 'string' || token.length === 0) {
    return c.json({ error: 'token must be a non-empty string' }, 400);
  }
  await writeToken(token);
  return c.json({ configured: true });
});

app.delete('/api/github-token', async (c) => {
  await deleteToken();
  return c.json({ configured: false });
});

app.post('/api/github/merge', async (c) => {
  const body = await parseJsonBody(c);
  const b = body as { owner?: unknown; repo?: unknown; pullNumber?: unknown; mergeMethod?: unknown };
  if (typeof b.owner !== 'string' || b.owner.length === 0) {
    return c.json({ error: 'owner must be a non-empty string' }, 400);
  }
  if (typeof b.repo !== 'string' || b.repo.length === 0) {
    return c.json({ error: 'repo must be a non-empty string' }, 400);
  }
  if (typeof b.pullNumber !== 'number' || !Number.isInteger(b.pullNumber) || b.pullNumber <= 0) {
    return c.json({ error: 'pullNumber must be a positive integer' }, 400);
  }
  const mergeMethod = b.mergeMethod as 'squash' | 'rebase' | 'merge' | undefined;
  if (mergeMethod !== undefined && !['squash', 'rebase', 'merge'].includes(mergeMethod)) {
    return c.json({ error: 'mergeMethod must be squash, rebase, or merge' }, 400);
  }
  const token = await readToken();
  const result = await mergePullRequest(
    { owner: b.owner, repo: b.repo, pullNumber: b.pullNumber, mergeMethod },
    { token },
  );
  if (!result.ok) {
    return c.json(result.envelope, result.status as Parameters<typeof c.json>[1]);
  }
  return c.json({ sha: result.sha, merged: true });
});

app.get('/api/projects', async (c) => {
  const projects = await scanProjects();
  return c.json(projects);
});

app.get('/api/projects/:name/board-config', async (c) => {
  const name = c.req.param('name');
  await requireProjectConfig(name);
  const columns = await readBoardConfig(name);
  return c.json({ columns });
});

app.put('/api/projects/:name/board-config', async (c) => {
  const name = c.req.param('name');
  await requireProjectConfig(name);
  const body = await parseJsonBody(c);
  const v = validateBoardColumns((body as { columns?: unknown })?.columns);
  if (!v.ok) return c.json({ error: v.error }, 400);
  const columns = await writeBoardConfig(name, v.columns);
  return c.json({ columns });
});

app.get('/api/projects/:name/tickets', async (c) => {
  const name = c.req.param('name');
  const typeParam = c.req.query('type');
  const epicParam = c.req.query('epic');
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
  if (epicParam !== undefined) {
    const epicNum = Number(epicParam);
    if (Number.isInteger(epicNum) && epicNum > 0) {
      tickets = tickets.filter((t) => t.epic === epicNum);
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

app.get('/api/projects/:name/tickets/:number/comments', async (c) => {
  const name = c.req.param('name');
  const n = requireTicketNumber(c.req.param('number'));
  await requireProjectConfig(name);
  const comments = await listComments(name, n);
  return c.json(comments);
});

app.post('/api/projects/:name/tickets/:number/comments', async (c) => {
  const name = c.req.param('name');
  const n = requireTicketNumber(c.req.param('number'));
  const { prefix } = await requireProjectConfig(name);
  const body = await parseJsonBody<CreateCommentRequest>(c);

  if (typeof body.body !== 'string' || body.body.length === 0) {
    return c.json({ error: 'body must be a non-empty string' }, 400);
  }

  let resolvedAuthor: { username: string; display_name: string };
  if (body.author === undefined || body.author === null) {
    const fallback = readUserProfileSync();
    if (!fallback) {
      return c.json({ error: 'No author provided and no default user configured' }, 400);
    }
    resolvedAuthor = { username: fallback.username, display_name: fallback.display_name };
  } else if (typeof body.author !== 'object' || Array.isArray(body.author)) {
    return c.json({ error: 'author must be an object with username and display_name' }, 400);
  } else {
    if (typeof body.author.username !== 'string' || body.author.username.length === 0) {
      return c.json({ error: 'author.username must be a non-empty string' }, 400);
    }
    if (typeof body.author.display_name !== 'string' || body.author.display_name.length === 0) {
      return c.json({ error: 'author.display_name must be a non-empty string' }, 400);
    }
    resolvedAuthor = { username: body.author.username, display_name: body.author.display_name };
  }

  try {
    await stat(path.join(tasksDir(name), `${n}.md`));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return c.json({ error: `Ticket ${prefix}-${n} not found` }, 404);
    }
    throw err;
  }

  const result = await writeComment(name, n, {
    author: resolvedAuthor.username,
    displayName: resolvedAuthor.display_name,
    body: body.body,
  });
  return c.json(result, 201);
});

app.patch('/api/projects/:name/tickets/:number/comments/:n', async (c) => {
  const name = c.req.param('name');
  const ticketN = requireTicketNumber(c.req.param('number'));
  const commentN = requirePositiveIntParam(c.req.param('n'));
  const { prefix } = await requireProjectConfig(name);
  const body = await parseJsonBody<EditCommentRequest>(c);

  if (typeof body.body !== 'string' || body.body.trim().length === 0) {
    return c.json({ error: 'body must be a non-empty string' }, 400);
  }

  try {
    const result = await editComment(name, ticketN, commentN, body.body);
    return c.json(result);
  } catch (err) {
    if (err instanceof CommentNotFoundError) {
      return c.json({ error: `Comment ${commentN} not found on ticket ${prefix}-${ticketN}` }, 404);
    }
    throw err;
  }
});

app.delete('/api/projects/:name/tickets/:number/comments/:n', async (c) => {
  const name = c.req.param('name');
  const ticketN = requireTicketNumber(c.req.param('number'));
  const commentN = requirePositiveIntParam(c.req.param('n'));
  const { prefix } = await requireProjectConfig(name);
  try {
    await deleteComment(name, ticketN, commentN);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof CommentNotFoundError) {
      return c.json({ error: `Comment ${commentN} not found on ticket ${prefix}-${ticketN}` }, 404);
    }
    throw err;
  }
});

export { app };
export default app;
