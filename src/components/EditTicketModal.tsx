import { useState } from 'react';
import type { TicketDetail, TicketState, TicketType } from '../../server/types';
import { useTickets } from '../lib/api';
import { useUpdateTicket } from '../lib/ticketMutations';
import { TicketFormModal } from './TicketFormModal';

const NON_EPIC_TYPES: TicketType[] = ['Task', 'Bug'];

type Props = {
  open: boolean;
  onClose: () => void;
  projectName: string;
  ticket: TicketDetail;
};

export function EditTicketModal({ open, onClose, projectName, ticket }: Props) {
  const [title, setTitle] = useState(ticket.title);
  const [state, setState] = useState<TicketState>(ticket.state);
  const [type, setType] = useState<TicketType>(ticket.type);
  const [epicNum, setEpicNum] = useState<number | null>(ticket.epic ?? null);
  const [body, setBody] = useState(ticket.body);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const epicsQuery = useTickets(projectName, 'Epic');
  const updateMutation = useUpdateTicket(projectName, ticket.number);

  const handleClose = () => {
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

    const patch: {
      title?: string;
      state?: TicketState;
      type?: TicketType;
      epic?: number | null;
      body?: string;
    } = {};
    if (trimmed !== ticket.title) patch.title = trimmed;
    if (state !== ticket.state) patch.state = state;
    if (type !== ticket.type) patch.type = type;
    if (body !== ticket.body) patch.body = body;
    if (epicNum !== (ticket.epic ?? null)) patch.epic = epicNum;

    try {
      await updateMutation.mutateAsync(patch);
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <TicketFormModal
      open={open}
      modalTitle={`Edit ${ticket.displayId}`}
      submitLabel="Save"
      submittingLabel="Saving…"
      isSubmitting={updateMutation.isPending}
      onSubmit={handleSubmit}
      onClose={handleClose}
      error={submitError}
      type={type}
      onTypeChange={setType}
      typeOptions={ticket.type === 'Epic' ? ['Epic' as TicketType] : NON_EPIC_TYPES}
      typeDisabled={ticket.type === 'Epic'}
      state={state}
      onStateChange={setState}
      showEpic={ticket.type !== 'Epic'}
      epics={epicsQuery.data ?? []}
      epicNum={epicNum}
      onEpicChange={setEpicNum}
      title={title}
      onTitleChange={setTitle}
      body={body}
      onBodyChange={setBody}
    />
  );
}
