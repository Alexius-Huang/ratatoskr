import { useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { launchClaudeSkill } from './launchClaudeSkill';
import type { LaunchError, Mode } from './launchClaudeSkill';

type LaunchArgs = { projectPath: string; ticketId: string; mode: Mode };

export function useLaunchClaudeSkill(): UseMutationResult<void, LaunchError, LaunchArgs> {
  return useMutation<void, LaunchError, LaunchArgs>({
    mutationFn: (args) => launchClaudeSkill(args),
  });
}

export function launchErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'kind' in err) {
    const e = err as LaunchError;
    switch (e.kind) {
      case 'UnsupportedPlatform':
        return `iTerm2 launching is only supported on macOS (platform: ${(e as Extract<LaunchError, { kind: 'UnsupportedPlatform' }>).platform}).`;
      case 'InvalidTicketId':
        return `Invalid ticket ID: ${(e as Extract<LaunchError, { kind: 'InvalidTicketId' }>).value}.`;
      case 'InvalidProjectPath':
        return `Invalid project path: ${(e as Extract<LaunchError, { kind: 'InvalidProjectPath' }>).path}.`;
      case 'OsascriptSpawnFailed':
        return `Failed to launch iTerm2: ${(e as Extract<LaunchError, { kind: 'OsascriptSpawnFailed' }>).message}`;
      case 'OsascriptExitFailure':
        return `iTerm2 script failed (exit code ${(e as Extract<LaunchError, { kind: 'OsascriptExitFailure' }>).exit_code}).`;
    }
  }
  return String(err);
}
