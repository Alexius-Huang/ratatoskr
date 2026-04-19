import { Search } from 'lucide-react';
import { useState } from 'react';
import type { TicketSummary } from '../../server/types';

type EpicSearchFilterProps = {
  epics: TicketSummary[];
  activeEpicNumber: number | null;
  onEpicChange: (next: number | null) => void;
};

export function EpicSearchFilter({ epics, activeEpicNumber, onEpicChange }: EpicSearchFilterProps) {
  const [query, setQuery] = useState('');

  const trimmed = query.trim().toLowerCase();
  const matches =
    trimmed !== ''
      ? epics.filter((e) => e.title.toLowerCase().includes(trimmed)).slice(0, 10)
      : [];

  const activeEpic = epics.find((e) => e.number === activeEpicNumber) ?? null;

  const chips: TicketSummary[] = activeEpic
    ? [activeEpic, ...matches.filter((e) => e.number !== activeEpic.number)]
    : matches;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative flex items-center">
        <Search className="absolute left-2 w-3.5 h-3.5 text-nord-4 pointer-events-none" />
        <input
          type="text"
          aria-label="Filter by epic"
          placeholder="Filter by epic…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-nord-2 border border-nord-3 rounded pl-7 pr-2 py-1 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8 w-48"
        />
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((epic) => {
            const isSelected = epic.number === activeEpicNumber;
            return (
              <button
                key={epic.number}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onEpicChange(isSelected ? null : epic.number)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-nord-10 text-nord-6'
                    : 'bg-nord-3 text-nord-4 hover:bg-nord-2 hover:text-nord-6'
                }`}
              >
                {epic.displayId} — {epic.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
