import { useNavigate } from 'react-router-dom';
import { defaultEpicColor, tagStyle } from '../lib/epicColor';
import { cn } from '../lib/utils';
import { Badge } from './shadcn/badge';

type Props = {
  projectName: string;
  epic: number;
  label: string;
  color?: string | null;
  className?: string;
};

export function EpicTag({ projectName, epic, label, color, className }: Props) {
  const navigate = useNavigate();
  const { style } = tagStyle(color ?? defaultEpicColor(epic));

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(`/projects/${encodeURIComponent(projectName)}/epics?inspect=${epic}`);
  }

  return (
    <Badge
      asChild
      variant="secondary"
      className={cn('cursor-pointer hover:brightness-110 rounded', className)}
    >
      <button type="button" style={style} onClick={handleClick} title={label}>
        {label}
      </button>
    </Badge>
  );
}
