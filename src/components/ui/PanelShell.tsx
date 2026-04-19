export type HeaderAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
  variant?: 'default' | 'danger';
};

export function PanelShell({
  onClose,
  title,
  actions,
  children,
  variant = 'pane',
}: {
  onClose: () => void;
  title: string;
  actions: HeaderAction[];
  children: React.ReactNode;
  variant?: 'pane' | 'modal';
}) {
  return (
    <div className={`h-full flex flex-col bg-nord-0${variant === 'pane' ? ' border-l border-nord-3' : ''}`}>
      <header className="flex items-center justify-between px-6 py-3 border-b border-nord-3 bg-nord-1 gap-3">
        <span className="font-mono text-sm text-nord-8 shrink-0">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              title={a.tooltip}
              className={`text-xs font-medium border rounded px-2 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                a.variant === 'danger'
                  ? 'text-nord-11 border-nord-11/50 hover:border-nord-11 hover:bg-nord-11/10'
                  : 'text-nord-8 hover:text-nord-6 border-nord-3 hover:border-nord-8'
              }`}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="text-nord-4 hover:text-nord-6 text-lg leading-none px-2"
            aria-label="Close detail panel"
          >
            ×
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
    </div>
  );
}
