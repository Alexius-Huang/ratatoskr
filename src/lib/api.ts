import { useQuery } from '@tanstack/react-query';
import type { ProjectSummary } from '../../server/types';

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
