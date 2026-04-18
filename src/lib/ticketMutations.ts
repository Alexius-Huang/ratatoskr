import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTicketRequest, TicketDetail, UpdateTicketRequest } from '../../server/types';
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
