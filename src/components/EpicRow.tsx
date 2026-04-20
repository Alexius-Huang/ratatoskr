import React from 'react';
import type { TicketState, TicketSummary } from '../../server/types';
import { stateColorClass, stateLabel } from '../lib/ticketState';
import { EpicColorSwatchButton } from './EpicColorSwatchButton';

const PARTICLES: { dx: string; dy: string; delay: string; pos: React.CSSProperties }[] = [
  { dx: '-5px', dy: '-18px', delay: '0s',    pos: { left: '15%', top: '-2px' } },
  { dx: '0px',  dy: '-20px', delay: '0.5s',  pos: { left: '40%', top: '-2px' } },
  { dx: '5px',  dy: '-18px', delay: '1.0s',  pos: { left: '70%', top: '-2px' } },
  { dx: '16px', dy: '-8px',  delay: '0.3s',  pos: { right: '-2px', top: '20%' } },
  { dx: '16px', dy: '8px',   delay: '0.9s',  pos: { right: '-2px', bottom: '20%' } },
  { dx: '-16px',dy: '-8px',  delay: '0.7s',  pos: { left: '-2px', top: '20%' } },
  { dx: '-16px',dy: '8px',   delay: '1.3s',  pos: { left: '-2px', bottom: '20%' } },
  { dx: '-4px', dy: '18px',  delay: '0.2s',  pos: { left: '30%', bottom: '-2px' } },
  { dx: '4px',  dy: '18px',  delay: '0.8s',  pos: { left: '65%', bottom: '-2px' } },
];

const STATE_ORDER: readonly TicketState[] = [
  'DONE',
  'WONT_DO',
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
  onViewTickets,
  onColorChange,
  onMarkDone,
}: {
  ticket: TicketSummary;
  isSelected: boolean;
  onClick: () => void;
  onViewTickets?: () => void;
  onColorChange?: (hex: string | null) => void;
  onMarkDone?: () => void;
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
      WONT_DO: 0,
    },
  };

  const done = counts.byState.DONE + (counts.byState.WONT_DO ?? 0);
  const pct = counts.total === 0 ? 0 : Math.round((done / counts.total) * 100);
  const canMarkDone =
    onMarkDone !== undefined &&
    ticket.state === 'IN_PROGRESS' &&
    counts.total > 0 &&
    done === counts.total;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`w-full text-left border-b border-nord-3 px-4 py-3 transition-colors cursor-pointer ${
        isSelected ? 'bg-nord-2' : 'hover:bg-nord-2/70'
      }`}
    >
      <div className="flex items-center gap-3 mb-1.5">
        {onColorChange && (
          <EpicColorSwatchButton
            epicNumber={ticket.number}
            color={ticket.color}
            onChange={onColorChange}
          />
        )}
        <span className="font-mono text-nord-8 text-sm shrink-0">
          {ticket.displayId}
        </span>
        <span className="text-nord-6 text-sm flex-1 truncate">
          {ticket.title}
        </span>
        <span className="text-xs text-nord-4 shrink-0 font-mono whitespace-nowrap">
          {done}/{counts.total}
          {counts.total > 0 && (
            <span className="ml-1.5 text-nord-6 font-medium">{pct}%</span>
          )}
        </span>
        {canMarkDone && (
          <div className="relative shrink-0">
            {PARTICLES.map((p, i) => (
              <span
                key={i}
                className="epic-particle"
                style={{ '--dx': p.dx, '--dy': p.dy, animationDelay: p.delay, ...p.pos } as React.CSSProperties}
              />
            ))}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkDone!(); }}
              className="epic-mark-done-btn text-sm font-semibold bg-nord-8 text-nord-0 rounded-md px-3 py-1 border border-nord-8 transition-colors"
            >
              🎉 Mark Epic as Done!
            </button>
          </div>
        )}
      </div>

      {counts.total > 0 && (
        <div className="mb-2 h-1.5 rounded-full bg-nord-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-nord-8 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {counts.total > 0
            ? STATE_ORDER.map((state) => {
                const n = counts.byState[state] ?? 0;
                if (n === 0) return null;
                return (
                  <span
                    key={state}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${stateColorClass(state)}`}
                  >
                    {n} {stateLabel(state)}
                  </span>
                );
              })
            : <p className="text-xs text-nord-4 italic">No child tasks yet.</p>
          }
        </div>

        {onViewTickets && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onViewTickets(); }}
            className="shrink-0 text-xs text-nord-4 border border-nord-3 rounded px-2 py-0.5 hover:text-nord-6 hover:border-nord-8 transition-colors"
          >
            View ticket list →
          </button>
        )}
      </div>
    </div>
  );
}
