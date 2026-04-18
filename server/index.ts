import { Hono } from 'hono';
import { scanProjects } from './fs';

const app = new Hono();

app.get('/api/projects', async (c) => {
  const projects = await scanProjects();
  return c.json(projects);
});

export default app;
