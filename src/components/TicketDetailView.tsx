import { CalendarDays, Clock, GitBranch, GitMerge, GitPullRequest, GitPullRequestClosed, Hand, Map, Sparkles, Zap } from 'lucide-react';
import type { ElementType } from 'react';
import type { TicketDetail } from '../../server/types';
import { EpicTag } from './EpicTag';
import { openExternal } from '../lib/openExternal';
import { formatTimestamp } from '../lib/time';
import { stateColorClass, stateLabel } from '../lib/ticketState';
import { EditTicketModal } from './EditTicketModal';
import { MarkdownBody } from './MarkdownBody';
import { CommentSection } from './CommentSection';
import { resolutionLabel } from '../lib/ticketResolution';

function resolutionIcon(r: string): ElementType {
  switch (r) {
    case 'VIBED':   return Zap;
    case 'PLANNED': return Map;
    default:        return Hand;
  }
}

function resolutionClass(r: string): string {
  switch (r) {
    case 'VIBED':   return 'border-nord-15/40 bg-nord-15/10 text-nord-15';
    case 'PLANNED': return 'border-nord-13/40 bg-nord-13/10 text-nord-13';
    default:        return 'border-nord-3 bg-nord-2 text-nord-4';
  }
}

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
    (data.pullRequests && data.pullRequests.length > 0) ||
    data.isReviewed === true;

  return (
    <>
      <div>
        <div className="sticky top-0 -mt-4 -mx-6 px-6 pt-4 pb-3 bg-nord-0 z-10 border-b border-nord-3">
          <h1 className="text-xl font-semibold text-nord-6 mb-3">{data.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${stateColorClass(data.state)}`}>
              {stateLabel(data.state)}
            </span>
            {epicLabel !== null && data.epic !== undefined && (
              <EpicTag projectName={projectName} epic={data.epic} label={epicLabel} color={data.epicColor} />
            )}
            <span className="text-xs text-nord-4">{data.type}</span>
            {(data.state === 'IN_REVIEW' || data.state === 'DONE') && data.resolution && (() => {
              const Icon = resolutionIcon(data.resolution!);
              return (
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${resolutionClass(data.resolution!)}`}>
                  <Icon size={11} />
                  {resolutionLabel(data.resolution!)}
                </span>
              );
            })()}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-nord-4">
            <span title={data.created} className="flex items-center gap-1">
              <CalendarDays size={16} className="text-nord-9 shrink-0" />
              Created {formatTimestamp(data.created)}
            </span>
            {data.updated !== data.created && (
              <span title={data.updated} className="flex items-center gap-1">
                <Clock size={16} className="text-nord-9 shrink-0" />
                Updated {formatTimestamp(data.updated)}
              </span>
            )}
          </div>
          {hasGitContext && (
          <div className="flex flex-wrap gap-2 mt-3">
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
            {data.isReviewed && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border border-nord-15/40 bg-nord-15/10 text-nord-15 font-medium">
                <Sparkles size={12} />
                AI Reviewed
              </div>
            )}
          </div>
          )}
        </div>
        <div className="pt-4">
        {data.state === 'WONT_DO' && (
          <div className="mb-4 p-3 rounded border border-nord-11/40 bg-nord-11/10 text-sm">
            <div className="text-nord-11 font-medium mb-1">Won't do</div>
            <div className="text-nord-4 whitespace-pre-wrap">{data.wontDoReason ?? 'No reason provided.'}</div>
          </div>
        )}
        <MarkdownBody source={data.body} />
        <CommentSection projectName={projectName} ticketNumber={data.number} />
        {archiveError && (
          <div className="mt-4 bg-nord-2 border border-nord-11 rounded p-3 text-nord-11 text-sm">
            Archive failed: {archiveError.message}
          </div>
        )}
        </div>
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
