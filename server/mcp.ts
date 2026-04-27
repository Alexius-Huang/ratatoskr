import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { app } from './index';
import { getWorkspaceRoot, readProjectConfig } from './fs';
import { _runner } from './github';
import { updateTicket } from './writeFs';
import type { TicketResolution } from './types';

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: true };

async function dispatch(url: string, init?: RequestInit): Promise<ToolResult> {
  const res = await app.request(url, init);
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
  blocks?: string[] | null;
  blocked_by?: string[] | null;
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

export async function addCommentHandler(args: {
  project: string;
  number: number;
  body: string;
  author?: { username: string; display_name: string };
}): Promise<ToolResult> {
  const { project, number, ...payload } = args;
  return dispatch(
    `/api/projects/${encodeURIComponent(project)}/tickets/${number}/comments`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
}

export async function editCommentHandler(args: {
  project: string;
  number: number;
  n: number;
  body: string;
}): Promise<ToolResult> {
  const { project, number, n, body } = args;
  return dispatch(
    `/api/projects/${encodeURIComponent(project)}/tickets/${number}/comments/${n}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    },
  );
}

export async function deleteCommentHandler(args: {
  project: string;
  number: number;
  n: number;
}): Promise<ToolResult> {
  const { project, number, n } = args;
  return dispatch(
    `/api/projects/${encodeURIComponent(project)}/tickets/${number}/comments/${n}`,
    { method: 'DELETE' },
  );
}

function errorResult(message: string, extra?: Record<string, string>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message, ...extra }) }],
    isError: true,
  };
}

export async function shipTicketPrHandler(args: {
  project: string;
  number: number;
  title: string;
  body: string;
  merge_branch?: string;
  resolution?: TicketResolution;
}): Promise<ToolResult> {
  const root = getWorkspaceRoot();
  if (!root) return errorResult('Workspace root not configured');
  const { config } = await readProjectConfig(args.project);
  if (!config?.prefix) return errorResult(`Project '${args.project}' has no config.prefix`);
  const projectDir = path.join(root, 'projects', args.project);

  const created = await _runner.runGhPrCreate({
    cwd: projectDir,
    title: args.title,
    body: args.body,
    mergeBranch: args.merge_branch,
  });

  let prUrl: string;
  if (created.kind === 'created') {
    prUrl = created.url;
  } else if (created.kind === 'already-exists') {
    const branch = await _runner.getCurrentBranch(projectDir);
    if (!branch) {
      return errorResult(
        'gh pr create reported "already exists" but current branch could not be determined',
      );
    }
    const existing = await _runner.runGhPrList({ cwd: projectDir, branch });
    if (!existing) {
      return errorResult(
        `gh pr create reported "already exists" but no PR found for branch ${branch}`,
      );
    }
    prUrl = existing.url;
  } else {
    return errorResult(`gh pr create failed: ${created.stderr}`, {
      stdout: created.stdout,
      stderr: created.stderr,
    });
  }

  const urlMatch = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(prUrl);
  if (!urlMatch) return errorResult(`Could not parse PR URL: ${prUrl}`);
  const [, owner, repo, numStr] = urlMatch;
  const prPath = `${owner}/${repo}/pull/${numStr}`;
  const prNumber = Number(numStr);

  const patchPayload: Parameters<typeof updateTicket>[3] = {
    pr: prPath,
    state: 'IN_REVIEW',
  };
  if (args.resolution !== undefined) {
    patchPayload.resolution = args.resolution;
  }

  const update = await updateTicket(args.project, config.prefix, args.number, patchPayload);

  if (!update.ok) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'PR created but ticket PATCH failed',
            pr_path: prPath,
            pr_url: prUrl,
            pr_number: prNumber,
            ticket_error: update.error.message,
          }),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          pr_path: prPath,
          pr_url: prUrl,
          pr_number: prNumber,
          ticket: update.data,
        }),
      },
    ],
  };
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
      blocks: z.array(z.string()).nullable().optional(),
      blocked_by: z.array(z.string()).nullable().optional(),
    },
    async (args) => patchTicketHandler(args),
  );

  server.tool(
    'archive_ticket',
    { project: z.string(), number: z.number().int().positive() },
    async (args) => archiveTicketHandler(args),
  );

  server.tool(
    'add_comment',
    {
      project: z.string(),
      number: z.number().int().positive(),
      body: z.string().min(1),
      author: z
        .object({
          username: z.string().min(1),
          display_name: z.string().min(1),
        })
        .optional(),
    },
    async (args) => addCommentHandler(args),
  );

  server.tool(
    'edit_comment',
    {
      project: z.string(),
      number: z.number().int().positive(),
      n: z.number().int().positive(),
      body: z.string().min(1),
    },
    async (args) => editCommentHandler(args),
  );

  server.tool(
    'delete_comment',
    {
      project: z.string(),
      number: z.number().int().positive(),
      n: z.number().int().positive(),
    },
    async (args) => deleteCommentHandler(args),
  );

  server.tool(
    'ship_ticket_pr',
    {
      project: z.string(),
      number: z.number().int().positive(),
      title: z.string().min(1),
      body: z.string(),
      merge_branch: z.string().optional(),
      resolution: z.enum(['PLANNED', 'VIBED', 'MANUAL']).optional(),
    },
    async (args) => shipTicketPrHandler(args),
  );

  return server;
}

// Only boot stdio when run as the entry point (guards against test imports).
if (import.meta.main) {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
