import type { TicketState, TicketSummary } from '../../server/types';
import { stateColorClass, stateLabel } from '../lib/ticketState';

const STATE_ORDER: readonly TicketState[] = [
  'DONE',
  'IN_REVIEW',
  'IN_PROGRESS',
  'READY',
  'PLANNING',
  'NOT_READY',
];

export function EpicRow({
  ticket,
  isSelected,
  onClick,
}: {
  ticket: TicketSummary;
  isSelected: boolean;
  onClick: () => void;
}) {
  const counts = ticket.childCounts ?? {
    total: 0,
    byState: {
      NOT_READY: 0,
      PLANNING: 0,
      READY: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    },
  };

  const done = counts.byState.DONE;
  const pct = counts.total === 0 ? 0 : Math.round((done / counts.total) * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left border-b border-nord-3 px-4 py-3 transition-colors ${
        isSelected ? 'bg-nord-2' : 'hover:bg-nord-2/70'
      }`}
    >
      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-mono text-nord-8 text-sm shrink-0">
          {ticket.displayId}
        </span>
        <span className="text-nord-6 text-sm flex-1 truncate">
          {ticket.title}
        </span>
        <span className="text-xs text-nord-4 shrink-0 font-mono">
          {done}/{counts.total}
          {counts.total > 0 && (
            <span className="ml-2 text-nord-6 font-medium">{pct}%</span>
          )}
        </span>
      </div>

      {counts.total > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {STATE_ORDER.map((state) => {
            const n = counts.byState[state];
            if (n === 0) return null;
            return (
              <span
                key={state}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${stateColorClass(state)}`}
              >
                {n} {stateLabel(state)}
              </span>
            );
          })}
        </div>
      )}

      {counts.total === 0 && (
        <p className="text-xs text-nord-4 italic">No child tasks yet.</p>
      )}
    </button>
  );
}
