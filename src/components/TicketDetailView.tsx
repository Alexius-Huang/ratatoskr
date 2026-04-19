import type { TicketDetail } from '../../server/types';
import { defaultEpicColor, tagStyle } from '../lib/epicColor';
import { openExternal } from '../lib/openExternal';
import { stateColorClass, stateLabel } from '../lib/ticketState';
import { EditTicketModal } from './EditTicketModal';
import { MarkdownBody } from './MarkdownBody';

function prStateColorClass(state: string): string {
  switch (state) {
    case 'OPEN':   return 'bg-nord-14 text-nord-0';
    case 'MERGED': return 'bg-nord-15 text-nord-0';
    case 'CLOSED': return 'bg-nord-11 text-nord-0';
    default:       return 'bg-nord-2 text-nord-4';
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
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold text-nord-6 mb-3">{data.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mb-6">
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
        <MarkdownBody source={data.body} />
        {data.branch && (
          <div className="mt-6 flex items-center gap-2">
            <span className="text-xs text-nord-4">Branch</span>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-nord-2 text-nord-4">
              {data.branch}
            </span>
          </div>
        )}
        {((data.pullRequests && data.pullRequests.length > 0) || (data.prs && data.prs.length > 0)) && (
          <div className="mt-6">
            <h2 className="text-xs text-nord-4 mb-2">Pull Requests</h2>
            <ul className="flex flex-col gap-1">
              {data.pullRequests && data.pullRequests.length > 0
                ? data.pullRequests.map((pr) => (
                    <li key={pr.url}>
                      <button
                        type="button"
                        onClick={() => openExternal(pr.url)}
                        aria-label={`Open PR #${pr.number}: ${pr.title}`}
                        className="flex items-center gap-2 text-left text-sm text-nord-8 hover:text-nord-7 hover:underline"
                      >
                        <span className="font-mono">#{pr.number}</span>
                        <span className="truncate">— {pr.title}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${prStateColorClass(pr.state)}`}>
                          {pr.state}
                        </span>
                      </button>
                    </li>
                  ))
                : data.prs!.map((prPath) => (
                    <li key={prPath}>
                      <button
                        type="button"
                        onClick={() => openExternal(`https://github.com/${prPath}`)}
                        aria-label={`Open PR ${prPath}`}
                        className="flex items-center gap-2 text-left text-sm text-nord-4 hover:text-nord-6 hover:underline"
                      >
                        <span className="font-mono text-xs">{prPath}</span>
                      </button>
                    </li>
                  ))
              }
            </ul>
          </div>
        )}
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
