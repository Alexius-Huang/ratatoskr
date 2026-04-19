import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TicketState, TicketType } from '../../server/types';
import { useTickets } from '../lib/api';
import { useCreateTicket } from '../lib/ticketMutations';
import { Modal } from './Modal';

const TICKET_TYPES: TicketType[] = ['Task', 'Bug', 'Epic'];
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
};

function scaffoldBody(title: string): string {
  return `# ${title}\n\n## Description\n\n\n\n## Acceptance Criteria\n\n`;
}

export function CreateTicketModal({ open, onClose, projectName }: Props) {
  const [, setSearchParams] = useSearchParams();
  const [type, setType] = useState<TicketType>('Task');
  const [title, setTitle] = useState('');
  const [state, setState] = useState<TicketState>('NOT_READY');
  const [epicNum, setEpicNum] = useState<string>('');
  const [body, setBody] = useState('');
  const [bodyTouched, setBodyTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const epicsQuery = useTickets(projectName, 'Epic');
  const createMutation = useCreateTicket(projectName);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!bodyTouched) {
      setBody(scaffoldBody(val));
    }
  };

  const handleClose = () => {
    setType('Task');
    setTitle('');
    setState('NOT_READY');
    setEpicNum('');
    setBody('');
    setBodyTouched(false);
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
        epic: (type !== 'Epic' && epicNum) ? Number(epicNum) : undefined,
        body: body || scaffoldBody(trimmed),
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
        disabled={createMutation.isPending}
        className="px-3 py-1.5 text-sm font-medium bg-nord-10 text-nord-6 rounded hover:bg-nord-9 disabled:opacity-50 transition-colors"
      >
        {createMutation.isPending ? 'Creating…' : 'Create'}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={handleClose} title="Create ticket" footer={footer}>
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
              onChange={(e) => {
                setType(e.target.value as TicketType);
                if (e.target.value === 'Epic') setEpicNum('');
              }}
              className="bg-nord-2 border border-nord-3 rounded px-2 py-1.5 text-sm text-nord-6 focus:outline-none focus:border-nord-8"
            >
              {TICKET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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

          {type !== 'Epic' && (
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Epic (optional)</span>
              <select
                value={epicNum}
                onChange={(e) => setEpicNum(e.target.value)}
                className="bg-nord-2 border border-nord-3 rounded px-2 py-1.5 text-sm text-nord-6 focus:outline-none focus:border-nord-8"
              >
                <option value="">(no epic)</option>
                {epicsQuery.data?.map((e) => (
                  <option
                    key={e.number}
                    value={String(e.number)}
                    disabled={e.state === 'DONE'}
                    title={e.state === 'DONE' ? 'Completed — cannot assign new tickets' : undefined}
                  >
                    {e.displayId} — {e.title}{e.state === 'DONE' ? ' (completed)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Title</span>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Ticket title"
            className="bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Body</span>
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); setBodyTouched(true); }}
            rows={12}
            className="bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm font-mono text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8 resize-y"
          />
        </label>
      </div>
    </Modal>
  );
}
