import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, useTicketDetail, useTicketPlan } from '../lib/api';
import { useArchiveTicket } from '../lib/ticketMutations';
import { stateColorClass, stateLabel } from '../lib/ticketState';
import { EditTicketModal } from './EditTicketModal';
import { MarkdownBody } from './MarkdownBody';

type Props = {
  projectName: string;
  number: number;
  displayId: string;
  onClose: () => void;
};

export function TicketDetailPanel({
  projectName,
  number,
  displayId,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showEdit, setShowEdit] = useState(false);
  const isPlanView = searchParams.get('view') === 'plan';
  const archiveMutation = useArchiveTicket(projectName);

  const { data, isLoading, error } = useTicketDetail(projectName, number);
  const hasPlan = Boolean(data?.planDoc);
  const planQuery = useTicketPlan(projectName, number, isPlanView && hasPlan);

  const setPlanView = () => {
    const next = new URLSearchParams(searchParams);
    next.set('view', 'plan');
    setSearchParams(next, { replace: true });
  };

  const clearPlanView = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const planAction: HeaderAction | null =
    !isLoading && data && hasPlan
      ? isPlanView
        ? { label: 'Back to ticket', onClick: clearPlanView }
        : { label: 'View plan', onClick: setPlanView }
      : null;

  const handleArchive = async () => {
    if (!data) return;
    try {
      await archiveMutation.mutateAsync(data.number);
      onClose();
    } catch {
      // error surfaces via archiveMutation.error — no-op here
    }
  };

  if (isLoading) {
    return (
      <PanelShell
        onClose={onClose}
        title={displayId}
        actions={[]}
      >
        <div className="text-nord-4">Loading…</div>
      </PanelShell>
    );
  }

  if (error) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    return (
      <PanelShell onClose={onClose} title={displayId} actions={[]}>
        {isNotFound ? (
          <div className="text-nord-4 italic">
            Ticket {displayId} not found.
          </div>
        ) : (
          <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
            Failed to load ticket:{' '}
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}
      </PanelShell>
    );
  }

  if (!data) return null;

  if (isPlanView && hasPlan) {
    return (
      <PanelShell
        onClose={onClose}
        title={data.displayId}
        actions={planAction ? [planAction] : []}
      >
        <PlanBody
          path={data.planDoc}
          isLoading={planQuery.isLoading}
          error={planQuery.error}
          body={planQuery.data?.body}
        />
      </PanelShell>
    );
  }

  const epicLabel =
    data.epicTitle ?? (data.epic !== undefined ? `#${data.epic}` : null);

  const nonDoneChildren = data.type === 'Epic' && data.childCounts
    ? Object.entries(data.childCounts.byState)
        .filter(([state]) => state !== 'DONE')
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  const archiveDisabled = data.type === 'Epic' && nonDoneChildren > 0;
  const archiveTooltip = archiveDisabled
    ? `Cannot archive: ${nonDoneChildren} active non-DONE ${nonDoneChildren === 1 ? 'child' : 'children'}`
    : undefined;

  const actions: HeaderAction[] = [
    { label: 'Edit', onClick: () => setShowEdit(true) },
    {
      label: archiveMutation.isPending ? 'Archiving…' : 'Archive',
      onClick: handleArchive,
      disabled: archiveDisabled || archiveMutation.isPending,
      tooltip: archiveTooltip,
      variant: 'danger',
    },
    ...(planAction ? [planAction] : []),
    ...(data.type === 'Epic'
      ? [{ label: 'View tickets', onClick: () => navigate(`/projects/${encodeURIComponent(projectName)}/tickets?epic=${data.number}`) }]
      : []),
  ];

  return (
    <>
    <PanelShell onClose={onClose} title={data.displayId} actions={actions}>
      <h1 className="text-xl font-semibold text-nord-6 mb-3">{data.title}</h1>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${stateColorClass(data.state)}`}
        >
          {stateLabel(data.state)}
        </span>
        {epicLabel !== null && (
          <span
            className="inline-block max-w-full truncate px-2 py-0.5 rounded bg-nord-15/20 text-nord-15 text-xs font-medium"
            title={epicLabel}
          >
            {epicLabel}
          </span>
        )}
        <span className="text-xs text-nord-4">{data.type}</span>
      </div>
      <MarkdownBody source={data.body} />
      {archiveMutation.error && (
        <div className="mt-4 bg-nord-2 border border-nord-11 rounded p-3 text-nord-11 text-sm">
          Archive failed: {archiveMutation.error instanceof Error ? archiveMutation.error.message : String(archiveMutation.error)}
        </div>
      )}
    </PanelShell>
    <EditTicketModal
      open={showEdit}
      onClose={() => setShowEdit(false)}
      projectName={projectName}
      ticket={data}
    />
    </>
  );
}

function PlanBody({
  path,
  isLoading,
  error,
  body,
}: {
  path?: string;
  isLoading: boolean;
  error: unknown;
  body: string | undefined;
}) {
  if (isLoading) {
    return <div className="text-nord-4">Loading plan…</div>;
  }
  if (error) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    if (isNotFound) {
      return (
        <div className="text-nord-4 italic">
          {error instanceof Error ? error.message : 'Plan not available.'}
        </div>
      );
    }
    return (
      <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
        Failed to load plan:{' '}
        {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }
  if (!body) return null;
  return (
    <>
      {path && (
        <p className="font-mono text-xs text-nord-4 mb-4">{path}</p>
      )}
      <MarkdownBody source={body} />
    </>
  );
}

type HeaderAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
  variant?: 'default' | 'danger';
};

function PanelShell({
  onClose,
  title,
  actions,
  children,
}: {
  onClose: () => void;
  title: string;
  actions: HeaderAction[];
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col bg-nord-0 border-l border-nord-3">
      <header className="flex items-center justify-between px-6 py-3 border-b border-nord-3 bg-nord-1 gap-3">
        <span className="font-mono text-sm text-nord-8 shrink-0">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              title={a.tooltip}
              className={`text-xs font-medium border rounded px-2 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                a.variant === 'danger'
                  ? 'text-nord-11 border-nord-11/50 hover:border-nord-11 hover:bg-nord-11/10'
                  : 'text-nord-8 hover:text-nord-6 border-nord-3 hover:border-nord-8'
              }`}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="text-nord-4 hover:text-nord-6 text-lg leading-none px-2"
            aria-label="Close detail panel"
          >
            ×
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
    </div>
  );
}
