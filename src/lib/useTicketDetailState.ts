import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, useTicketDetail, useTicketPlan } from './api';
import { useArchiveTicket } from './ticketMutations';
import type { HeaderAction } from '../components/ui/PanelShell';

export type { HeaderAction };

export function useTicketDetailState(
  projectName: string,
  number: number,
  onClose: () => void,
) {
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

  const handleArchive = async () => {
    if (!data) return;
    try {
      await archiveMutation.mutateAsync(data.number);
      onClose();
    } catch {
      // error surfaces via archiveMutation.error
    }
  };

  const planAction: HeaderAction | null =
    !isLoading && data && hasPlan
      ? isPlanView
        ? { label: 'Back to ticket', onClick: clearPlanView }
        : { label: 'View plan', onClick: setPlanView }
      : null;

  const epicLabel =
    data?.epicTitle ?? (data?.epic !== undefined ? `#${data.epic}` : null);

  const nonDoneChildren =
    data?.type === 'Epic' && data.childCounts
      ? Object.entries(data.childCounts.byState)
          .filter(([state]) => state !== 'DONE')
          .reduce((sum, [, count]) => sum + count, 0)
      : 0;

  const archiveDisabled = data?.type === 'Epic' && nonDoneChildren > 0;
  const archiveTooltip = archiveDisabled
    ? `Cannot archive: ${nonDoneChildren} active non-DONE ${nonDoneChildren === 1 ? 'child' : 'children'}`
    : undefined;

  const actions: HeaderAction[] = data
    ? [
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
          ? [
              {
                label: 'View tickets',
                onClick: () =>
                  navigate(
                    `/projects/${encodeURIComponent(projectName)}/tickets?epic=${data.number}`,
                  ),
              },
            ]
          : []),
      ]
    : [];

  return {
    data,
    isLoading,
    error,
    isPlanView,
    hasPlan,
    planQuery,
    showEdit,
    openEdit: () => setShowEdit(true),
    closeEdit: () => setShowEdit(false),
    archiveMutation,
    handleArchive,
    planAction,
    actions,
    epicLabel,
    archiveDisabled,
    archiveTooltip,
    ApiError,
  };
}
