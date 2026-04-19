import { useState } from 'react';
import { useUpdateAppConfig } from '../lib/api';

export function SetupScreen() {
  const [path, setPath] = useState('');
  const mutation = useUpdateAppConfig();

  const canSubmit = path.trim().length > 0 && !mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = path.trim();
    if (!trimmed) return;
    mutation.mutate(trimmed);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-nord-0">
      <div className="bg-nord-1 border border-nord-3 rounded-lg p-8 w-full max-w-lg shadow-xl">
        <h1 className="text-xl font-semibold text-nord-6 mb-1">Welcome to Ratatoskr</h1>
        <p className="text-sm text-nord-4 mb-6">
          Pick the folder that contains your <code className="font-mono bg-nord-2 px-1 rounded">projects/</code> directory.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Workspace path</span>
            <input
              autoFocus
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/Users/you/workspace"
              className="bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8"
            />
          </label>

          {mutation.isError && (
            <div className="bg-nord-2 border border-nord-11 rounded p-3 text-nord-11 text-sm">
              {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium bg-nord-10 text-nord-6 rounded hover:bg-nord-9 disabled:opacity-50 transition-colors self-end"
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
