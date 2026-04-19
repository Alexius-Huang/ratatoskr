import { useEffect, useRef, useState } from 'react';
import type { TicketSummary } from '../../server/types';
import { defaultEpicColor } from '../lib/epicColor';

interface EpicComboboxProps {
  epics: TicketSummary[];
  value: number | null;
  onChange: (v: number | null) => void;
}

export function EpicCombobox({ epics, value, onChange }: EpicComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedEpic = epics.find((e) => e.number === value) ?? null;

  const filtered = epics.filter((e) => {
    if (!query) return true;
    return `${e.displayId} — ${e.title}`.toLowerCase().includes(query.toLowerCase());
  });

  // options[0] = null (no epic), options[1..n] = epic numbers
  const options: (number | null)[] = [null, ...filtered.map((e) => e.number)];

  const inputValue = open
    ? query
    : selectedEpic
      ? `${selectedEpic.displayId} — ${selectedEpic.title}`
      : '';

  function openDropdown() {
    setQuery('');
    setOpen(true);
    setActiveIndex(-1);
  }

  function closeDropdown() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function select(epicNumber: number | null) {
    onChange(epicNumber);
    closeDropdown();
  }

  function isDone(opt: number | null): boolean {
    if (opt === null) return false;
    return epics.find((e) => e.number === opt)?.state === 'DONE';
  }

  function nextSelectableIndex(from: number, direction: 1 | -1): number {
    let i = from + direction;
    while (i >= 0 && i < options.length) {
      if (!isDone(options[i])) return i;
      i += direction;
    }
    return from;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => nextSelectableIndex(i, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => nextSelectableIndex(i, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < options.length && !isDone(options[activeIndex])) {
        select(options[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    }
  }

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={inputValue}
        placeholder="(no epic)"
        className="w-full bg-nord-2 border border-nord-3 rounded px-2 py-1.5 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={openDropdown}
        onBlur={() => setTimeout(closeDropdown, 150)}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-nord-1 border border-nord-3 rounded shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* "(no epic)" — always index 0 */}
          <li
            role="option"
            aria-selected={value === null}
            className={`px-2 py-1.5 text-sm cursor-pointer ${
              activeIndex === 0 ? 'bg-nord-3' : 'hover:bg-nord-2'
            }`}
            onClick={() => select(null)}
            onMouseEnter={() => setActiveIndex(0)}
          >
            <span className="text-nord-4">(no epic)</span>
          </li>

          {/* filtered epics — indices 1..n */}
          {filtered.map((epic, i) => {
            const optIdx = i + 1;
            const done = epic.state === 'DONE';
            const color = epic.color ?? defaultEpicColor(epic.number);
            return (
              <li
                key={epic.number}
                role="option"
                aria-selected={epic.number === value}
                aria-disabled={done}
                className={`px-2 py-1.5 text-sm flex items-center gap-2 ${
                  done ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${activeIndex === optIdx ? 'bg-nord-3' : done ? '' : 'hover:bg-nord-2'}`}
                onClick={() => { if (!done) select(epic.number); }}
                onMouseEnter={() => { if (!done) setActiveIndex(optIdx); }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className={done ? 'line-through' : ''}>
                  {epic.displayId} — {epic.title}{done ? ' (completed)' : ''}
                </span>
              </li>
            );
          })}

          {filtered.length === 0 && query !== '' && (
            <li className="px-2 py-1.5 text-sm text-nord-4 select-none">
              No matching epics
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
