import { useNavigate } from 'react-router-dom';
import { extractPrefix } from '../lib/ticketId';
import { Badge } from './shadcn/badge';

type Props = {
  projectName: string;
  currentPrefix: string;
  blockedBy: string[];
  blocks: string[];
};

type RowProps = {
  label: string;
  displayIds: string[];
  projectName: string;
  currentPrefix: string;
  onChipClick: (displayId: string) => void;
};

function DependencyRow({ label, displayIds, projectName: _projectName, currentPrefix, onChipClick }: RowProps) {
  if (displayIds.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-nord-4 shrink-0">{label}</span>
      {displayIds.map((id) => {
        const isSameProject = extractPrefix(id) === currentPrefix;
        if (isSameProject) {
          return (
            <Badge key={id} asChild variant="secondary">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChipClick(id); }}
                className="cursor-pointer hover:brightness-110 rounded font-mono"
              >
                {id}
              </button>
            </Badge>
          );
        }
        return (
          <Badge
            key={id}
            variant="secondary"
            className="rounded font-mono opacity-70"
            title="Cross-project navigation coming soon"
          >
            {id}
          </Badge>
        );
      })}
    </div>
  );
}

export function DependencySection({ projectName, currentPrefix, blockedBy, blocks }: Props) {
  const navigate = useNavigate();

  if (blockedBy.length === 0 && blocks.length === 0) return null;

  const handleChipClick = (displayId: string) => {
    navigate(`/projects/${encodeURIComponent(projectName)}/tickets?inspect=${displayId}`);
  };

  return (
    <div className="mb-4 flex flex-col gap-1.5 text-xs">
      <DependencyRow
        label="Blocked by:"
        displayIds={blockedBy}
        projectName={projectName}
        currentPrefix={currentPrefix}
        onChipClick={handleChipClick}
      />
      <DependencyRow
        label="Blocks:"
        displayIds={blocks}
        projectName={projectName}
        currentPrefix={currentPrefix}
        onChipClick={handleChipClick}
      />
    </div>
  );
}
