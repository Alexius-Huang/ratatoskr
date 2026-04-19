import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketsKey } from './queryKeys';
import type {
  ArchivedTicketRecord,
  PlanResponse,
  ProjectSummary,
  TicketDetail,
  TicketSummary,
  TicketType,
} from '../../server/types';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ProjectSummary[];
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
}

function encodeTypes(type?: TicketType | TicketType[]): string | null {
  if (!type) return null;
  const arr = Array.isArray(type) ? type : [type];
  return arr.length > 0 ? arr.join(',') : null;
}

async function fetchTickets(
  projectName: string,
  type?: TicketType | TicketType[],
): Promise<TicketSummary[]> {
  const csv = encodeTypes(type);
  const qs = csv ? `?type=${encodeURIComponent(csv)}` : '';
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectName)}/tickets${qs}`,
  );
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse failure, keep default message
    }
    throw new Error(message);
  }
  return (await res.json()) as TicketSummary[];
}

export function useTickets(
  projectName: string | null,
  type?: TicketType | TicketType[],
) {
  const csv = encodeTypes(type);
  return useQuery({
    queryKey: ticketsKey(projectName as string, csv),
    queryFn: () => fetchTickets(projectName as string, type),
    enabled: projectName !== null,
  });
}

async function fetchTicketDetail(
  projectName: string,
  number: number,
): Promise<TicketDetail> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectName)}/tickets/${number}`,
  );
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as TicketDetail;
}

export function useTicketDetail(
  projectName: string | null,
  number: number | null,
) {
  return useQuery({
    queryKey: ['ticket', projectName, number],
    queryFn: () => fetchTicketDetail(projectName as string, number as number),
    enabled: projectName !== null && number !== null,
    retry: false,
  });
}

async function fetchTicketPlan(
  projectName: string,
  number: number,
): Promise<PlanResponse> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectName)}/tickets/${number}/plan`,
  );
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as PlanResponse;
}

async function fetchArchive(projectName: string): Promise<ArchivedTicketRecord[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}/archive`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ArchivedTicketRecord[];
}

export function useArchive(projectName: string | null) {
  return useQuery({
    queryKey: ['archive', projectName],
    queryFn: () => fetchArchive(projectName as string),
    enabled: projectName !== null,
  });
}

export function useTicketPlan(
  projectName: string | null,
  number: number | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['ticket-plan', projectName, number],
    queryFn: () => fetchTicketPlan(projectName as string, number as number),
    enabled: enabled && projectName !== null && number !== null,
    retry: false,
  });
}

export type AppConfigResponse = {
  configured: boolean;
  workspaceRoot: string | null;
  source: 'env' | 'file' | null;
};

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: () => apiFetch<AppConfigResponse>('/api/config'),
    staleTime: Infinity,
  });
}

export function useUpdateAppConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workspaceRoot: string) =>
      apiFetch<AppConfigResponse>('/api/config', {
        method: 'PUT',
        body: JSON.stringify({ workspaceRoot }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-config'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse failure
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}
