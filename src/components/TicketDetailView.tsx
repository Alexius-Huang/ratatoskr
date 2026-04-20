import { CalendarDays, Clock, GitBranch, GitMerge, GitPullRequest, GitPullRequestClosed } from 'lucide-react';
import type { ElementType } from 'react';
import type { TicketDetail } from '../../server/types';
import { defaultEpicColor, tagStyle } from '../lib/epicColor';
import { openExternal } from '../lib/openExternal';
import { formatTimestamp } from '../lib/time';
import { stateColorClass, stateLabel } from '../lib/ticketState';
import { EditTicketModal } from './EditTicketModal';
import { MarkdownBody } from './MarkdownBody';

function prStateIcon(state: string): ElementType {
  switch (state) {
    case 'MERGED': return GitMerge;
    case 'CLOSED': return GitPullRequestClosed;
    default:       return GitPullRequest;
  }
}

function prStateButtonClass(state: string): string {
  switch (state) {
    case 'OPEN':   return 'border-nord-14/40 bg-nord-14/10 text-nord-14 hover:bg-nord-14/20';
    case 'MERGED': return 'border-nord-15/40 bg-nord-15/10 text-nord-15 hover:bg-nord-15/20';
    case 'CLOSED': return 'border-nord-11/40 bg-nord-11/10 text-nord-11 hover:bg-nord-11/20';
    default:       return 'border-nord-3 bg-nord-1 text-nord-4 hover:bg-nord-2';
  }
}

type Props = {
  data: TicketDetail;
  archiveError: Error | null;
  showEdit: boolean;
  onCloseEdit: () => void;
  projectName: string;
  epicLabel: string | null;
};

export function TicketDetailView({
  data,
  archiveError,
  showEdit,
  onCloseEdit,
  projectName,
  epicLabel,
}: Props) {
  const hasGitContext =
    !!data.branch ||
    (data.prs && data.prs.length > 0) ||
    (data.pullRequests && data.pullRequests.length > 0);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold text-nord-6 mb-3">{data.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${stateColorClass(data.state)}`}>
            {stateLabel(data.state)}
          </span>
          {epicLabel !== null && data.epic !== undefined
            ? (() => {
                const s = tagStyle(data.epicColor ?? defaultEpicColor(data.epic));
                return (
                  <span className={s.className} style={s.style} title={epicLabel}>
                    {epicLabel}
                  </span>
                );
              })()
            : null}
          <span className="text-xs text-nord-4">{data.type}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-4 text-xs text-nord-4">
          <span title={data.created} className="flex items-center gap-1">
            <CalendarDays size={13} className="text-nord-9 shrink-0" />
            Created {formatTimestamp(data.created)}
          </span>
          {data.updated !== data.created && (
            <span title={data.updated} className="flex items-center gap-1">
              <Clock size={13} className="text-nord-9 shrink-0" />
              Updated {formatTimestamp(data.updated)}
            </span>
          )}
        </div>
        {data.state === 'WONT_DO' && (
          <div className="mb-4 p-3 rounded border border-nord-11/40 bg-nord-11/10 text-sm">
            <div className="text-nord-11 font-medium mb-1">Won't do</div>
            <div className="text-nord-4 whitespace-pre-wrap">{data.wontDoReason ?? 'No reason provided.'}</div>
          </div>
        )}
        {hasGitContext && (
          <div className="flex flex-wrap gap-2 mb-6">
            {data.pullRequests && data.pullRequests.length > 0
              ? data.pullRequests.map((pr) => {
                  const Icon = prStateIcon(pr.state);
                  return (
                    <button
                      key={pr.url}
                      type="button"
                      onClick={() => openExternal(pr.url)}
                      aria-label={`Open PR #${pr.number}: ${pr.title}`}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border font-medium ${prStateButtonClass(pr.state)}`}
                    >
                      <Icon size={12} />
                      <span className="font-mono">#{pr.number}</span>
                      {data.branch && <span className="font-mono opacity-80">{data.branch}</span>}
                    </button>
                  );
                })
              : data.prs && data.prs.length > 0
              ? data.prs.map((prPath) => {
                  const prNum = prPath.match(/\/pull\/(\d+)$/)?.[1];
                  return (
                    <button
                      key={prPath}
                      type="button"
                      onClick={() => openExternal(`https://github.com/${prPath}`)}
                      aria-label={`Open PR ${prPath}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border border-nord-3 bg-nord-1 text-nord-4 hover:bg-nord-2 hover:text-nord-6 font-medium"
                    >
                      <GitPullRequest size={12} className="text-nord-9" />
                      <span className="font-mono">{prNum ? `#${prNum}` : prPath}</span>
                      {data.branch && <span className="font-mono opacity-80">{data.branch}</span>}
                    </button>
                  );
                })
              : data.branch
              ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border border-nord-3 bg-nord-1 text-nord-4">
                    <GitBranch size={12} className="text-nord-9" />
                    <span className="font-mono">{data.branch}</span>
                  </div>
                )
              : null}
          </div>
        )}
        <MarkdownBody source={data.body} />
        {archiveError && (
          <div className="mt-4 bg-nord-2 border border-nord-11 rounded p-3 text-nord-11 text-sm">
            Archive failed: {archiveError.message}
          </div>
        )}
      </div>
      <EditTicketModal
        key={showEdit ? data.updated : 'closed'}
        open={showEdit}
        onClose={onCloseEdit}
        projectName={projectName}
        ticket={data}
      />
    </>
  );
}
