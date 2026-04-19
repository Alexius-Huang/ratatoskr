import type { TicketDetail } from '../../server/types';
import { defaultEpicColor, tagStyle } from '../lib/epicColor';
import { stateColorClass, stateLabel } from '../lib/ticketState';
import { EditTicketModal } from './EditTicketModal';
import { MarkdownBody } from './MarkdownBody';

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
