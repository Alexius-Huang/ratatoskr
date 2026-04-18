import { Hono } from 'hono';
import {
  listArchivedTickets,
  listTickets,
  readProjectConfig,
  readTicketDetail,
  readTicketPlan,
  scanProjects,
} from './fs';
import type { TicketType } from './types';

const VALID_TYPES: readonly TicketType[] = ['Task', 'Epic', 'Bug'];

const app = new Hono();

app.get('/api/projects', async (c) => {
  const projects = await scanProjects();
  return c.json(projects);
});

app.get('/api/projects/:name/tickets', async (c) => {
  const name = c.req.param('name');
  const typeParam = c.req.query('type');
  const { config } = await readProjectConfig(name);
  if (!config || !config.prefix) {
    return c.json({ error: 'Project has no prefix configured' }, 400);
  }
  let tickets = await listTickets(name, config.prefix);
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
  const numberParam = c.req.param('number');
  const n = Number(numberParam);
  if (!Number.isInteger(n) || n <= 0) {
    return c.json({ error: 'Invalid ticket number' }, 400);
  }
  const { config } = await readProjectConfig(name);
  if (!config || !config.prefix) {
    return c.json({ error: 'Project has no prefix configured' }, 400);
  }
  const detail = await readTicketDetail(name, n, config.prefix);
  if (!detail) {
    return c.json({ error: `Ticket ${config.prefix}-${n} not found` }, 404);
  }
  return c.json(detail);
});

app.get('/api/projects/:name/tickets/:number/plan', async (c) => {
  const name = c.req.param('name');
  const numberParam = c.req.param('number');
  const n = Number(numberParam);
  if (!Number.isInteger(n) || n <= 0) {
    return c.json({ error: 'Invalid ticket number' }, 400);
  }
  const { config } = await readProjectConfig(name);
  if (!config || !config.prefix) {
    return c.json({ error: 'Project has no prefix configured' }, 400);
  }
  const result = await readTicketPlan(name, n, config.prefix);
  if (!result.ok) {
    switch (result.reason) {
      case 'ticket-not-found':
        return c.json({ error: `Ticket ${config.prefix}-${n} not found` }, 404);
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

app.get('/api/projects/:name/archive', async (c) => {
  const name = c.req.param('name');
  const { config } = await readProjectConfig(name);
  if (!config || !config.prefix) {
    return c.json({ error: 'Project has no prefix configured' }, 400);
  }
  return c.json(await listArchivedTickets(name, config.prefix));
});

export default app;
