import { invoke } from '@tauri-apps/api/core';

export type Mode = 'plan' | 'implement';

export type LaunchError =
  | { kind: 'UnsupportedPlatform'; platform: string }
  | { kind: 'InvalidTicketId'; value: string }
  | { kind: 'InvalidProjectPath'; path: string }
  | { kind: 'OsascriptSpawnFailed'; message: string }
  | { kind: 'OsascriptExitFailure'; exit_code: number; stderr: string };

/**
 * Spawns a new iTerm2 window running the right `claude` invocation for the
 * given ticket and mode. macOS-only; rejects with `UnsupportedPlatform` elsewhere.
 *
 * IMPORTANT: `projectPath` is the **workspace root** (e.g.
 * `/Users/.../ai-workspace`), not a project subdirectory. The `rat-*` skills
 * resolve plan/ticket paths relative to the workspace root, and starting Claude
 * from a project subdirectory triggers an unnecessary MCP-server approval
 * prompt because Claude Code treats it as a new working directory.
 */
export async function launchClaudeSkill(args: {
  projectPath: string;
  ticketId: string;
  mode: Mode;
}): Promise<void> {
  await invoke('launch_claude_skill', args);
}
