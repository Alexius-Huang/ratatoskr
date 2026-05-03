// @vitest-environment jsdom
import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GITHUB_TOKEN_SENTINEL, useGithubTokenConfigured, useSaveGithubToken } from './githubToken';

afterEach(() => {
  vi.restoreAllMocks();
});

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe('GITHUB_TOKEN_SENTINEL', () => {
  it('should export the sentinel string', () => {
    expect(GITHUB_TOKEN_SENTINEL).toBe('__stored__');
  });
});

describe('useGithubTokenConfigured', () => {
  it('should issue GET /api/github-token and return { configured: true } from the response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ configured: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { result } = renderHook(() => useGithubTokenConfigured(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ configured: true });

    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(call[0])).toBe('/api/github-token');
    expect((call[1] as RequestInit)?.method).toBeUndefined();
  });
});

describe('useSaveGithubToken', () => {
  it.each([
    ['with a token', 'ghp_newtoken', 'PUT', { token: 'ghp_newtoken' }],
    ['with null', null, 'DELETE', null],
  ] as [string, string | null, string, { token: string } | null][])('%s should issue the right request', async (_label, inputToken, expectedMethod, expectedBody) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ configured: expectedMethod === 'PUT' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { result } = renderHook(() => useSaveGithubToken(), { wrapper: createWrapper() });
    await result.current.mutateAsync(inputToken);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = fetchSpy.mock.calls.find(([u, init]) => {
      return String(u).includes('/api/github-token') && (init as RequestInit)?.method === expectedMethod;
    });
    expect(call).toBeDefined();
    if (expectedBody !== null) {
      expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual(expectedBody);
    }
  });
});
