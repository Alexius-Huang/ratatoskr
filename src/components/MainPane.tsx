import { Navigate, useParams } from 'react-router-dom';
import { useProjects } from '../lib/api';
import { isValidTab } from '../lib/tabs';
import { TabBar } from './TabBar';
import { TicketsTab } from './TicketsTab';
import { EpicsTab } from './EpicsTab';
import { BoardTab } from './BoardTab';
import { ArchiveTab } from './ArchiveTab';

export function MainPane() {
  const { name, tab } = useParams<{ name: string; tab: string }>();
  const { data: projects } = useProjects();

  if (!name) {
    return <Navigate to="/" replace />;
  }

  if (!isValidTab(tab)) {
    return <Navigate to={`/projects/${encodeURIComponent(name)}/tickets`} replace />;
  }

  const project = projects?.find((p) => p.name === name);

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-nord-3 bg-nord-1">
        <h1 className="text-xl font-semibold">
          <span className="text-nord-4">Project:</span>{' '}
          <span className="font-mono text-nord-8">{name}</span>
        </h1>
        {project?.config?.description && (
          <p className="text-sm text-nord-4 mt-1">
            {project.config.description}
          </p>
        )}
        {project && project.warnings.length > 0 && (
          <div className="mt-2 text-xs text-nord-13">
            ⚠ {project.warnings.join(' · ')}
          </div>
        )}
      </header>

      <TabBar />

      <div className="flex-1 overflow-y-auto">
        {tab === 'epics' && <EpicsTab />}
        {tab === 'tickets' && <TicketsTab />}
        {tab === 'board' && <BoardTab />}
        {tab === 'archive' && <ArchiveTab />}
      </div>
    </main>
  );
}
