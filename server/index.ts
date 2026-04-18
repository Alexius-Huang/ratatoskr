import { Hono } from 'hono';
import {
  listTickets,
  readProjectConfig,
  readTicketDetail,
  scanProjects,
} from './fs';

const app = new Hono();

app.get('/api/projects', async (c) => {
  const projects = await scanProjects();
  return c.json(projects);
});

app.get('/api/projects/:name/tickets', async (c) => {
  const name = c.req.param('name');
  const typeFilter = c.req.query('type');
  const { config } = await readProjectConfig(name);
  if (!config || !config.prefix) {
    return c.json({ error: 'Project has no prefix configured' }, 400);
  }
  let tickets = await listTickets(name, config.prefix);
  if (typeFilter === 'Task' || typeFilter === 'Epic') {
    tickets = tickets.filter((t) => t.type === typeFilter);
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

export default app;
