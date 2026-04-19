// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import type { TicketSummary } from '../../server/types';
import { ticketsKey } from './queryKeys';
import { useTransitionTicketState } from './ticketMutations';

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
};

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
