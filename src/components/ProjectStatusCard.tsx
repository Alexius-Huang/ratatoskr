import { Link } from 'react-router-dom';
import { Bug } from 'lucide-react';
import type { ProjectSummary } from '../../server/types';
import { useArchive, useTickets } from '../lib/api';
import { computeProjectStats } from '../lib/projectStats';
import { ProjectAvatar } from './ProjectAvatar';

interface Props { project: ProjectSummary }

export function ProjectStatusCard({ project }: Props) {
  const { data: tickets, isLoading: ticketsLoading } = useTickets(project.name);
  const { data: archived, isLoading: archiveLoading } = useArchive(project.name);
  const isLoading = ticketsLoading || archiveLoading;
  const stats = computeProjectStats([...(tickets ?? []), ...(archived ?? [])]);
  const denom = stats.total || 1;
  const donePct = (stats.done / denom) * 100;
  const inProgressPct = (stats.inProgress / denom) * 100;
  const todoPct = (stats.todo / denom) * 100;

  return (
    <Link
      to={`/projects/${encodeURIComponent(project.name)}`}
      className="block bg-nord-1 border border-nord-3 rounded p-4 hover:bg-nord-2 transition-colors"
    >
      <div className="flex items-center gap-3">
        <ProjectAvatar name={project.name} thumbnail={project.config?.thumbnail} sizePx={32} />
        <span className="flex-1 truncate text-base font-medium text-nord-6">{project.name}</span>
        <span className="text-sm text-nord-4 whitespace-nowrap">
          {stats.total} tickets
          {stats.openBugs > 0 && (
            <>
              <span className="mx-2">·</span>
              <span className="inline-flex items-center gap-1 text-nord-11" aria-label={`${stats.openBugs} open bugs`}>
                <Bug size={14} aria-hidden="true" />
                {stats.openBugs}
              </span>
            </>
          )}
        </span>
      </div>

      <div
        className="mt-3 h-2 bg-nord-3 rounded overflow-hidden flex"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={stats.total}
        aria-valuenow={stats.done}
      >
        {donePct > 0 && <div style={{ width: `${donePct}%` }} className="bg-nord-14" />}
        {inProgressPct > 0 && <div style={{ width: `${inProgressPct}%` }} className="bg-nord-13" />}
        {todoPct > 0 && <div style={{ width: `${todoPct}%` }} className="bg-nord-3" />}
      </div>

      <p className="mt-2 text-xs text-nord-4">
        {isLoading ? 'Loading…' : `${stats.done} done · ${stats.inProgress} in progress · ${stats.todo} todo`}
      </p>
    </Link>
  );
}
