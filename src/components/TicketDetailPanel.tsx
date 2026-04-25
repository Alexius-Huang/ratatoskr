import { ApiError } from '../lib/api';
import { useTicketDetailState } from '../lib/useTicketDetailState';
import { PanelShell } from './ui/PanelShell';
import { CommentForm } from './CommentForm';
import { TicketDetailView } from './TicketDetailView';
import { TicketPlanView } from './TicketPlanView';

type Props = {
  projectName: string;
  number: number;
  displayId: string;
  onClose: () => void;
  variant?: 'pane' | 'modal';
};

export function TicketDetailPanel({
  projectName,
  number,
  displayId,
  onClose,
  variant = 'pane',
}: Props) {
  const {
    data,
    isLoading,
    error,
    isPlanView,
    hasPlan,
    planQuery,
    showEdit,
    closeEdit,
    archiveMutation,
    planAction,
    actions,
    epicLabel,
  } = useTicketDetailState(projectName, number, onClose);

  if (isLoading) {
    return (
      <PanelShell onClose={onClose} title={displayId} actions={[]} variant={variant}>
        <div className="text-nord-4">Loading…</div>
      </PanelShell>
    );
  }

  if (error) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    return (
      <PanelShell onClose={onClose} title={displayId} actions={[]} variant={variant}>
        {isNotFound ? (
          <div className="text-nord-4 italic">Ticket {displayId} not found.</div>
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
        variant={variant}
      >
        <TicketPlanView
          path={data.planDoc}
          isLoading={planQuery.isLoading}
          error={planQuery.error}
          body={planQuery.data?.body}
        />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      onClose={onClose}
      title={data.displayId}
      actions={actions}
      variant={variant}
      footer={<CommentForm projectName={projectName} ticketNumber={data.number} />}
    >
      <TicketDetailView
        data={data}
        archiveError={archiveMutation.error}
        showEdit={showEdit}
        onCloseEdit={closeEdit}
        projectName={projectName}
        epicLabel={epicLabel}
      />
    </PanelShell>
  );
}
