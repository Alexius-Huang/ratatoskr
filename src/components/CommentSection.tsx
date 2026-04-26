import { MessageSquare } from 'lucide-react';
import { useComments } from '../lib/api';
import { CommentItem } from './CommentItem';

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
        <MessageSquare size={13} className="text-nord-9" />
        Comments
      </h2>
      {!comments || comments.length === 0 ? (
        <p className="text-sm text-nord-4">No comments yet.</p>
      ) : (
        <div className="border border-nord-3 rounded">
          {comments.map((c) => (
            <CommentItem
              key={c.n}
              projectName={projectName}
              ticketNumber={ticketNumber}
              comment={c}
            />
          ))}
        </div>
      )}
    </div>
  );
}
