import { MessageSquare } from 'lucide-react';
import { useComments } from '../lib/api';
import { formatTimestamp } from '../lib/time';
import { MarkdownBody } from './MarkdownBody';

type Props = {
  projectName: string;
  ticketNumber: number;
};

export function CommentSection({ projectName, ticketNumber }: Props) {
  const { data: comments, isLoading, error } = useComments(projectName, ticketNumber);

  if (error) {
    return (
      <div className="mb-6 bg-nord-2 border border-nord-11 rounded p-3 text-nord-11 text-sm">
        Failed to load comments: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  if (isLoading && !comments) return null;

  return (
    <div className="mb-6">
      <h2 className="flex items-center gap-1.5 text-xs font-medium text-nord-4 uppercase tracking-wide mb-3">
        <MessageSquare size={13} />
        Comments
      </h2>
      {!comments || comments.length === 0 ? (
        <p className="text-sm text-nord-4">No comments yet.</p>
      ) : (
        <div className="border border-nord-3 rounded">
          {comments.map((c) => (
            <div key={c.n} className="py-3 px-3 border-b border-nord-3 last:border-b-0">
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-sm font-medium text-nord-6">{c.displayName}</span>
                <span className="text-xs text-nord-4">@{c.author}</span>
                <span className="text-xs text-nord-4" title={c.timestamp}>
                  {formatTimestamp(c.timestamp)}
                </span>
              </div>
              <MarkdownBody source={c.body} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
