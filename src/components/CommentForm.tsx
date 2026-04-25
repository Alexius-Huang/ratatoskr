import { useState } from 'react';
import { useAppConfig } from '../lib/api';
import { useCreateComment } from '../lib/ticketMutations';

type Props = {
  projectName: string;
  ticketNumber: number;
};

export function CommentForm({ projectName, ticketNumber }: Props) {
  const { data: config } = useAppConfig();
  const user = config?.user ?? null;
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateComment(projectName, ticketNumber);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    if (error) setError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && value.trim().length > 0 && !mutation.isPending) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue('');
    setError(null);
    mutation.mutate(
      {
        body: trimmed,
        ...(user ? { author: { username: user.username, display_name: user.display_name } } : {}),
      },
      {
        onError: (err) => {
          setValue(trimmed);
          setError(err instanceof Error ? err.message : String(err));
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs text-nord-4">
        <span className="text-nord-4/60">Commenting as</span>
        {user ? (
          <span className="font-medium text-nord-6">{user.display_name}</span>
        ) : (
          <span className="text-nord-11">no user configured — set one in Settings</span>
        )}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Write a comment…"
        disabled={!user}
        className="w-full bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8 resize-none [field-sizing:content] min-h-[4.5rem] max-h-48 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {error && <p className="text-xs text-nord-11">{error}</p>}
      <p className="text-xs text-nord-4/40 select-none">
        Press ↵ to post · Shift + ↵ for new line
      </p>
    </div>
  );
}
