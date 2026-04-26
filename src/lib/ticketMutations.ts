import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Comment, CreateTicketRequest, TicketDetail, TicketState, TicketSummary, UpdateTicketRequest } from '../../server/types';
import { apiFetch } from './api';
import { ticketsInvalidationPredicate } from './queryKeys';

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
        predicate: ticketsInvalidationPredicate(projectName),
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
        predicate: ticketsInvalidationPredicate(projectName),
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
        predicate: ticketsInvalidationPredicate(projectName),
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
        predicate: ticketsInvalidationPredicate(projectName),
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
        predicate: ticketsInvalidationPredicate(projectName),
      });
      queryClient.invalidateQueries({ queryKey: ['ticket', projectName, num] });
    },
  });
}

export function useTransitionTicketState(projectName: string) {
  const queryClient = useQueryClient();
  const ticketsPredicate = ticketsInvalidationPredicate(projectName);
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
        predicate: ticketsInvalidationPredicate(projectName),
      });
      queryClient.invalidateQueries({ queryKey: ['archive', projectName] });
    },
  });
}

export function useCreateComment(projectName: string, ticketNumber: number) {
  const queryClient = useQueryClient();
  const commentsKey = ['comments', projectName, ticketNumber];
  return useMutation({
    mutationFn: ({ body, author }: { body: string; author?: { username: string; display_name: string } }) =>
      apiFetch<Comment>(
        `/api/projects/${encodeURIComponent(projectName)}/tickets/${ticketNumber}/comments`,
        { method: 'POST', body: JSON.stringify(author ? { body, author } : { body }) },
      ),
    onMutate: async ({ body, author }) => {
      await queryClient.cancelQueries({ queryKey: commentsKey });
      const previous = queryClient.getQueryData<Comment[]>(commentsKey);
      const prev = previous ?? [];
      const nextN = Math.max(0, ...prev.map((c) => c.n)) + 1;
      const optimistic: Comment = {
        n: nextN,
        author: author?.username ?? 'me',
        displayName: author?.display_name ?? 'You',
        timestamp: new Date().toISOString(),
        body,
      };
      queryClient.setQueryData<Comment[]>(commentsKey, [...prev, optimistic]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(commentsKey, ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey });
    },
  });
}

export function useEditComment(projectName: string, ticketNumber: number) {
  const queryClient = useQueryClient();
  const commentsKey = ['comments', projectName, ticketNumber];
  return useMutation({
    mutationFn: ({ n, body }: { n: number; body: string }) =>
      apiFetch<Comment>(
        `/api/projects/${encodeURIComponent(projectName)}/tickets/${ticketNumber}/comments/${n}`,
        { method: 'PATCH', body: JSON.stringify({ body }) },
      ),
    onMutate: async ({ n, body }) => {
      await queryClient.cancelQueries({ queryKey: commentsKey });
      const previous = queryClient.getQueryData<Comment[]>(commentsKey);
      queryClient.setQueryData<Comment[]>(
        commentsKey,
        (old) => old?.map((c) => c.n === n ? { ...c, body, updated: new Date().toISOString() } : c),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(commentsKey, ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey });
    },
  });
}
