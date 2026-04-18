import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ArchivedTicketRecord } from '../../server/types';
import { useArchive } from '../lib/api';
import { stateColorClass, stateLabel } from '../lib/ticketState';

function formatArchived(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

function haystack(r: ArchivedTicketRecord): string {
  return (r.title + '\n' + r.body + '\n' + r.displayId).toLowerCase();
}

export function ArchiveTab() {
  const { name } = useParams<{ name: string }>();
  const [query, setQuery] = useState('');
  const { data: records, isLoading, error } = useArchive(name ?? null);

  const trimmed = query.trim().toLowerCase();
  const filtered = records
    ? trimmed
      ? records.filter((r) => haystack(r).includes(trimmed))
      : records
    : [];

  return (
    <div className="p-6 flex flex-col gap-4 h-full overflow-hidden">
      {/* Search box */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, ID, or body…"
          className="w-full bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8 pr-8"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-nord-4 hover:text-nord-6 text-lg leading-none"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="text-nord-4 text-sm">Loading archive…</div>
        )}

        {error && (
          <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
            Failed to load archive:{' '}
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}

        {!isLoading && !error && records && records.length === 0 && (
          <div className="text-nord-4 text-sm">No archived tickets.</div>
        )}

        {!isLoading && !error && records && records.length > 0 && filtered.length === 0 && (
          <div className="text-nord-4 text-sm">
            No tickets match &ldquo;{query}&rdquo;.
          </div>
        )}

        {filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-nord-4 border-b border-nord-3">
                <th className="pb-2 pr-4 font-medium">ID</th>
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">State</th>
                <th className="pb-2 font-medium">Archived</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.number}
                  className="border-b border-nord-3"
                >
                  <td className="py-2 pr-4 font-mono text-nord-8 whitespace-nowrap">
                    {r.type === 'Bug' && (
                      <span className="mr-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-nord-11/20 text-nord-11 align-middle">
                        BUG
                      </span>
                    )}
                    {r.displayId}
                  </td>
                  <td className="py-2 pr-4 text-nord-6">{r.title}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${stateColorClass(r.state)}`}
                    >
                      {stateLabel(r.state)}
                    </span>
                  </td>
                  <td
                    className="py-2 text-nord-4 text-xs whitespace-nowrap"
                    title={r.archived}
                  >
                    {formatArchived(r.archived)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
