import { invoke } from '@tauri-apps/api/core';

export type Mode = 'plan' | 'implement';

export type LaunchError =
  | { kind: 'UnsupportedPlatform'; platform: string }
  | { kind: 'InvalidTicketId'; value: string }
  | { kind: 'InvalidProjectPath'; path: string }
  | { kind: 'OsascriptSpawnFailed'; message: string }
  | { kind: 'OsascriptExitFailure'; exit_code: number; stderr: string };

export async function launchClaudeSkill(args: {
  projectPath: string;
  ticketId: string;
  mode: Mode;
}): Promise<void> {
  await invoke('launch_claude_skill', args);
}
