import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { app } from './index';

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: true };

async function dispatch(path: string, init?: RequestInit): Promise<ToolResult> {
  const res = await app.request(path, init);
  const text = await res.text();
  return res.ok
    ? { content: [{ type: 'text', text }] }
    : { content: [{ type: 'text', text }], isError: true };
}

const TicketState = z.enum([
  'NOT_READY',
  'PLANNING',
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'WONT_DO',
]);

const TicketType = z.enum(['Task', 'Epic', 'Bug']);

// Exported handlers allow tests to exercise tools without booting stdio.

export async function listProjectsHandler(): Promise<ToolResult> {
  return dispatch('/api/projects');
}

export async function listTicketsHandler(args: {
  project: string;
  type?: 'Task' | 'Epic' | 'Bug';
  epic?: number;
}): Promise<ToolResult> {
  const params = new URLSearchParams();
  if (args.type) params.set('type', args.type);
  if (args.epic !== undefined) params.set('epic', String(args.epic));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return dispatch(`/api/projects/${encodeURIComponent(args.project)}/tickets${qs}`);
}

export async function getTicketHandler(args: {
  project: string;
  number: number;
}): Promise<ToolResult> {
  return dispatch(
    `/api/projects/${encodeURIComponent(args.project)}/tickets/${args.number}`,
  );
}

export async function createTicketHandler(args: {
  project: string;
  type: 'Task' | 'Epic' | 'Bug';
  title: string;
  state?: string;
  epic?: number;
  body?: string;
  wont_do_reason?: string;
}): Promise<ToolResult> {
  const { project, ...payload } = args;
  return dispatch(`/api/projects/${encodeURIComponent(project)}/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function patchTicketHandler(args: {
  project: string;
  number: number;
  title?: string;
  state?: string;
  type?: string;
  epic?: number | null;
  body?: string;
  plan_doc?: string | null;
  color?: string | null;
  branch?: string | null;
  pr?: string;
  wont_do_reason?: string | null;
  resolution?: 'VIBED' | 'PLANNED' | 'MANUAL' | null;
  is_reviewed?: boolean | null;
}): Promise<ToolResult> {
  const { project, number, ...payload } = args;
  return dispatch(
    `/api/projects/${encodeURIComponent(project)}/tickets/${number}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
}

export async function getTicketByIdHandler(args: {
  displayId: string;
}): Promise<ToolResult> {
  return dispatch(`/api/tickets/by-id/${encodeURIComponent(args.displayId)}`);
}

export async function archiveTicketHandler(args: {
  project: string;
  number: number;
}): Promise<ToolResult> {
  return dispatch(
    `/api/projects/${encodeURIComponent(args.project)}/tickets/${args.number}/archive`,
    { method: 'POST' },
  );
}

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'ratatoskr', version: '0.1.0' });

  server.tool('list_projects', async () => listProjectsHandler());

  server.tool(
    'list_tickets',
    {
      project: z.string(),
      type: TicketType.optional(),
      epic: z.number().int().positive().optional(),
    },
    async (args) => listTicketsHandler(args),
  );

  server.tool(
    'get_ticket',
    { project: z.string(), number: z.number().int().positive() },
    async (args) => getTicketHandler(args),
  );

  server.tool(
    'get_ticket_by_id',
    { displayId: z.string().min(1) },
    async (args) => getTicketByIdHandler(args),
  );

  server.tool(
    'create_ticket',
    {
      project: z.string(),
      type: TicketType,
      title: z.string().min(1),
      state: TicketState.optional(),
      epic: z.number().int().positive().optional(),
      body: z.string().optional(),
      wont_do_reason: z.string().optional(),
    },
    async (args) => createTicketHandler(args),
  );

  server.tool(
    'patch_ticket',
    {
      project: z.string(),
      number: z.number().int().positive(),
      title: z.string().optional(),
      state: TicketState.optional(),
      type: TicketType.optional(),
      epic: z.number().int().positive().nullable().optional(),
      body: z.string().optional(),
      plan_doc: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      branch: z.string().nullable().optional(),
      pr: z.string().optional(),
      wont_do_reason: z.string().nullable().optional(),
      resolution: z.enum(['VIBED', 'PLANNED', 'MANUAL']).nullable().optional(),
      is_reviewed: z.boolean().nullable().optional(),
    },
    async (args) => patchTicketHandler(args),
  );

  server.tool(
    'archive_ticket',
    { project: z.string(), number: z.number().int().positive() },
    async (args) => archiveTicketHandler(args),
  );

  return server;
}

// Only boot stdio when run as the entry point (guards against test imports).
if (import.meta.main) {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
