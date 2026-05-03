import { useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
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
      let res: Response;
      try {
        res = await fetch('/api/github/merge', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ owner, repo, pullNumber }),
        });
      } catch {
        throw new MergeError('network');
      }

      if (res.status === 200) {
        return res.json() as Promise<MergeResult>;
      }

      let envelope: { kind?: MergeErrorKind; message?: string } = {};
      try { envelope = await res.json() as { kind?: MergeErrorKind; message?: string }; } catch { /* ignore */ }
      throw new MergeError(envelope.kind ?? 'unknown', res.status, envelope.message);
    },
    onSuccess: async () => {
      await updateTicket.mutateAsync({ state: 'DONE' });
    },
  });
}
