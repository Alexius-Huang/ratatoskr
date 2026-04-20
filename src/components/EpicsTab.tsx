import { Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { TicketSummary } from '../../server/types';
import { useTickets } from '../lib/api';
import { fireEpicDoneConfetti } from '../lib/confetti';
import { extractTicketNumber } from '../lib/ticketId';
import { useMarkEpicDone, useUpdateTicket } from '../lib/ticketMutations';
import { EpicRow } from './EpicRow';
import { SplitPane } from './SplitPane';
import { TicketDetailPanel } from './TicketDetailPanel';

function EpicRowWithMutation({
  epic,
  isSelected,
  onClick,
  onViewTickets,
  projectName,
}: {
  epic: TicketSummary;
  isSelected: boolean;
  onClick: () => void;
  onViewTickets: () => void;
  projectName: string;
}) {
  const updateTicket = useUpdateTicket(projectName, epic.number);
  const markEpicDone = useMarkEpicDone(projectName);
  return (
    <EpicRow
      ticket={epic}
      isSelected={isSelected}
      onClick={onClick}
      onViewTickets={onViewTickets}
      onColorChange={(hex) => updateTicket.mutate({ color: hex })}
      onMarkDone={() =>
        markEpicDone.mutate(epic.number, {
          onSuccess: () => fireEpicDoneConfetti(),
        })
      }
    />
  );
}

export function EpicsTab() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: epics, isLoading, error } = useTickets(name ?? null, 'Epic');
  const [query, setQuery] = useState('');

  const inspectParam = searchParams.get('inspect');
  const inspectedNumber = extractTicketNumber(inspectParam);

  const clearInspect = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('inspect');
    next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const toggleInspect = (ticket: TicketSummary) => {
    const next = new URLSearchParams(searchParams);
    if (inspectParam === ticket.displayId) {
      next.delete('inspect');
      next.delete('view');
    } else {
      next.set('inspect', ticket.displayId);
      next.delete('view');
    }
    setSearchParams(next, { replace: true });
  };

  if (isLoading) {
    return <div className="p-6 text-nord-4">Loading epics…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
          Failed to load epics:{' '}
          {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  if (!epics || epics.length === 0) {
    return (
      <div className="p-6 text-nord-4">No epics in this project yet.</div>
    );
  }

  const sorted = [...epics].sort((a, b) => a.number - b.number);
  const active = sorted.filter((e) => e.state !== 'DONE');
  const completed = sorted.filter((e) => e.state === 'DONE');

  const q = query.trim().toLowerCase();
  const matches = (e: TicketSummary) =>
    q === '' || `${e.displayId} — ${e.title}`.toLowerCase().includes(q);
  const activeFiltered = active.filter(matches);
  const completedFiltered = completed.filter(matches);
  const hasMatches = activeFiltered.length > 0 || completedFiltered.length > 0;

  const renderRow = (e: TicketSummary) => (
    <EpicRowWithMutation
      key={e.number}
      epic={e}
      isSelected={e.displayId === inspectParam}
      onClick={() => toggleInspect(e)}
      onViewTickets={() => navigate(`/projects/${encodeURIComponent(name ?? '')}/tickets?epic=${e.number}`)}
      projectName={name ?? ''}
    />
  );

  const list = (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-nord-3 bg-nord-1">
        <div className="flex items-center bg-nord-2 border border-nord-3 rounded focus-within:border-nord-8 transition-colors">
          <Search size={14} className="ml-2 text-nord-4" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter epics by ID or title…"
            aria-label="Filter epics"
            className="bg-transparent pl-1.5 pr-2 py-1 text-sm text-nord-6 placeholder-nord-4 focus:outline-none w-full"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!hasMatches && q !== '' ? (
          <div className="p-6 text-nord-4">No matching epics</div>
        ) : (
          <>
            {activeFiltered.map(renderRow)}
            {completedFiltered.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-nord-4 bg-nord-1 border-y border-nord-3">
                  Completed ({completedFiltered.length})
                </div>
                <div className="opacity-40 grayscale-[40%]">
                  {completedFiltered.map(renderRow)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (!inspectParam || !name || inspectedNumber === null) {
    return <div className="h-full flex flex-col min-h-0">{list}</div>;
  }

  const detail = (
    <TicketDetailPanel
      projectName={name}
      number={inspectedNumber}
      displayId={inspectParam}
      onClose={clearInspect}
    />
  );

  return (
    <div className="h-full flex flex-col min-h-0">
      <SplitPane
        left={list}
        right={detail}
        storageKey="ratatoskr:epics-split"
      />
    </div>
  );
}
