import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Sentinel used in the SettingsModal input to indicate a token is stored without
// echoing the actual value. The component checks for this string to decide whether
// to skip the update on save.
export const GITHUB_TOKEN_SENTINEL = '__stored__';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function readGithubToken(): Promise<string | null> {
  if (!isTauri()) return null;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string | null>('get_github_token');
}

export function useGithubToken() {
  return useQuery({
    queryKey: ['github-token'],
    queryFn: readGithubToken,
    staleTime: Infinity,
  });
}

export function useSaveGithubToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string | null) => {
      if (!isTauri()) return;
      const { invoke } = await import('@tauri-apps/api/core');
      if (token) {
        await invoke('set_github_token', { token });
      } else {
        await invoke('delete_github_token');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['github-token'] });
    },
  });
}
