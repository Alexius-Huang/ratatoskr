import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTicketRequest, TicketDetail, TicketState, TicketSummary, UpdateTicketRequest } from '../../server/types';
import { apiFetch } from './api';

export function useCreateTicket(projectName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketRequest) =>
      apiFetch<TicketDetail>(
        `/api/projects/${encodeURIComponent(projectName)}/tickets`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'tickets' &&
          q.queryKey[1] === projectName,
      });
    },
  });
}

export function useUpdateTicket(projectName: string, number: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateTicketRequest) =>
      apiFetch<TicketDetail>(
        `/api/projects/${encodeURIComponent(projectName)}/tickets/${number}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'tickets' &&
          q.queryKey[1] === projectName,
      });
      queryClient.invalidateQueries({ queryKey: ['ticket', projectName, number] });
    },
  });
}

export function useArchiveTicket(projectName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (num: number) =>
      apiFetch<{ ok: boolean }>(
        `/api/projects/${encodeURIComponent(projectName)}/tickets/${num}/archive`,
        { method: 'POST' },
      ),
    onSuccess: (_data, num) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'tickets' &&
          q.queryKey[1] === projectName,
      });
      queryClient.invalidateQueries({ queryKey: ['archive', projectName] });
      queryClient.invalidateQueries({ queryKey: ['ticket', projectName, num] });
    },
  });
}

export function useArchiveDoneTickets(projectName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ archived: number }>(
        `/api/projects/${encodeURIComponent(projectName)}/tickets/archive-done`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'tickets' &&
          q.queryKey[1] === projectName,
      });
      queryClient.invalidateQueries({ queryKey: ['archive', projectName] });
    },
  });
}

export function useMarkEpicDone(projectName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (num: number) =>
      apiFetch<TicketDetail>(
        `/api/projects/${encodeURIComponent(projectName)}/tickets/${num}/mark-epic-done`,
        { method: 'POST' },
      ),
    onSuccess: (_data, num) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'tickets' &&
          q.queryKey[1] === projectName,
      });
      queryClient.invalidateQueries({ queryKey: ['ticket', projectName, num] });
    },
  });
}

export function useTransitionTicketState(projectName: string) {
  const queryClient = useQueryClient();
  const ticketsPredicate = (q: { queryKey: readonly unknown[] }) =>
    Array.isArray(q.queryKey) &&
    q.queryKey[0] === 'tickets' &&
    q.queryKey[1] === projectName;
  return useMutation({
    mutationFn: ({ num, state }: { num: number; state: TicketState }) =>
      apiFetch<TicketDetail>(
        `/api/projects/${encodeURIComponent(projectName)}/tickets/${num}`,
        { method: 'PATCH', body: JSON.stringify({ state }) },
      ),
    onMutate: async ({ num, state }) => {
      await queryClient.cancelQueries({ predicate: ticketsPredicate });
      const previous = queryClient.getQueriesData<TicketSummary[]>({ predicate: ticketsPredicate });
      queryClient.setQueriesData<TicketSummary[]>(
        { predicate: ticketsPredicate },
        (old) => old?.map((t) => (t.number === num ? { ...t, state } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: (_data, _err, { num }) => {
      queryClient.invalidateQueries({ predicate: ticketsPredicate });
      queryClient.invalidateQueries({ queryKey: ['ticket', projectName, num] });
    },
  });
}

export function useUnarchiveTicket(projectName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (num: number) =>
      apiFetch<{ ok: boolean }>(
        `/api/projects/${encodeURIComponent(projectName)}/archive/${num}/unarchive`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'tickets' &&
          q.queryKey[1] === projectName,
      });
      queryClient.invalidateQueries({ queryKey: ['archive', projectName] });
    },
  });
}
