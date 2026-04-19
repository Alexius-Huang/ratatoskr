import type { TicketState, TicketType } from '../../server/types';
import type { TicketSummary } from '../../server/types';
import { EpicCombobox } from './EpicCombobox';
import { Button } from './ui/Button';
import { Modal } from './Modal';

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
  modalTitle: string;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
  error: string | null;
  type: TicketType;
  onTypeChange: (t: TicketType) => void;
  typeOptions: TicketType[];
  typeDisabled?: boolean;
  state: TicketState;
  onStateChange: (s: TicketState) => void;
  showEpic: boolean;
  epics: TicketSummary[];
  epicNum: number | null;
  onEpicChange: (n: number | null) => void;
  title: string;
  onTitleChange: (v: string) => void;
  body: string;
  onBodyChange: (v: string) => void;
};

export function TicketFormModal({
  open, modalTitle, submitLabel, submittingLabel, isSubmitting,
  onSubmit, onClose, error,
  type, onTypeChange, typeOptions, typeDisabled,
  state, onStateChange,
  showEpic, epics, epicNum, onEpicChange,
  title, onTitleChange,
  body, onBodyChange,
}: Props) {
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={onSubmit} disabled={isSubmitting}>
        {isSubmitting ? submittingLabel : submitLabel}
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} footer={footer}>
      {error && (
        <div className="mb-4 bg-nord-2 border border-nord-11 rounded p-3 text-nord-11 text-sm">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <label className="flex flex-col gap-1 w-32 shrink-0">
            <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Type</span>
            <select
              value={type}
              onChange={(e) => onTypeChange(e.target.value as TicketType)}
              disabled={typeDisabled}
              className="bg-nord-2 border border-nord-3 rounded px-2 py-1.5 text-sm text-nord-6 focus:outline-none focus:border-nord-8 disabled:opacity-50"
            >
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 w-40 shrink-0">
            <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">State</span>
            <select
              value={state}
              onChange={(e) => onStateChange(e.target.value as TicketState)}
              className="bg-nord-2 border border-nord-3 rounded px-2 py-1.5 text-sm text-nord-6 focus:outline-none focus:border-nord-8"
            >
              {TICKET_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {showEpic && (
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Epic (optional)</span>
              <EpicCombobox epics={epics} value={epicNum} onChange={onEpicChange} />
            </label>
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Title</span>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Ticket title"
            className="bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Body</span>
          <textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={12}
            className="bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm font-mono text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8 resize-y"
          />
        </label>
      </div>
    </Modal>
  );
}
