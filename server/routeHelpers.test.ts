// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpError, parseJsonBody, requireProjectConfig, requireTicketNumber } from './routeHelpers';

describe('HttpError', () => {
  it('should carry status and payload as readonly properties', () => {
    const err = new HttpError(400, { error: 'Bad request' });
    expect(err.status).toBe(400);
    expect(err.payload).toEqual({ error: 'Bad request' });
  });

  it('should use the payload.error string as the standard Error message when present', () => {
    const err = new HttpError(400, { error: 'Something went wrong' });
    expect(err.message).toBe('Something went wrong');
    expect(err.name).toBe('HttpError');
  });

  it('should fall back to "HTTP error" as message when payload has no string error field', () => {
    const err = new HttpError(500, { code: 42 });
    expect(err.message).toBe('HTTP error');
  });
});

describe('requireTicketNumber', () => {
  it('should return a positive integer when given a valid numeric string', () => {
    expect(requireTicketNumber('5')).toBe(5);
    expect(requireTicketNumber('100')).toBe(100);
  });

  it('should throw HttpError(400, "Invalid ticket number") when input is zero', () => {
    expect(() => requireTicketNumber('0')).toThrow(HttpError);
    expect(() => requireTicketNumber('0')).toThrow('Invalid ticket number');
  });

  it('should throw HttpError(400, "Invalid ticket number") when input is negative', () => {
    expect(() => requireTicketNumber('-1')).toThrow(HttpError);
    expect(() => requireTicketNumber('-1')).toThrow('Invalid ticket number');
  });

  it('should throw HttpError(400, "Invalid ticket number") when input is non-numeric ("abc")', () => {
    expect(() => requireTicketNumber('abc')).toThrow(HttpError);
    expect(() => requireTicketNumber('abc')).toThrow('Invalid ticket number');
  });

  it('should throw HttpError(400, "Invalid ticket number") when input is a fractional number ("1.5")', () => {
    expect(() => requireTicketNumber('1.5')).toThrow(HttpError);
    expect(() => requireTicketNumber('1.5')).toThrow('Invalid ticket number');
  });
});

describe('requireProjectConfig', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'rat-helpers-test-'));
    process.env.RATATOSKR_WORKSPACE_ROOT = tmpRoot;
  });

  afterEach(async () => {
    delete process.env.RATATOSKR_WORKSPACE_ROOT;
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it('should return { prefix } when the project has a valid config.json with a prefix', async () => {
    const configDir = path.join(tmpRoot, 'projects', 'myproject', '.meta', 'ratatoskr');
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, 'config.json'),
      JSON.stringify({ prefix: 'TST', name: 'My Project' }),
      'utf8',
    );
    const result = await requireProjectConfig('myproject');
    expect(result).toEqual({ prefix: 'TST' });
  });

  it('should throw HttpError(400, "Project has no prefix configured") when the project has no config', async () => {
    await expect(requireProjectConfig('nonexistent')).rejects.toThrow(HttpError);
    await expect(requireProjectConfig('nonexistent')).rejects.toThrow('Project has no prefix configured');
  });

  it('should throw HttpError(400, "Project has no prefix configured") when the config exists but has no prefix field', async () => {
    const configDir = path.join(tmpRoot, 'projects', 'noprefix', '.meta', 'ratatoskr');
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, 'config.json'),
      JSON.stringify({ name: 'No Prefix' }),
      'utf8',
    );
    await expect(requireProjectConfig('noprefix')).rejects.toThrow(HttpError);
    await expect(requireProjectConfig('noprefix')).rejects.toThrow('Project has no prefix configured');
  });
});

describe('parseJsonBody', () => {
  it('should return the parsed body when the request has valid JSON', async () => {
    let captured: unknown;
    const helperApp = new Hono();
    helperApp.post('/test', async (c) => {
      captured = await parseJsonBody(c);
      return c.json({ ok: true });
    });
    await helperApp.request(
      '/test',
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hello: 'world' }),
      }),
    );
    expect(captured).toEqual({ hello: 'world' });
  });

  it('should throw HttpError(400, "Invalid JSON body") when the body is malformed JSON', async () => {
    let thrown: unknown;
    const helperApp = new Hono();
    helperApp.post('/test', async (c) => {
      try {
        await parseJsonBody(c);
      } catch (err) {
        thrown = err;
      }
      return c.json({ ok: true });
    });
    await helperApp.request(
      '/test',
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
    );
    expect(thrown).toBeInstanceOf(HttpError);
    expect((thrown as HttpError).message).toBe('Invalid JSON body');
    expect((thrown as HttpError).status).toBe(400);
  });
});
