import type { TicketState, TicketSummary } from '../../server/types';
import { stateLabel } from '../lib/ticketState';
import { BoardCard } from './BoardCard';

export function BoardColumn({
  state,
  tickets,
}: {
  state: TicketState;
  tickets: TicketSummary[];
}) {
  const sorted = [...tickets].sort((a, b) => a.number - b.number);

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-nord-1 border border-nord-3 rounded overflow-hidden">
      <header className="px-3 py-2 border-b border-nord-3 bg-nord-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-nord-4 uppercase tracking-wider">
          {stateLabel(state)}
        </h3>
        <span className="text-xs text-nord-4 font-mono">{sorted.length}</span>
      </header>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sorted.length === 0 ? (
          <p className="text-xs text-nord-4 italic text-center py-4">
            nothing here
          </p>
        ) : (
          sorted.map((t) => <BoardCard key={t.number} ticket={t} />)
        )}
      </div>
    </section>
  );
}
