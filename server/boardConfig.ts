import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TICKET_STATES, getWorkspaceRoot, readProjectConfig } from './fs';
import type { TicketState } from './types';

export const DEFAULT_BOARD_COLUMNS: readonly TicketState[] = [
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
];

export function validateBoardColumns(
  input: unknown,
): { ok: true; columns: TicketState[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: 'columns must be a non-empty array' };
  }
  const seen = new Set<string>();
  for (const entry of input) {
    if (!(TICKET_STATES as readonly string[]).includes(entry)) {
      return { ok: false, error: `Invalid state: ${entry}` };
    }
    if (seen.has(entry)) {
      return { ok: false, error: `Duplicate state: ${entry}` };
    }
    seen.add(entry);
  }
  return { ok: true, columns: input as TicketState[] };
}

export async function readBoardConfig(projectName: string): Promise<readonly TicketState[]> {
  const { config } = await readProjectConfig(projectName);
  const raw = config?.board?.columns;
  if (!Array.isArray(raw)) return DEFAULT_BOARD_COLUMNS;
  const result = validateBoardColumns(raw);
  if (!result.ok) {
    console.warn(`[board-config] Malformed board.columns for "${projectName}", using default: ${result.error}`);
    return DEFAULT_BOARD_COLUMNS;
  }
  return result.columns;
}

export async function writeBoardConfig(
  projectName: string,
  columns: TicketState[],
): Promise<TicketState[]> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) throw new Error('Workspace root not configured');
  const configPath = path.join(
    workspaceRoot,
    'projects',
    projectName,
    '.meta',
    'ratatoskr',
    'config.json',
  );
  const raw = await readFile(configPath, 'utf8');
  const existing = JSON.parse(raw) as Record<string, unknown>;
  const updated = {
    ...existing,
    board: {
      ...(existing.board && typeof existing.board === 'object' ? existing.board : {}),
      columns,
    },
  };
  await writeFile(configPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  return columns;
}
