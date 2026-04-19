import { useEffect } from 'react';
import { TicketDetailPanel } from './TicketDetailPanel';

type Props = {
  projectName: string;
  number: number;
  displayId: string;
  onClose: () => void;
};

export function TicketDetailModal({ projectName, number, displayId, onClose }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-nord-0/80"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-3xl mx-4 h-[85vh] bg-nord-1 border border-nord-3 rounded-lg shadow-xl overflow-hidden">
        <TicketDetailPanel
          variant="modal"
          projectName={projectName}
          number={number}
          displayId={displayId}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
