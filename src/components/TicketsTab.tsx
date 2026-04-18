import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { TicketSummary } from '../../server/types';
import { useTickets } from '../lib/api';
import { stateColorClass, stateLabel } from '../lib/ticketState';
import { extractTicketNumber } from '../lib/ticketId';
import { useArchiveDoneTickets } from '../lib/ticketMutations';
import { CreateTicketModal } from './CreateTicketModal';
import { Modal } from './Modal';
import { SplitPane } from './SplitPane';
import { TicketDetailPanel } from './TicketDetailPanel';

export function TicketsTab() {
  const { name } = useParams<{ name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const { data: tickets, isLoading, error } = useTickets(name ?? null, ['Task', 'Bug']);
  const archiveDone = useArchiveDoneTickets(name ?? '');

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
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex justify-end gap-2 mb-4">
        <button
          type="button"
          onClick={() => setShowArchiveConfirm(true)}
          disabled={doneCount === 0}
          title={doneCount === 0 ? 'No done tickets to archive' : `Archive ${doneCount} done ticket${doneCount === 1 ? '' : 's'}`}
          className="px-3 py-1.5 text-sm font-medium bg-nord-3 text-nord-4 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-nord-2 enabled:hover:text-nord-6"
        >
          Archive Done Tickets
        </button>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 text-sm font-medium bg-nord-10 text-nord-6 rounded hover:bg-nord-9 transition-colors"
        >
          + Create
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-nord-4 border-b border-nord-3">
            <th className="pb-2 pr-4 font-medium">ID</th>
            <th className="pb-2 pr-4 font-medium">Title</th>
            <th className="pb-2 pr-4 font-medium">State</th>
            <th className="pb-2 font-medium">Epic</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t: TicketSummary) => {
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
                  {epicLabel !== null && (
                    <span
                      className="inline-block max-w-[14rem] truncate align-middle px-2 py-0.5 rounded bg-nord-15/20 text-nord-15 text-xs font-medium"
                      title={epicLabel}
                    >
                      {epicLabel}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
            <button
              type="button"
              disabled={archiveDone.isPending}
              onClick={() => {
                archiveDone.mutate(undefined, {
                  onSuccess: () => setShowArchiveConfirm(false),
                });
              }}
              className="px-4 py-2 text-sm font-medium bg-nord-10 text-nord-6 rounded hover:bg-nord-9 transition-colors disabled:opacity-50"
            >
              {archiveDone.isPending ? 'Archiving…' : 'Confirm'}
            </button>
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

