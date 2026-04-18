import { useProjects } from '../lib/api';
import { useStore } from '../store';

export function Sidebar() {
  const { data: projects, isLoading, error } = useProjects();
  const selectedProject = useStore((s) => s.selectedProject);
  const setSelectedProject = useStore((s) => s.setSelectedProject);

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-gray-50 h-screen overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Projects
        </h2>
      </div>

      {isLoading && (
        <p className="px-4 py-3 text-sm text-gray-500">Loading…</p>
      )}

      {error && (
        <p className="px-4 py-3 text-sm text-red-600">
          Failed to load projects: {String(error)}
        </p>
      )}

      {projects && projects.length === 0 && (
        <p className="px-4 py-3 text-sm text-gray-500">No projects detected.</p>
      )}

      <ul>
        {projects?.map((p) => {
          const isSelected = p.name === selectedProject;
          const hasWarnings = p.warnings.length > 0;
          return (
            <li key={p.name}>
              <button
                type="button"
                onClick={() => setSelectedProject(p.name)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isSelected
                    ? 'bg-blue-100 text-blue-900 font-medium'
                    : 'text-gray-800 hover:bg-gray-100'
                }`}
              >
                <span className="flex-1 truncate">{p.name}</span>
                {hasWarnings && (
                  <span
                    title={p.warnings.join('; ')}
                    className="text-yellow-600"
                    aria-label="warning"
                  >
                    ⚠
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
