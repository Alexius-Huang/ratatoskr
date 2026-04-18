import type { TicketSummary } from '../../server/types';

export function BoardCard({ ticket }: { ticket: TicketSummary }) {
  const epicLabel =
    ticket.epicTitle ?? (ticket.epic !== undefined ? `#${ticket.epic}` : null);

  return (
    <article className="bg-nord-2 border border-nord-3 rounded p-3 text-sm hover:border-nord-8 transition-colors">
      <div className="font-mono text-xs text-nord-8 mb-1 flex items-center gap-1.5">
        {ticket.type === 'Bug' && (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-nord-11/20 text-nord-11">
            BUG
          </span>
        )}
        <span>{ticket.displayId}</span>
      </div>
      <div className="text-nord-6 leading-snug mb-2">{ticket.title}</div>
      {epicLabel !== null && (
        <span
          className="inline-block max-w-full truncate px-2 py-0.5 rounded bg-nord-15/20 text-nord-15 text-xs font-medium"
          title={epicLabel}
        >
          {epicLabel}
        </span>
      )}
    </article>
  );
}
