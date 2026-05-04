import { useRef } from 'react';
import { ApiError, useAppConfig } from '../lib/api';
import { useTicketDetailState } from '../lib/useTicketDetailState';
import { useScrollToBottom } from '../lib/useScrollToBottom';
import { useLaunchClaudeSkill, launchErrorMessage } from '../lib/useLaunchClaudeSkill';
import { isPreReady } from '../lib/ticketState';
import { PanelShell } from './ui/PanelShell';
import type { HeaderAction } from './ui/PanelShell';
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: config } = useAppConfig();
  const launchMutation = useLaunchClaudeSkill();

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

  const atBottom = useScrollToBottom(scrollRef, data?.number);
  const workspaceRoot = config?.workspaceRoot;

  const planWithClaudeAction: HeaderAction | null =
    data && isPreReady(data.state) && workspaceRoot
      ? {
          label: 'Plan with Claude',
          onClick: () =>
            launchMutation.mutate({
              projectPath: workspaceRoot,
              ticketId: data.displayId,
              mode: 'plan',
            }),
          disabled: !atBottom || launchMutation.isPending,
          tooltip: !atBottom ? 'Scroll to the bottom to enable' : undefined,
        }
      : null;

  const detailActions: HeaderAction[] = planWithClaudeAction
    ? [...actions, planWithClaudeAction]
    : actions;

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
        scrollRef={scrollRef}
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
      actions={detailActions}
      variant={variant}
      scrollRef={scrollRef}
      footer={<CommentForm projectName={projectName} ticketNumber={data.number} />}
    >
      <TicketDetailView
        data={data}
        archiveError={archiveMutation.error}
        showEdit={showEdit}
        onCloseEdit={closeEdit}
        projectName={projectName}
        epicLabel={epicLabel}
        launchError={launchMutation.error ? launchErrorMessage(launchMutation.error) : null}
      />
    </PanelShell>
  );
}
