import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export const GITHUB_TOKEN_SENTINEL = '__stored__';

export function useGithubTokenConfigured() {
  return useQuery({
    queryKey: ['github-token'],
    queryFn: () => apiFetch<{ configured: boolean }>('/api/github-token'),
    staleTime: Infinity,
  });
}

export function useSaveGithubToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string | null) => {
      if (token === null) {
        await apiFetch('/api/github-token', { method: 'DELETE' });
      } else {
        await apiFetch('/api/github-token', {
          method: 'PUT',
          body: JSON.stringify({ token }),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-token'] });
    },
  });
}
