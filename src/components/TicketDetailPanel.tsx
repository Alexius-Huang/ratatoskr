import ReactMarkdown from 'react-markdown';
import { ApiError, useTicketDetail } from '../lib/api';
import { stateColorClass, stateLabel } from '../lib/ticketState';

type Props = {
  projectName: string;
  number: number;
  displayId: string;
  onClose: () => void;
};

export function TicketDetailPanel({
  projectName,
  number,
  displayId,
  onClose,
}: Props) {
  const { data, isLoading, error } = useTicketDetail(projectName, number);

  if (isLoading) {
    return (
      <PanelShell onClose={onClose} title={displayId}>
        <div className="text-nord-4">Loading…</div>
      </PanelShell>
    );
  }

  if (error) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    return (
      <PanelShell onClose={onClose} title={displayId}>
        {isNotFound ? (
          <div className="text-nord-4 italic">
            Ticket {displayId} not found.
          </div>
        ) : (
          <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
            Failed to load ticket:{' '}
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}
      </PanelShell>
    );
  }

  if (!data) return null;

  const epicLabel =
    data.epicTitle ?? (data.epic !== undefined ? `#${data.epic}` : null);

  return (
    <PanelShell onClose={onClose} title={data.displayId}>
      <h1 className="text-xl font-semibold text-nord-6 mb-3">{data.title}</h1>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${stateColorClass(data.state)}`}
        >
          {stateLabel(data.state)}
        </span>
        {epicLabel !== null && (
          <span
            className="inline-block max-w-full truncate px-2 py-0.5 rounded bg-nord-15/20 text-nord-15 text-xs font-medium"
            title={epicLabel}
          >
            {epicLabel}
          </span>
        )}
        <span className="text-xs text-nord-4">{data.type}</span>
      </div>
      <div className="markdown-body text-sm text-nord-5 leading-relaxed">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-lg font-semibold text-nord-6 mt-6 mb-2">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-xs font-semibold text-nord-4 uppercase tracking-wider mt-6 mb-2">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold text-nord-5 mt-4 mb-2">
                {children}
              </h3>
            ),
            p: ({ children }) => <p className="mb-3">{children}</p>,
            ul: ({ children }) => (
              <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
            ),
            code: ({ children }) => (
              <code className="bg-nord-2 px-1 py-0.5 rounded text-nord-13 text-[0.85em] font-mono">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-nord-2 border border-nord-3 rounded p-3 overflow-x-auto text-xs mb-3">
                {children}
              </pre>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-nord-8 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            ),
          }}
        >
          {data.body}
        </ReactMarkdown>
      </div>
    </PanelShell>
  );
}

function PanelShell({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col bg-nord-0 border-l border-nord-3">
      <header className="flex items-center justify-between px-6 py-3 border-b border-nord-3 bg-nord-1">
        <span className="font-mono text-sm text-nord-8">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-nord-4 hover:text-nord-6 text-lg leading-none px-2"
          aria-label="Close detail panel"
        >
          ×
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
    </div>
  );
}
