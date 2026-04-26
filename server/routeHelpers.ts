import type { Context } from 'hono';
import { readProjectConfig } from './fs';

export class HttpError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>) {
    super(typeof payload.error === 'string' ? payload.error : 'HTTP error');
    this.name = 'HttpError';
    this.status = status;
    this.payload = payload;
  }
}

export async function requireProjectConfig(name: string): Promise<{ prefix: string }> {
  const { config } = await readProjectConfig(name);
  if (!config || !config.prefix) {
    throw new HttpError(400, { error: 'Project has no prefix configured' });
  }
  return { prefix: config.prefix };
}

export function requireTicketNumber(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, { error: 'Invalid ticket number' });
  }
  return n;
}

export function requirePositiveIntParam(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, { error: 'Invalid parameter: expected a positive integer' });
  }
  return n;
}

export async function parseJsonBody<T = unknown>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new HttpError(400, { error: 'Invalid JSON body' });
  }
}
