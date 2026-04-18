import { Hono } from 'hono';
import { listTickets, readProjectConfig, scanProjects } from './fs';

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

export default app;
