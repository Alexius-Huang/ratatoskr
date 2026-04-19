import { ApiError } from '../lib/api';
import { MarkdownBody } from './MarkdownBody';

type Props = {
  path?: string;
  isLoading: boolean;
  error: unknown;
  body: string | undefined;
};

export function TicketPlanView({ path, isLoading, error, body }: Props) {
  if (isLoading) {
    return <div className="text-nord-4">Loading plan…</div>;
  }
  if (error) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    if (isNotFound) {
      return (
        <div className="text-nord-4 italic">
          {error instanceof Error ? error.message : 'Plan not available.'}
        </div>
      );
    }
    return (
      <div className="bg-nord-2 border border-nord-11 rounded p-4 text-nord-11 text-sm">
        Failed to load plan:{' '}
        {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }
  if (!body) return null;
  return (
    <>
      {path && <p className="font-mono text-xs text-nord-4 mb-4">{path}</p>}
      <MarkdownBody source={body} />
    </>
  );
}
