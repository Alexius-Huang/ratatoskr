import { useEffect, useState } from 'react';
import { useAppConfig, useUpdateAppConfig } from '../lib/api';
import { Modal } from './Modal';

type Props = {
  onClose: () => void;
};

export function SettingsModal({ onClose }: Props) {
  const { data: config } = useAppConfig();
  const mutation = useUpdateAppConfig();
  const [path, setPath] = useState(config?.workspaceRoot ?? '');
  const isEnvControlled = config?.source === 'env';

  useEffect(() => {
    setPath(config?.workspaceRoot ?? '');
  }, [config?.workspaceRoot]);

  const handleSubmit = async () => {
    const trimmed = path.trim();
    if (!trimmed || isEnvControlled) return;
    try {
      await mutation.mutateAsync(trimmed);
      onClose();
    } catch {
      // error shown inline
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-3 py-1.5 text-sm text-nord-4 hover:text-nord-6 border border-nord-3 rounded transition-colors"
      >
        Cancel
      </button>
      {!isEnvControlled && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mutation.isPending || path.trim().length === 0}
          className="px-3 py-1.5 text-sm font-medium bg-nord-10 text-nord-6 rounded hover:bg-nord-9 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      )}
    </>
  );

  return (
    <Modal open onClose={onClose} title="Settings" footer={footer}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">Workspace path</span>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            disabled={isEnvControlled}
            placeholder="/Users/you/workspace"
            className="bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {isEnvControlled && (
            <p className="text-xs text-nord-4 mt-1">
              Set by <code className="font-mono bg-nord-2 px-1 rounded">RATATOSKR_WORKSPACE_ROOT</code> — env var takes priority over saved config.
            </p>
          )}
        </label>

        {mutation.isError && (
          <div className="bg-nord-2 border border-nord-11 rounded p-3 text-nord-11 text-sm">
            {mutation.error instanceof Error ? mutation.error.message : String(mutation.error)}
          </div>
        )}
      </div>
    </Modal>
  );
}
