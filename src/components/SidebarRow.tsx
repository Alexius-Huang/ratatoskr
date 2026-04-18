import { Link } from 'react-router-dom';
import { ProjectAvatar } from './ProjectAvatar';
import type { ProjectSummary } from '../../server/types';

interface Props {
  project: ProjectSummary;
  isActive: boolean;
  collapsed: boolean;
}

export function SidebarRow({ project, isActive, collapsed }: Props) {
  const hasWarnings = project.warnings.length > 0;
  const base =
    'flex items-center gap-2 py-2 transition-colors cursor-pointer';
  const activeClass = 'bg-nord-10 text-nord-6 font-medium';
  const inactiveClass = 'text-nord-5 hover:bg-nord-2';

  return (
    <li>
      <Link
        to={`/projects/${encodeURIComponent(project.name)}/tickets`}
        title={collapsed ? project.name : undefined}
        className={`${base} ${isActive ? activeClass : inactiveClass} ${
          collapsed ? 'justify-center px-0' : 'px-3'
        }`}
      >
        <ProjectAvatar
          name={project.name}
          thumbnail={project.config?.thumbnail}
          sizePx={collapsed ? 36 : 28}
        />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-sm">{project.name}</span>
            {hasWarnings && (
              <span
                title={project.warnings.join('; ')}
                className="text-nord-13"
                aria-label="warning"
              >
                ⚠
              </span>
            )}
          </>
        )}
      </Link>
    </li>
  );
}
