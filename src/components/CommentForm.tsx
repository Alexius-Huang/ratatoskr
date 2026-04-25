import { useState } from 'react';
import { useCreateComment } from '../lib/ticketMutations';

type Props = {
  projectName: string;
  ticketNumber: number;
};

export function CommentForm({ projectName, ticketNumber }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateComment(projectName, ticketNumber);

  const isDisabled = value.trim().length === 0 || mutation.isPending;

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    if (error) setError(null);
  }

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue('');
    setError(null);
    mutation.mutate(
      { body: trimmed },
      {
        onError: (err) => {
          setValue(trimmed);
          setError(err instanceof Error ? err.message : String(err));
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-end">
        <textarea
          value={value}
          onChange={handleChange}
          rows={3}
          placeholder="Write a comment…"
          className="flex-1 bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8 resize-none [field-sizing:content] min-h-[4.5rem] max-h-48"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isDisabled}
          className="shrink-0 text-xs font-medium border rounded px-3 py-1.5 transition-colors text-nord-8 border-nord-3 hover:text-nord-6 hover:border-nord-8 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add Comment
        </button>
      </div>
      {error && (
        <p className="text-xs text-nord-11">{error}</p>
      )}
    </div>
  );
}
