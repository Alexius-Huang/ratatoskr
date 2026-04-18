import { useQuery } from '@tanstack/react-query';
import type {
  ProjectSummary,
  TicketSummary,
  TicketType,
} from '../../server/types';

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

async function fetchTickets(
  projectName: string,
  type?: TicketType,
): Promise<TicketSummary[]> {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
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
  type?: TicketType,
) {
  return useQuery({
    queryKey: ['tickets', projectName, type ?? 'all'],
    queryFn: () => fetchTickets(projectName as string, type),
    enabled: projectName !== null,
  });
}
