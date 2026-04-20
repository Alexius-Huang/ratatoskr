import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TicketState, TicketType } from '../../server/types';
import { useTickets } from '../lib/api';
import { useCreateTicket } from '../lib/ticketMutations';
import { TicketFormModal } from './TicketFormModal';

const TICKET_TYPES: TicketType[] = ['Task', 'Bug', 'Epic'];

type Props = {
  open: boolean;
  onClose: () => void;
  projectName: string;
};

function scaffoldBody(title: string): string {
  return `# ${title}\n\n## Description\n\n\n\n## Acceptance Criteria\n\n`;
}

export function CreateTicketModal({ open, onClose, projectName }: Props) {
  const [, setSearchParams] = useSearchParams();
  const [type, setType] = useState<TicketType>('Task');
  const [title, setTitle] = useState('');
  const [state, setState] = useState<TicketState>('NOT_READY');
  const [epicNum, setEpicNum] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [bodyTouched, setBodyTouched] = useState(false);
  const [wontDoReason, setWontDoReason] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const epicsQuery = useTickets(projectName, 'Epic');
  const createMutation = useCreateTicket(projectName);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!bodyTouched) setBody(scaffoldBody(val));
  };

  const handleClose = () => {
    setType('Task');
    setTitle('');
    setState('NOT_READY');
    setEpicNum(null);
    setBody('');
    setBodyTouched(false);
    setWontDoReason('');
    setSubmitError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setSubmitError('Title is required.');
      return;
    }
    setSubmitError(null);
    try {
      const detail = await createMutation.mutateAsync({
        type,
        title: trimmed,
        state,
        epic: (type !== 'Epic' && epicNum !== null) ? epicNum : undefined,
        body: body || scaffoldBody(trimmed),
        wont_do_reason: state === 'WONT_DO' ? wontDoReason.trim() : undefined,
      });
      handleClose();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('inspect', detail.displayId);
        next.delete('view');
        return next;
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <TicketFormModal
      open={open}
      modalTitle="Create ticket"
      submitLabel="Create"
      submittingLabel="Creating…"
      isSubmitting={createMutation.isPending}
      onSubmit={handleSubmit}
      onClose={handleClose}
      error={submitError}
      type={type}
      onTypeChange={(t) => { setType(t); if (t === 'Epic') setEpicNum(null); }}
      typeOptions={TICKET_TYPES}
      state={state}
      onStateChange={setState}
      wontDoReason={wontDoReason}
      onWontDoReasonChange={setWontDoReason}
      showEpic={type !== 'Epic'}
      epics={epicsQuery.data ?? []}
      epicNum={epicNum}
      onEpicChange={setEpicNum}
      title={title}
      onTitleChange={handleTitleChange}
      body={body}
      onBodyChange={(v) => { setBody(v); setBodyTouched(true); }}
    />
  );
}
