import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import type { LaunchError, Mode } from './launchClaudeSkill';
import { launchClaudeSkill } from './launchClaudeSkill';

const mockInvoke = vi.mocked(invoke);

describe('launchClaudeSkill', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it.each([['plan' as Mode], ['implement' as Mode]])(
    'calls invoke with mode "%s"',
    async (mode) => {
      mockInvoke.mockResolvedValue(undefined);
      await launchClaudeSkill({ projectPath: '/some/path', ticketId: 'RAT-1', mode });
      expect(mockInvoke).toHaveBeenCalledWith('launch_claude_skill', {
        projectPath: '/some/path',
        ticketId: 'RAT-1',
        mode,
      });
    },
  );

  it('resolves to undefined when invoke resolves', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const result = await launchClaudeSkill({ projectPath: '/p', ticketId: 'RAT-1', mode: 'plan' });
    expect(result).toBeUndefined();
  });

  it('rejects with LaunchError when invoke rejects', async () => {
    const error: LaunchError = { kind: 'InvalidTicketId', value: 'bad' };
    mockInvoke.mockRejectedValue(error);
    await expect(
      launchClaudeSkill({ projectPath: '/p', ticketId: 'bad', mode: 'plan' }),
    ).rejects.toEqual(error);
  });
});
