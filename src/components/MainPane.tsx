import { useProjects } from '../lib/api';
import { useStore } from '../store';
import { TabBar } from './TabBar';
import { TicketsTab } from './TicketsTab';
import { EpicsTab } from './EpicsTab';
import { BoardTab } from './BoardTab';
import { ArchiveTab } from './ArchiveTab';

export function MainPane() {
  const selectedProject = useStore((s) => s.selectedProject);
  const activeTab = useStore((s) => s.activeTab);
  const { data: projects } = useProjects();

  if (!selectedProject) {
    return (
      <main className="flex-1 flex items-center justify-center text-nord-4">
        Select a project
      </main>
    );
  }

  const project = projects?.find((p) => p.name === selectedProject);

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-nord-3 bg-nord-1">
        <h1 className="text-xl font-semibold">
          <span className="text-nord-4">Project:</span>{' '}
          <span className="font-mono text-nord-8">{selectedProject}</span>
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
        {activeTab === 'epics' && <EpicsTab />}
        {activeTab === 'tickets' && <TicketsTab />}
        {activeTab === 'board' && <BoardTab />}
        {activeTab === 'archive' && <ArchiveTab />}
      </div>
    </main>
  );
}
