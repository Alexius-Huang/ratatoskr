import { useProjects } from '../lib/api';
import { useStore } from '../store';

export function MainPane() {
  const selectedProject = useStore((s) => s.selectedProject);
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
    <main className="flex-1 overflow-y-auto p-6">
      <h1 className="text-2xl font-semibold mb-4 text-nord-6">
        Project: <span className="font-mono text-nord-8">{selectedProject}</span>
      </h1>
      {project ? (
        <div className="space-y-4">
          {project.config ? (
            <div className="bg-nord-1 border border-nord-3 rounded p-4">
              <h3 className="text-sm font-semibold text-nord-4 mb-2">Config</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-nord-4">Prefix</dt>
                <dd className="font-mono text-nord-8">{project.config.prefix}</dd>
                {project.config.name && (
                  <>
                    <dt className="text-nord-4">Name</dt>
                    <dd className="text-nord-6">{project.config.name}</dd>
                  </>
                )}
                {project.config.description && (
                  <>
                    <dt className="text-nord-4">Description</dt>
                    <dd className="text-nord-6">{project.config.description}</dd>
                  </>
                )}
              </dl>
            </div>
          ) : (
            <p className="text-sm text-nord-4">No Ratatoskr config present.</p>
          )}

          {project.warnings.length > 0 && (
            <div className="bg-nord-2 border border-nord-13 rounded p-4">
              <h3 className="text-sm font-semibold text-nord-13 mb-2">
                Warnings
              </h3>
              <ul className="list-disc list-inside text-sm text-nord-13 space-y-1">
                {project.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-nord-11">Project not found in list.</p>
      )}
    </main>
  );
}
