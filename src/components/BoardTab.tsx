import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { TicketState, TicketSummary } from '../../server/types';
import { useTickets } from '../lib/api';
import { extractTicketNumber } from '../lib/ticketId';
import { useArchiveDoneTickets, useTransitionTicketState } from '../lib/ticketMutations';
import { BoardColumn } from './BoardColumn';
import { CreateTicketModal } from './CreateTicketModal';
import { EpicSearchFilter } from './EpicSearchFilter';
import { Modal } from './Modal';
import { TicketDetailModal } from './TicketDetailModal';
import { Toast } from './Toast';

const BOARD_STATES: readonly TicketState[] = [
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
];

const BOARD_STATE_SET = new Set<TicketState>(BOARD_STATES);

export function BoardTab() {
  const { name } = useParams<{ name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const inspectParam = searchParams.get('inspect');
  const inspectedNumber = extractTicketNumber(inspectParam);

  const clearInspect = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('inspect');
    next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const openInspect = (ticket: TicketSummary) => {
    const next = new URLSearchParams(searchParams);
    next.set('inspect', ticket.displayId);
    next.delete('view');
    setSearchParams(next, { replace: true });
  };
  const archiveDone = useArchiveDoneTickets(name ?? '');
  const transition = useTransitionTicketState(name ?? '');

  const tasks = useTickets(name ?? null, ['Task', 'Bug']);
  const epics = useTickets(name ?? null, 'Epic');

  const epicParam = searchParams.get('epic');
  const epicParamNumber =
    epicParam !== null && /^\d+$/.test(epicParam) ? Number(epicParam) : null;
  const activeEpicNumber = useMemo(() => {
    if (epicParamNumber === null) return null;
    const exists = epics.data?.some((e) => e.number === epicParamNumber);
    return exists ? epicParamNumber : null;
  }, [epicParamNumber, epics.data]);

  const onEpicChange = (next: number | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === null) nextParams.delete('epic');
    else nextParams.set('epic', String(next));
    setSearchParams(nextParams, { replace: true });
  };

  const byState = useMemo(() => {
    const buckets: Record<TicketState, TicketSummary[]> = {
      NOT_READY: [],
      PLANNING: [],
      READY: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const t of tasks.data ?? []) {
      if (!BOARD_STATE_SET.has(t.state)) continue;
      if (activeEpicNumber !== null && t.epic !== activeEpicNumber) continue;
      buckets[t.state].push(t);
    }
    return buckets;
  }, [tasks.data, activeEpicNumber]);

  useEffect(() => {
    if (!name) return;
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === 'ticket',
      onDrop: ({ source, location }) => {
        const target = location.current.dropTargets[0];
        if (!target || target.data.type !== 'column') return;
        const fromState = source.data.fromState as TicketState;
        const toState = target.data.toState as TicketState;
        const num = source.data.number as number;
        if (fromState === toState) return;
        transition.mutate(
          { num, state: toState },
          {
            onError: (err) => {
              const msg = err instanceof Error ? err.message : String(err);
              setToast(`Couldn't move ticket: ${msg}`);
            },
          },
        );
      },
    });
  }, [name, transition]);

  if (tasks.isLoading) {
    return <div className="p-6 text-nord-4">Loading tickets…</div>;
  }

  if (tasks.error) {
    return (
      <div className="p-6">
        <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
          Failed to load tickets:{' '}
          {tasks.error instanceof Error
            ? tasks.error.message
            : String(tasks.error)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <EpicSearchFilter
          epics={epics.data ?? []}
          activeEpicNumber={activeEpicNumber}
          onEpicChange={onEpicChange}
        />
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setShowArchiveConfirm(true)}
            disabled={byState['DONE'].length === 0}
            title={
              byState['DONE'].length === 0
                ? 'No done tickets to archive'
                : `Archive ${byState['DONE'].length} done ticket${byState['DONE'].length === 1 ? '' : 's'}`
            }
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
      </div>

      <div className="flex-1 min-h-0 flex gap-3">
        {BOARD_STATES.map((state) => (
          <BoardColumn key={state} state={state} tickets={byState[state]} onCardClick={openInspect} />
        ))}
      </div>
      {name && inspectParam && inspectedNumber !== null && (
        <TicketDetailModal
          projectName={name}
          number={inspectedNumber}
          displayId={inspectParam}
          onClose={clearInspect}
        />
      )}
      {name && (
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
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
