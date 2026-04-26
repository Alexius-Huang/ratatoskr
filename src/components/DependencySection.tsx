import { Link, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTickets } from '../lib/api';
import { cn } from '../lib/utils';
import { extractPrefix } from '../lib/ticketId';
import { Badge } from './shadcn/badge';

type Props = {
  projectName: string;
  currentPrefix: string;
  blockedBy: string[];
  blocks: string[];
};

type ChipProps = {
  id: string;
  isSameProject: boolean;
  isDone: boolean;
  isArchived: boolean;
  onClick: (id: string) => void;
};

function DependencyChip({ id, isSameProject, isDone, isArchived, onClick }: ChipProps) {
  const clickable = isSameProject && !isArchived;

  const chip = clickable ? (
    <Badge asChild variant="secondary" className={cn('rounded font-mono', isDone && 'opacity-50')}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(id); }}
        className="cursor-pointer hover:brightness-110"
      >
        {id}
      </button>
    </Badge>
  ) : (
    <Badge
      variant="secondary"
      className={cn('rounded font-mono', isDone ? 'opacity-50' : 'opacity-70')}
      title={isArchived ? 'Archived' : 'Cross-project navigation coming soon'}
    >
      {id}
    </Badge>
  );

  return (
    <div className="relative inline-flex">
      {chip}
      {isDone && (
        <span
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <span className="inline-block rotate-[30deg] bg-nord-14 text-nord-0 text-[8px] font-black tracking-widest px-1.5 py-px rounded-sm opacity-90 shadow-sm">
            DONE
          </span>
        </span>
      )}
    </div>
  );
}

function DependencyRow({
  icon,
  label,
  displayIds,
  stateMap,
  currentPrefix,
  onChipClick,
}: {
  icon: React.ReactNode;
  label: string;
  displayIds: string[];
  stateMap: Map<string, string>;
  currentPrefix: string;
  onChipClick: (id: string) => void;
}) {
  if (displayIds.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-nord-4 shrink-0">{icon}{label}</span>
      {displayIds.map((id) => {
        const isSameProject = extractPrefix(id) === currentPrefix;
        const state = stateMap.get(id);
        const isArchived = isSameProject && !stateMap.has(id);
        const isDone = state === 'DONE' || state === 'WONT_DO' || isArchived;
        return (
          <DependencyChip
            key={id}
            id={id}
            isSameProject={isSameProject}
            isDone={isDone}
            isArchived={isArchived}
            onClick={onChipClick}
          />
        );
      })}
    </div>
  );
}

export function DependencySection({ projectName, currentPrefix, blockedBy, blocks }: Props) {
  const navigate = useNavigate();
  const { data: tickets } = useTickets(projectName);

  const stateMap = new Map<string, string>(
    (tickets ?? []).map((t) => [t.displayId, t.state]),
  );

  if (blockedBy.length === 0 && blocks.length === 0) return null;

  const handleChipClick = (displayId: string) => {
    navigate(`/projects/${encodeURIComponent(projectName)}/tickets?inspect=${displayId}`);
  };

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <DependencyRow
        icon={<Lock size={16} className="text-nord-9 shrink-0" />}
        label="Blocked by"
        displayIds={blockedBy}
        stateMap={stateMap}
        currentPrefix={currentPrefix}
        onChipClick={handleChipClick}
      />
      <DependencyRow
        icon={<Link size={16} className="text-nord-9 shrink-0" />}
        label="Blocks"
        displayIds={blocks}
        stateMap={stateMap}
        currentPrefix={currentPrefix}
        onChipClick={handleChipClick}
      />
    </div>
  );
}
