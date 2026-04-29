import type { TicketSummary, TicketState } from '../../server/types';

export type ProjectStats = {
  done: number;
  inProgress: number;
  todo: number;
  total: number;
  openBugs: number;
};

const IN_PROGRESS_STATES: ReadonlySet<TicketState> = new Set([
  'PLANNING', 'READY', 'IN_PROGRESS', 'IN_REVIEW',
]);

export function computeProjectStats(tickets: TicketSummary[]): ProjectStats {
  let done = 0, inProgress = 0, todo = 0, openBugs = 0;
  for (const t of tickets) {
    if (t.state === 'DONE') done++;
    else if (IN_PROGRESS_STATES.has(t.state)) inProgress++;
    else if (t.state === 'NOT_READY') todo++;
    if (t.type === 'Bug' && t.state !== 'DONE' && t.state !== 'WONT_DO') openBugs++;
  }
  return { done, inProgress, todo, total: done + inProgress + todo, openBugs };
}
