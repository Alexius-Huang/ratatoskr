import { Search, X } from 'lucide-react';

type TicketSearchFilterProps = {
  query: string;
  onQueryChange: (next: string) => void;
};

export function TicketSearchFilter({ query, onQueryChange }: TicketSearchFilterProps) {
  return (
    <div className="flex items-center bg-nord-2 border border-nord-3 rounded focus-within:border-nord-8 transition-colors">
      <Search className="ml-2 w-3.5 h-3.5 text-nord-4 shrink-0" />
      <input
        type="text"
        aria-label="Filter by title or ID"
        placeholder="Filter by title or ID…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="bg-transparent pl-1.5 pr-2 py-1 text-sm text-nord-6 placeholder-nord-4 focus:outline-none w-44"
      />
      {query !== '' && (
        <button
          type="button"
          aria-label="Clear title or ID filter"
          onClick={() => onQueryChange('')}
          className="mr-1.5 rounded hover:opacity-70 p-0.5 transition-opacity text-nord-4"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
