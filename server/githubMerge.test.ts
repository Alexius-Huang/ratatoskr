import { describe, expect, it, vi } from 'vitest';
import { mergePullRequest } from './githubMerge';

const baseReq = { owner: 'acme', repo: 'app', pullNumber: 42 };

function makeFetch(status: number, body: unknown = {}): typeof fetch {
  return vi.fn().mockResolvedValue({
    status,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as typeof fetch;
}

describe('mergePullRequest', () => {
  it('should return no-token envelope when token is null', async () => {
    const result = await mergePullRequest(baseReq, { token: null });
    expect(result).toEqual({ ok: false, status: 412, envelope: { kind: 'no-token' } });
  });

  it.each([
    [401, 'unauthorized', 401],
    [403, 'unauthorized', 401],
  ])('should map GitHub %d to kind "%s" with status %d', async (githubStatus, expectedKind, expectedStatus) => {
    const result = await mergePullRequest(baseReq, {
      token: 'tok',
      fetchImpl: makeFetch(githubStatus, { message: 'Bad credentials' }),
    });
    expect(result).toMatchObject({ ok: false, status: expectedStatus, envelope: { kind: expectedKind } });
  });

  it.each([
    [405, 'not-mergeable', 409],
    [409, 'not-mergeable', 409],
  ])('should map GitHub %d to kind "%s" with status %d', async (githubStatus, expectedKind, expectedStatus) => {
    const result = await mergePullRequest(baseReq, {
      token: 'tok',
      fetchImpl: makeFetch(githubStatus, {}),
    });
    expect(result).toMatchObject({ ok: false, status: expectedStatus, envelope: { kind: expectedKind } });
  });

  it.each([
    [404, 'gone', 404],
    [422, 'gone', 404],
  ])('should map GitHub %d to kind "%s" with status %d', async (githubStatus, expectedKind, expectedStatus) => {
    const result = await mergePullRequest(baseReq, {
      token: 'tok',
      fetchImpl: makeFetch(githubStatus, {}),
    });
    expect(result).toMatchObject({ ok: false, status: expectedStatus, envelope: { kind: expectedKind } });
  });

  it('should return unknown envelope on 500', async () => {
    const result = await mergePullRequest(baseReq, {
      token: 'tok',
      fetchImpl: makeFetch(500, { message: 'Internal Server Error' }),
    });
    expect(result).toMatchObject({ ok: false, status: 502, envelope: { kind: 'unknown' } });
  });

  it('should return unknown envelope with network message when fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    const result = await mergePullRequest(baseReq, { token: 'tok', fetchImpl });
    expect(result).toMatchObject({ ok: false, status: 502, envelope: { kind: 'unknown', message: 'Network error reaching GitHub' } });
  });

  it('should return ok: true with sha on 200', async () => {
    const result = await mergePullRequest(baseReq, {
      token: 'tok',
      fetchImpl: makeFetch(200, { sha: 'abc123', merged: true }),
    });
    expect(result).toEqual({ ok: true, sha: 'abc123' });
  });

  it('should send merge_method: squash by default', async () => {
    const fetchImpl = makeFetch(200, { sha: 'x' });
    await mergePullRequest(baseReq, { token: 'tok', fetchImpl });
    const call = vi.mocked(fetchImpl).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string) as { merge_method: string };
    expect(body.merge_method).toBe('squash');
  });

  it('should send the specified mergeMethod when provided', async () => {
    const fetchImpl = makeFetch(200, { sha: 'x' });
    await mergePullRequest({ ...baseReq, mergeMethod: 'rebase' }, { token: 'tok', fetchImpl });
    const call = vi.mocked(fetchImpl).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string) as { merge_method: string };
    expect(body.merge_method).toBe('rebase');
  });
});
