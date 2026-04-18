import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return createPortal(
    <div className="fixed bottom-6 right-6 bg-nord-2 border border-nord-11 rounded shadow-lg px-4 py-3 text-sm text-nord-6 z-50 max-w-sm">
      {message}
    </div>,
    document.body,
  );
}
