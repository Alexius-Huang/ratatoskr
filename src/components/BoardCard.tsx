import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useRef, useState } from 'react';
import type { TicketSummary } from '../../server/types';
import { defaultEpicColor, tagStyle } from '../lib/epicColor';

export function BoardCard({ ticket, onClick }: { ticket: TicketSummary; onClick?: () => void }) {
  const epicLabel =
    ticket.epicTitle ?? (ticket.epic !== undefined ? `#${ticket.epic}` : null);
  const ref = useRef<HTMLElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return draggable({
      element: el,
      getInitialData: () => ({ type: 'ticket', number: ticket.number, fromState: ticket.state }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [ticket.number, ticket.state]);

  return (
    <article
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={`bg-nord-2 border border-nord-3 rounded p-3 text-sm hover:border-nord-8 transition-colors ${isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-pointer'}`}
    >
      <div className="font-mono text-xs text-nord-8 mb-1 flex items-center gap-1.5">
        {ticket.type === 'Bug' && (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-nord-11/20 text-nord-11">
            BUG
          </span>
        )}
        <span>{ticket.displayId}</span>
      </div>
      <div className="text-nord-6 leading-snug mb-2">{ticket.title}</div>
      {epicLabel !== null && ticket.epic !== undefined && (() => {
        const s = tagStyle(ticket.epicColor ?? defaultEpicColor(ticket.epic));
        return (
          <span className={s.className} style={s.style} title={epicLabel}>
            {epicLabel}
          </span>
        );
      })()}
    </article>
  );
}
