import { useProjects } from '../lib/api';
import { useStore } from '../store';

export function MainPane() {
  const selectedProject = useStore((s) => s.selectedProject);
  const { data: projects } = useProjects();

  if (!selectedProject) {
    return (
      <main className="flex-1 flex items-center justify-center text-gray-500">
        Select a project
      </main>
    );
  }

  const project = projects?.find((p) => p.name === selectedProject);

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">
        Project: <span className="font-mono">{selectedProject}</span>
      </h1>
      {project ? (
        <div className="space-y-4">
          {project.config ? (
            <div className="bg-white border border-gray-200 rounded p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Config</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-gray-500">Prefix</dt>
                <dd className="font-mono">{project.config.prefix}</dd>
                {project.config.name && (
                  <>
                    <dt className="text-gray-500">Name</dt>
                    <dd>{project.config.name}</dd>
                  </>
                )}
                {project.config.description && (
                  <>
                    <dt className="text-gray-500">Description</dt>
                    <dd>{project.config.description}</dd>
                  </>
                )}
              </dl>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No Ratatoskr config present.</p>
          )}

          {project.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <h3 className="text-sm font-semibold text-yellow-800 mb-2">
                Warnings
              </h3>
              <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                {project.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-red-600">Project not found in list.</p>
      )}
    </main>
  );
}
