import { useProjects } from '../lib/api';
import { ProjectStatusCard } from './ProjectStatusCard';

export function HomePane() {
  const { data: projects, isLoading, error } = useProjects();

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-nord-3 bg-nord-1">
        <h1 className="text-xl font-semibold text-nord-6">Home</h1>
        <p className="text-sm text-nord-4 mt-1">Workspace overview across all projects.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && <p className="text-nord-4">Loading projects…</p>}
        {error && (
          <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
            Failed to load projects: {error instanceof Error ? error.message : String(error)}
          </div>
        )}
        {projects && projects.length === 0 && (
          <p className="text-nord-4">No projects detected.</p>
        )}
        {projects && projects.length > 0 && (
          <ul className="flex flex-col gap-3">
            {projects.map((p) => (
              <li key={p.name}>
                <ProjectStatusCard project={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
