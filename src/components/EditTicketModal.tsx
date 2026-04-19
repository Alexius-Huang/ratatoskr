import { useEffect, useState } from 'react';
import type { TicketDetail, TicketState, TicketType } from '../../server/types';
import { useTickets } from '../lib/api';
import { useUpdateTicket } from '../lib/ticketMutations';
import { EpicCombobox } from './EpicCombobox';
import { Modal } from './Modal';

const NON_EPIC_TYPES: TicketType[] = ['Task', 'Bug'];
const TICKET_STATES: TicketState[] = [
  'NOT_READY',
  'PLANNING',
  'READY',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
];

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

  useEffect(() => {
    if (open) {
      setTitle(ticket.title);
      setState(ticket.state);
      setType(ticket.type);
      setEpicNum(ticket.epic ?? null);
      setBody(ticket.body);
      setSubmitError(null);
    }
  }, [open, ticket]);

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

    const newEpic = epicNum;
    const oldEpic = ticket.epic ?? null;
    if (newEpic !== oldEpic) patch.epic = newEpic;

    try {
      await updateMutation.mutateAsync(patch);
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={handleClose}
        className="px-3 py-1.5 text-sm text-nord-4 hover:text-nord-6 border border-nord-3 rounded transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={updateMutation.isPending}
        className="px-3 py-1.5 text-sm font-medium bg-nord-10 text-nord-6 rounded hover:bg-nord-9 disabled:opacity-50 transition-colors"
      >
        {updateMutation.isPending ? 'Saving…' : 'Save'}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={handleClose} title={`Edit ${ticket.displayId}`} footer={footer}>
      {submitError && (
        <div className="mb-4 bg-nord-2 border border-nord-11 rounded p-3 text-nord-11 text-sm">
          {submitError}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <label className="flex flex-col gap-1 w-32 shrink-0">
            <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TicketType)}
              disabled={ticket.type === 'Epic'}
              className="bg-nord-2 border border-nord-3 rounded px-2 py-1.5 text-sm text-nord-6 focus:outline-none focus:border-nord-8 disabled:opacity-50"
            >
              {ticket.type === 'Epic'
                ? <option value="Epic">Epic</option>
                : NON_EPIC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)
              }
            </select>
          </label>

          <label className="flex flex-col gap-1 w-40 shrink-0">
            <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">State</span>
            <select
              value={state}
              onChange={(e) => setState(e.target.value as TicketState)}
              className="bg-nord-2 border border-nord-3 rounded px-2 py-1.5 text-sm text-nord-6 focus:outline-none focus:border-nord-8"
            >
              {TICKET_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          {ticket.type !== 'Epic' && (
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Epic (optional)</span>
              <EpicCombobox
                epics={epicsQuery.data ?? []}
                value={epicNum}
                onChange={setEpicNum}
              />
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Title</span>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 focus:outline-none focus:border-nord-8"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm font-mono text-nord-6 focus:outline-none focus:border-nord-8 resize-y"
          />
        </label>
      </div>
    </Modal>
  );
}
