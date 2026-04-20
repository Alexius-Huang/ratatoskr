import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { TicketSummary } from '../../server/types';
import { useTickets } from '../lib/api';
import { defaultEpicColor, tagStyle } from '../lib/epicColor';
import { stateColorClass, stateLabel } from '../lib/ticketState';
import { extractTicketNumber } from '../lib/ticketId';
import { useArchiveDoneTickets } from '../lib/ticketMutations';
import { CreateTicketModal } from './CreateTicketModal';
import { EpicSearchFilter } from './EpicSearchFilter';
import { TicketSearchFilter } from './TicketSearchFilter';
import { Button } from './ui/Button';
import { Modal } from './Modal';
import { SplitPane } from './SplitPane';
import { TicketDetailPanel } from './TicketDetailPanel';

export function TicketsTab() {
  const { name } = useParams<{ name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const { data: tickets, isLoading, error } = useTickets(name ?? null, ['Task', 'Bug']);
  const epics = useTickets(name ?? null, 'Epic');
  const archiveDone = useArchiveDoneTickets(name ?? '');

  const inspectParam = searchParams.get('inspect');
  const inspectedNumber = extractTicketNumber(inspectParam);

  const epicParam = searchParams.get('epic');
  const epicParamNumber =
    epicParam !== null && /^\d+$/.test(epicParam) ? Number(epicParam) : null;
  const activeEpicNumber = useMemo(() => {
    if (epicParamNumber === null) return null;
    const exists = epics.data?.some((e) => e.number === epicParamNumber);
    return exists ? epicParamNumber : null;
  }, [epicParamNumber, epics.data]);

  const qParam = searchParams.get('q') ?? '';

  const onEpicChange = (next: number | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === null) nextParams.delete('epic');
    else nextParams.set('epic', String(next));
    setSearchParams(nextParams, { replace: true });
  };

  const onQueryChange = (next: string) => {
    const nextParams = new URLSearchParams(searchParams);
    const trimmed = next.trim();
    if (trimmed === '') nextParams.delete('q');
    else nextParams.set('q', trimmed);
    setSearchParams(nextParams, { replace: true });
  };

  const filteredTickets = useMemo(() => {
    const q = qParam.trim().toLowerCase();
    let result = tickets ?? [];
    if (activeEpicNumber !== null) result = result.filter((t) => t.epic === activeEpicNumber);
    if (q !== '') result = result.filter((t) =>
      t.displayId.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)
    );
    return result;
  }, [tickets, activeEpicNumber, qParam]);

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
    return <div className="p-6 text-nord-4">Loading tickets…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
          Failed to load tickets:{' '}
          {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="p-6 text-nord-4">No tickets in this project yet.</div>
    );
  }

  const doneCount = tickets?.filter((t) => t.state === 'DONE').length ?? 0;

  const table = (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-6 pb-4 flex items-center gap-3">
        <EpicSearchFilter
          epics={epics.data ?? []}
          activeEpicNumber={activeEpicNumber}
          onEpicChange={onEpicChange}
        />
        <TicketSearchFilter query={qParam} onQueryChange={onQueryChange} />
        <div className="ml-auto flex gap-2">
          <Button
            variant="tertiary"
            onClick={() => setShowArchiveConfirm(true)}
            disabled={doneCount === 0}
            title={doneCount === 0 ? 'No done tickets to archive' : `Archive ${doneCount} done ticket${doneCount === 1 ? '' : 's'}`}
          >
            Archive Done Tickets
          </Button>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + Create
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-nord-0">
          <tr className="text-left text-nord-4 border-b border-nord-3">
            <th className="pb-2 pr-4 font-medium">ID</th>
            <th className="pb-2 pr-4 font-medium">Title</th>
            <th className="pb-2 pr-4 font-medium">State</th>
            <th className="pb-2 font-medium">Epic</th>
          </tr>
        </thead>
        <tbody>
          {filteredTickets.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-nord-4">No matching tickets</td>
            </tr>
          )}
          {filteredTickets.map((t: TicketSummary) => {
            const epicLabel =
              t.epicTitle ?? (t.epic !== undefined ? `#${t.epic}` : null);
            const isSelected = t.displayId === inspectParam;
            return (
              <tr
                key={t.number}
                onClick={() => toggleInspect(t)}
                className={`border-b border-nord-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-nord-2' : 'hover:bg-nord-2/70'
                }`}
              >
                <td className="py-2 pr-4 font-mono text-nord-8 whitespace-nowrap">
                  {t.type === 'Bug' && (
                    <span className="mr-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-nord-11/20 text-nord-11 align-middle">
                      BUG
                    </span>
                  )}
                  {t.displayId}
                </td>
                <td className="py-2 pr-4 text-nord-6">{t.title}</td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${stateColorClass(
                      t.state,
                    )}`}
                  >
                    {stateLabel(t.state)}
                  </span>
                </td>
                <td className="py-2">
                  {epicLabel !== null && t.epic !== undefined && (() => {
                    const s = tagStyle(t.epicColor ?? defaultEpicColor(t.epic));
                    return (
                      <span
                        className={`${s.className} max-w-[14rem] align-middle`}
                        style={s.style}
                        title={epicLabel}
                      >
                        {epicLabel}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );

  const modals = name ? (
    <>
      <CreateTicketModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        projectName={name}
      />
      <Modal
        open={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        title="Archive Done Tickets"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowArchiveConfirm(false)}
              className="px-4 py-2 text-sm font-medium bg-nord-3 text-nord-6 rounded hover:bg-nord-2 transition-colors"
            >
              Cancel
            </button>
            <Button
              variant="primary"
              size="md"
              disabled={archiveDone.isPending}
              onClick={() => {
                archiveDone.mutate(undefined, {
                  onSuccess: () => setShowArchiveConfirm(false),
                });
              }}
            >
              {archiveDone.isPending ? 'Archiving…' : 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-nord-6 text-sm">
          Are you sure to move all Done tickets to Archived?
        </p>
        {archiveDone.error && (
          <p className="mt-3 text-nord-11 text-sm">
            {archiveDone.error instanceof Error
              ? archiveDone.error.message
              : 'Something went wrong.'}
          </p>
        )}
      </Modal>
    </>
  ) : null;

  if (!inspectParam || !name || inspectedNumber === null) {
    return (
      <div className="h-full flex flex-col">
        {table}
        {modals}
      </div>
    );
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
        left={table}
        right={detail}
        storageKey="ratatoskr:tickets-split"
      />
      {modals}
    </div>
  );
}

