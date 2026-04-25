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
    <div className="flex flex-col gap-1.5">
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Write a comment…"
        className="w-full bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 placeholder-nord-4 focus:outline-none focus:border-nord-8 resize-none [field-sizing:content] min-h-[4.5rem] max-h-48"
      />
      {error && <p className="text-xs text-nord-11">{error}</p>}
      <p className="text-xs text-nord-4/40 select-none">
        Press ↵ to post · Shift + ↵ for new line
      </p>
    </div>
  );
}
