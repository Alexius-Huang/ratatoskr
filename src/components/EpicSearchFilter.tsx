import { Search, X } from 'lucide-react';
import { useState } from 'react';
import type { TicketSummary } from '../../server/types';
import { defaultEpicColor } from '../lib/epicColor';

type EpicSearchFilterProps = {
  epics: TicketSummary[];
  activeEpicNumber: number | null;
  onEpicChange: (next: number | null) => void;
};

export function EpicSearchFilter({ epics, activeEpicNumber, onEpicChange }: EpicSearchFilterProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const trimmed = query.trim().toLowerCase();
  const dropdownItems =
    trimmed !== ''
      ? epics.filter((e) => e.title.toLowerCase().includes(trimmed)).slice(0, 10)
      : epics.slice(0, 5);

  const activeEpic = epics.find((e) => e.number === activeEpicNumber) ?? null;

  const handleSelect = (num: number) => {
    onEpicChange(num);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className="flex items-center bg-nord-2 border border-nord-3 rounded focus-within:border-nord-8 transition-colors">
          <Search className="ml-2 w-3.5 h-3.5 text-nord-4 shrink-0" />
          <input
            type="text"
            aria-label="Filter by epic"
            placeholder="Filter by epic…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="bg-transparent pl-1.5 pr-2 py-1 text-sm text-nord-6 placeholder-nord-4 focus:outline-none w-44"
          />
        </div>

        {open && dropdownItems.length > 0 && (
          <div
            className="absolute top-full left-0 mt-1 z-50 bg-nord-1 border border-nord-3 rounded shadow-lg w-72 max-h-48 overflow-y-auto"
            onMouseDown={(e) => e.preventDefault()}
          >
            {dropdownItems.map((epic) => (
              <button
                key={epic.number}
                type="button"
                onClick={() => handleSelect(epic.number)}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  epic.number === activeEpicNumber
                    ? 'bg-nord-10/20 text-nord-6'
                    : 'text-nord-4 hover:bg-nord-2 hover:text-nord-6'
                }`}
              >
                <span className="font-mono text-nord-8 text-xs mr-2">{epic.displayId}</span>
                {epic.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeEpic && (() => {
        const chipColor = activeEpic.color ?? defaultEpicColor(activeEpic.number);
        return (
        <div
          className="flex items-center gap-1 pl-2 pr-1 py-1 rounded text-xs font-medium max-w-56"
          style={{ backgroundColor: `${chipColor}33`, color: chipColor }}
        >
          <span className="truncate">
            {activeEpic.displayId} — {activeEpic.title}
          </span>
          <button
            type="button"
            onClick={() => onEpicChange(null)}
            aria-label="Clear epic filter"
            className="shrink-0 ml-0.5 rounded hover:opacity-70 p-0.5 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        );
      })()}
    </div>
  );
}
