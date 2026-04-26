// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import type { Comment, TicketSummary } from '../../server/types';
import { ticketsKey } from './queryKeys';
import { useCreateComment, useTransitionTicketState } from './ticketMutations';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const baseTicket: TicketSummary = {
  number: 1,
  displayId: 'RAT-1',
  type: 'Task',
  title: 'Test ticket',
  state: 'READY',
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
  blocks: [],
  blockedBy: [],
};

const commentsKey = (project: string, n: number) => ['comments', project, n];

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    n: 1,
    author: 'alice',
    displayName: 'Alice',
    timestamp: '2026-01-01T00:00:00.000Z',
    body: 'Existing',
    ...overrides,
  };
}

describe('useCreateComment', () => {
  it('should optimistically append the new comment to the comments cache', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const existing = makeComment();
    qc.setQueryData(commentsKey('ratatoskr', 5), [existing]);

    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const { result } = renderHook(() => useCreateComment('ratatoskr', 5), {
      wrapper: makeWrapper(qc),
    });

    result.current.mutate({ body: 'new comment' });

    await waitFor(() => {
      const data = qc.getQueryData<Comment[]>(commentsKey('ratatoskr', 5));
      expect(data).toHaveLength(2);
      expect(data?.[1].body).toBe('new comment');
    });

    vi.unstubAllGlobals();
  });

  it('should roll back the cache when the mutation fails', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const existing = makeComment();
    qc.setQueryData(commentsKey('ratatoskr', 5), [existing]);

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network error'))));

    const { result } = renderHook(() => useCreateComment('ratatoskr', 5), {
      wrapper: makeWrapper(qc),
    });

    result.current.mutate({ body: 'new comment' });

    await waitFor(() => {
      const data = qc.getQueryData<Comment[]>(commentsKey('ratatoskr', 5));
      expect(data).toHaveLength(1);
      expect(data?.[0].body).toBe('Existing');
    });

    vi.unstubAllGlobals();
  });

  it('should invalidate the comments query on settle', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(commentsKey('ratatoskr', 5), []);

    const newComment = makeComment({ n: 1, body: 'hi' });
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify(newComment), { status: 201, headers: { 'content-type': 'application/json' } })),
      ),
    );

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateComment('ratatoskr', 5), {
      wrapper: makeWrapper(qc),
    });

    result.current.mutate({ body: 'hi' });

    await waitFor(() => {
      const calls = invalidateSpy.mock.calls;
      const commentsInvalidated = calls.some(([opts]) => {
        if (opts && 'queryKey' in opts) {
          const key = opts.queryKey as unknown[];
          return key[0] === 'comments' && key[1] === 'ratatoskr' && key[2] === 5;
        }
        return false;
      });
      expect(commentsInvalidated).toBe(true);
    });

    vi.unstubAllGlobals();
  });
});

describe('useTransitionTicketState', () => {
  it('should optimistically update the tickets cache before the PATCH resolves', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(ticketsKey('ratatoskr', 'Task,Bug'), [baseTicket]);

    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const { result } = renderHook(() => useTransitionTicketState('ratatoskr'), {
      wrapper: makeWrapper(qc),
    });

    result.current.mutate({ num: 1, state: 'DONE' });

    await waitFor(() => {
      const data = qc.getQueryData<TicketSummary[]>(ticketsKey('ratatoskr', 'Task,Bug'));
      expect(data?.[0].state).toBe('DONE');
    });

    vi.unstubAllGlobals();
  });

  it('should roll back the optimistic update when the PATCH fails', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(ticketsKey('ratatoskr', 'Task,Bug'), [baseTicket]);

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network error'))));

    const { result } = renderHook(() => useTransitionTicketState('ratatoskr'), {
      wrapper: makeWrapper(qc),
    });

    result.current.mutate({ num: 1, state: 'DONE' });

    await waitFor(() => {
      const data = qc.getQueryData<TicketSummary[]>(ticketsKey('ratatoskr', 'Task,Bug'));
      expect(data?.[0].state).toBe('READY');
    });

    vi.unstubAllGlobals();
  });

  it('should invalidate the tickets cache on success', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(ticketsKey('ratatoskr', 'Task,Bug'), [baseTicket]);

    const ticketDetail = { ...baseTicket, state: 'DONE' };
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(ticketDetail), { status: 200, headers: { 'content-type': 'application/json' } })),
    ));

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useTransitionTicketState('ratatoskr'), {
      wrapper: makeWrapper(qc),
    });

    result.current.mutate({ num: 1, state: 'DONE' });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalled();
    });

    const calls = invalidateSpy.mock.calls;
    const ticketsCacheInvalidated = calls.some(([opts]) => {
      if (opts && 'predicate' in opts && typeof opts.predicate === 'function') {
        return opts.predicate({ queryKey: ticketsKey('ratatoskr', 'Task,Bug') } as unknown as Parameters<typeof opts.predicate>[0]);
      }
      return false;
    });
    expect(ticketsCacheInvalidated).toBe(true);

    vi.unstubAllGlobals();
  });
});
