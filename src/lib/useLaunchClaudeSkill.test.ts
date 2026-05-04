// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LaunchError } from './launchClaudeSkill';
import { launchErrorMessage, useLaunchClaudeSkill } from './useLaunchClaudeSkill';

vi.mock('./launchClaudeSkill', () => ({
  launchClaudeSkill: vi.fn(),
}));

import { launchClaudeSkill } from './launchClaudeSkill';

const mockLaunchClaudeSkill = vi.mocked(launchClaudeSkill);

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useLaunchClaudeSkill', () => {
  beforeEach(() => {
    mockLaunchClaudeSkill.mockReset();
  });

  it('should resolve when invoke succeeds', async () => {
    mockLaunchClaudeSkill.mockResolvedValue(undefined);
    const { result } = renderHook(() => useLaunchClaudeSkill(), { wrapper });

    act(() => {
      result.current.mutate({ projectPath: '/ws', ticketId: 'RAT-1', mode: 'plan' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockLaunchClaudeSkill).toHaveBeenCalledWith({ projectPath: '/ws', ticketId: 'RAT-1', mode: 'plan' });
  });

  it('should surface error when invoke rejects', async () => {
    const err: LaunchError = { kind: 'UnsupportedPlatform', platform: 'win32' };
    mockLaunchClaudeSkill.mockRejectedValue(err);
    const { result } = renderHook(() => useLaunchClaudeSkill(), { wrapper });

    act(() => {
      result.current.mutate({ projectPath: '/ws', ticketId: 'RAT-1', mode: 'plan' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(err);
  });
});

describe('launchErrorMessage', () => {
  it.each<[LaunchError, string]>([
    [
      { kind: 'UnsupportedPlatform', platform: 'win32' },
      'iTerm2 launching is only supported on macOS (platform: win32).',
    ],
    [
      { kind: 'InvalidTicketId', value: 'bad-id' },
      'Invalid ticket ID: bad-id.',
    ],
    [
      { kind: 'InvalidProjectPath', path: '/no/such/path' },
      'Invalid project path: /no/such/path.',
    ],
    [
      { kind: 'OsascriptSpawnFailed', message: 'no such executable' },
      'Failed to launch iTerm2: no such executable',
    ],
    [
      { kind: 'OsascriptExitFailure', exit_code: 1, stderr: 'error output' },
      'iTerm2 script failed (exit code 1).',
    ],
  ])('should format %s correctly', (err, expected) => {
    expect(launchErrorMessage(err)).toBe(expected);
  });

  it('should fall back to String() for unknown shapes', () => {
    expect(launchErrorMessage('oops')).toBe('oops');
    expect(launchErrorMessage(42)).toBe('42');
  });
});
