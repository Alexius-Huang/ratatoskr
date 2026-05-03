// @vitest-environment jsdom
import { createElement } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  parsePrPathOrUrl,
  mapMergeError,
  mergeErrorMessage,
  MergeError,
  useMergePullRequest,
} from './mergePullRequest';
import * as githubToken from './githubToken';
import * as ticketMutations from './ticketMutations';

vi.mock('./githubToken', () => ({ readGithubToken: vi.fn() }));
vi.mock('./ticketMutations', () => ({ useUpdateTicket: vi.fn() }));

const createWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
};

describe('parsePrPathOrUrl', () => {
  it.each([
    ['https://github.com/owner/repo/pull/42', { owner: 'owner', repo: 'repo', pullNumber: 42 }],
    ['Alexius-Huang/ratatoskr/pull/47', { owner: 'Alexius-Huang', repo: 'ratatoskr', pullNumber: 47 }],
    ['https://example.com/foo', null],
    ['', null],
  ])('"%s" → %j', (input, expected) => {
    expect(parsePrPathOrUrl(input)).toEqual(expected);
  });
});

describe('mapMergeError', () => {
  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [404, 'gone'],
    [405, 'not-mergeable'],
    [409, 'not-mergeable'],
    [422, 'gone'],
    [500, 'unknown'],
  ] as [number, string][])('status %d → kind "%s"', (status, kind) => {
    expect(mapMergeError(status).kind).toBe(kind);
  });
});

describe('mergeErrorMessage', () => {
  it.each([
    ['no-token' as MergeError['kind'], 'GitHub token not configured'],
    ['unauthorized' as MergeError['kind'], 'invalid or expired'],
    ['not-mergeable' as MergeError['kind'], 'not mergeable'],
    ['gone' as MergeError['kind'], 'already closed or merged'],
    ['network' as MergeError['kind'], 'Network error'],
  ])('kind "%s" → message contains "%s"', (kind, substring) => {
    expect(mergeErrorMessage(new MergeError(kind))).toContain(substring);
  });
});

describe('useMergePullRequest', () => {
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.mocked(ticketMutations.useUpdateTicket).mockReturnValue({
      mutateAsync: mockMutateAsync,
    } as unknown as ReturnType<typeof ticketMutations.useUpdateTicket>);
    mockMutateAsync.mockResolvedValue({});
  });

  it('throws MergeError("no-token") when token is null', async () => {
    vi.mocked(githubToken.readGithubToken).mockResolvedValue(null);
    const { result } = renderHook(
      () => useMergePullRequest({ projectName: 'test', ticketNumber: 1 }),
      { wrapper: createWrapper() },
    );
    act(() => { result.current.mutate({ owner: 'o', repo: 'r', pullNumber: 1 }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(MergeError);
    expect(result.current.error?.kind).toBe('no-token');
  });

  it('throws MergeError("not-mergeable") on 405', async () => {
    vi.mocked(githubToken.readGithubToken).mockResolvedValue('fake-token');
    global.fetch = vi.fn().mockResolvedValue({
      status: 405,
      json: vi.fn().mockResolvedValue({}),
    });
    const { result } = renderHook(
      () => useMergePullRequest({ projectName: 'test', ticketNumber: 1 }),
      { wrapper: createWrapper() },
    );
    act(() => { result.current.mutate({ owner: 'o', repo: 'r', pullNumber: 1 }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe('not-mergeable');
  });

  it('on 200: calls mutateAsync({ state: "DONE" }) to patch the ticket', async () => {
    vi.mocked(githubToken.readGithubToken).mockResolvedValue('fake-token');
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ sha: 'abc123', merged: true }),
    });
    const { result } = renderHook(
      () => useMergePullRequest({ projectName: 'test', ticketNumber: 1 }),
      { wrapper: createWrapper() },
    );
    act(() => { result.current.mutate({ owner: 'o', repo: 'r', pullNumber: 1 }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMutateAsync).toHaveBeenCalledWith({ state: 'DONE' });
  });
});
