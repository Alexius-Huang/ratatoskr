import { useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { readGithubToken } from './githubToken';
import { useUpdateTicket } from './ticketMutations';

export function parsePrPathOrUrl(input: string): { owner: string; repo: string; pullNumber: number } | null {
  const m = input.match(/^(?:https?:\/\/github\.com\/)?([^/\s]+)\/([^/\s]+)\/pull\/(\d+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], pullNumber: parseInt(m[3], 10) };
}

type MergeErrorKind = 'no-token' | 'unauthorized' | 'not-mergeable' | 'gone' | 'network' | 'unknown';

export class MergeError extends Error {
  kind: MergeErrorKind;
  status?: number;
  constructor(kind: MergeErrorKind, status?: number, message?: string) {
    super(message ?? kind);
    this.kind = kind;
    this.status = status;
    this.name = 'MergeError';
  }
}

export function mapMergeError(status: number, body?: { message?: string }): MergeError {
  switch (status) {
    case 401:
    case 403:
      return new MergeError('unauthorized', status);
    case 404:
    case 422:
      return new MergeError('gone', status);
    case 405:
    case 409:
      return new MergeError('not-mergeable', status);
    default:
      return new MergeError('unknown', status, body?.message);
  }
}

export function mergeErrorMessage(err: MergeError): string {
  switch (err.kind) {
    case 'no-token':
      return 'GitHub token not configured. Open Settings to add one.';
    case 'unauthorized':
      return 'GitHub token is invalid or expired. Update it in Settings.';
    case 'not-mergeable':
      return 'Cannot merge: branch is not mergeable (conflicts, failing checks, or branch protection).';
    case 'gone':
      return 'Pull request is already closed or merged.';
    case 'network':
      return 'Network error: could not reach GitHub. Check your connection.';
    default:
      return err.message || 'Merge failed. Please try again.';
  }
}

type MergeTarget = { owner: string; repo: string; pullNumber: number };
type MergeResult = { sha: string; merged: true };

export function useMergePullRequest({
  projectName,
  ticketNumber,
}: {
  projectName: string;
  ticketNumber: number;
}): UseMutationResult<MergeResult, MergeError, MergeTarget> {
  const updateTicket = useUpdateTicket(projectName, ticketNumber);

  return useMutation<MergeResult, MergeError, MergeTarget>({
    mutationFn: async ({ owner, repo, pullNumber }) => {
      const token = await readGithubToken();
      if (!token) throw new MergeError('no-token');

      let res: Response;
      try {
        res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/merge`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({ merge_method: 'squash' }),
          },
        );
      } catch {
        throw new MergeError('network');
      }

      if (res.status === 200) {
        return res.json() as Promise<MergeResult>;
      }

      let body: { message?: string } | undefined;
      try { body = await res.json() as { message?: string }; } catch { /* ignore */ }
      throw mapMergeError(res.status, body);
    },
    onSuccess: async () => {
      await updateTicket.mutateAsync({ state: 'DONE' });
    },
  });
}
