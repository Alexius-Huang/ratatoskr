import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { TicketState, TicketSummary } from '../../server/types';
import { useTickets } from '../lib/api';
import { BoardColumn } from './BoardColumn';

const BOARD_STATES: readonly TicketState[] = [
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
];

const BOARD_STATE_SET = new Set<TicketState>(BOARD_STATES);

export function BoardTab() {
  const { name } = useParams<{ name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const tasks = useTickets(name ?? null, 'Task');
  const epics = useTickets(name ?? null, 'Epic');

  const epicParam = searchParams.get('epic');
  const epicParamNumber =
    epicParam !== null && /^\d+$/.test(epicParam) ? Number(epicParam) : null;
  const activeEpicNumber = useMemo(() => {
    if (epicParamNumber === null) return null;
    const exists = epics.data?.some((e) => e.number === epicParamNumber);
    return exists ? epicParamNumber : null;
  }, [epicParamNumber, epics.data]);

  const onEpicChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') {
      next.delete('epic');
    } else {
      next.set('epic', value);
    }
    setSearchParams(next, { replace: true });
  };

  const byState = useMemo(() => {
    const buckets: Record<TicketState, TicketSummary[]> = {
      NOT_READY: [],
      PLANNING: [],
      READY: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const t of tasks.data ?? []) {
      if (!BOARD_STATE_SET.has(t.state)) continue;
      if (activeEpicNumber !== null && t.epic !== activeEpicNumber) continue;
      buckets[t.state].push(t);
    }
    return buckets;
  }, [tasks.data, activeEpicNumber]);

  if (tasks.isLoading) {
    return <div className="p-6 text-nord-4">Loading tickets…</div>;
  }

  if (tasks.error) {
    return (
      <div className="p-6">
        <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
          Failed to load tickets:{' '}
          {tasks.error instanceof Error
            ? tasks.error.message
            : String(tasks.error)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label
          htmlFor="epic-filter"
          className="text-xs font-medium text-nord-4 uppercase tracking-wider"
        >
          Epic
        </label>
        <select
          id="epic-filter"
          value={activeEpicNumber === null ? 'all' : String(activeEpicNumber)}
          onChange={(e) => onEpicChange(e.target.value)}
          className="bg-nord-2 border border-nord-3 rounded px-2 py-1 text-sm text-nord-6 focus:outline-none focus:border-nord-8"
        >
          <option value="all">All</option>
          {epics.data?.map((e) => (
            <option key={e.number} value={String(e.number)}>
              {e.displayId} — {e.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-0 flex gap-3">
        {BOARD_STATES.map((state) => (
          <BoardColumn key={state} state={state} tickets={byState[state]} />
        ))}
      </div>
    </div>
  );
}
