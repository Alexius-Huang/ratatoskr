import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { TicketSummary } from '../../server/types';
import { useTickets } from '../lib/api';
import { extractTicketNumber } from '../lib/ticketId';
import { useUpdateTicket } from '../lib/ticketMutations';
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
  return (
    <EpicRow
      ticket={epic}
      isSelected={isSelected}
      onClick={onClick}
      onViewTickets={onViewTickets}
      onColorChange={(hex) => updateTicket.mutate({ color: hex })}
    />
  );
}

export function EpicsTab() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: epics, isLoading, error } = useTickets(name ?? null, 'Epic');

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

  const list = (
    <div className="h-full overflow-y-auto">
      {sorted.map((e) => (
        <EpicRowWithMutation
          key={e.number}
          epic={e}
          isSelected={e.displayId === inspectParam}
          onClick={() => toggleInspect(e)}
          onViewTickets={() => navigate(`/projects/${encodeURIComponent(name ?? '')}/tickets?epic=${e.number}`)}
          projectName={name ?? ''}
        />
      ))}
    </div>
  );

  if (!inspectParam || !name || inspectedNumber === null) {
    return <div className="h-full flex flex-col">{list}</div>;
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
    <div className="h-full flex flex-col">
      <SplitPane
        left={list}
        right={detail}
        storageKey="ratatoskr:epics-split"
      />
    </div>
  );
}
