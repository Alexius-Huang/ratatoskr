import { useEffect, useState } from 'react';
import { useAppConfig, useUpdateAppConfig } from '../lib/api';
import { GITHUB_TOKEN_SENTINEL, useGithubTokenConfigured, useSaveGithubToken } from '../lib/githubToken';
import { Button } from './ui/Button';
import { Modal } from './Modal';

type Props = {
  onClose: () => void;
};

export function SettingsModal({ onClose }: Props) {
  const { data: config } = useAppConfig();
  const mutation = useUpdateAppConfig();
  const [path, setPath] = useState(config?.workspaceRoot ?? '');
  const isEnvControlled = config?.source === 'env';

  const { data: tokenStatus } = useGithubTokenConfigured();
  const saveToken = useSaveGithubToken();
  const [tokenValue, setTokenValue] = useState('');

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPath(config?.workspaceRoot ?? ''); }, [config?.workspaceRoot]);

  // Pre-fill with sentinel once we know whether a token is configured.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setTokenValue(tokenStatus?.configured ? GITHUB_TOKEN_SENTINEL : '');
  }, [tokenStatus?.configured]);

  const handleSubmit = async () => {
    const trimmed = path.trim();
    if (!trimmed || isEnvControlled) return;
    try {
      await mutation.mutateAsync(trimmed);

      if (tokenValue === GITHUB_TOKEN_SENTINEL) {
        // unchanged — skip
      } else if (tokenValue.trim() === '') {
        await saveToken.mutateAsync(null);
      } else {
        await saveToken.mutateAsync(tokenValue);
      }

      onClose();
    } catch {
      // error shown inline
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      {!isEnvControlled && (
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={mutation.isPending || path.trim().length === 0}
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
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

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">GitHub token</span>
          <input
            type="password"
            value={tokenValue}
            onChange={(e) => setTokenValue(e.target.value)}
            placeholder="ghp_••••••••••••••••••••••••"
            className="bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8"
          />
          <p className="text-xs text-nord-4 mt-1">
            Personal Access Token with <code className="font-mono bg-nord-2 px-1 rounded">repo</code> scope. Leave blank to remove.
          </p>
        </label>

        {(mutation.isError || saveToken.isError) && (
          <div className="bg-nord-2 border border-nord-11 rounded p-3 text-nord-11 text-sm">
            {mutation.isError
              ? (mutation.error instanceof Error ? mutation.error.message : String(mutation.error))
              : (saveToken.error instanceof Error ? saveToken.error.message : String(saveToken.error))}
          </div>
        )}
      </div>
    </Modal>
  );
}
