import { useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function Modal({ open, onClose, title, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-nord-0/80"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 bg-nord-1 border border-nord-3 rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-nord-6">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-nord-4 hover:text-nord-6 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6">{children}</div>
        {footer && (
          <footer className="px-6 py-4 shrink-0 flex justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
