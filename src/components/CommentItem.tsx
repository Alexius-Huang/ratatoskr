import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useAppConfig } from '../lib/api';
import { useDeleteComment, useEditComment } from '../lib/ticketMutations';
import { formatTimestamp } from '../lib/time';
import type { Comment } from '../../server/types';
import { MarkdownBody } from './MarkdownBody';
import { Button } from './shadcn/button';
import { Modal } from './Modal';

type Props = {
  projectName: string;
  ticketNumber: number;
  comment: Comment;
};

export function CommentItem({ projectName, ticketNumber, comment }: Props) {
  const { data: config } = useAppConfig();
  const user = config?.user ?? null;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const mutation = useEditComment(projectName, ticketNumber);

  useEffect(() => {
    if (!isEditing) setDraft(comment.body);
  }, [comment.body, isEditing]);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteMutation = useDeleteComment(projectName, ticketNumber);

  const canEdit = user !== null && comment.author === user.username;
  const saveDisabled = draft.trim().length === 0 || draft.trim() === comment.body || mutation.isPending;

  function handleConfirmDelete() {
    deleteMutation.mutate({ n: comment.n });
    setConfirmingDelete(false);
  }

  function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === comment.body) return;
    mutation.mutate(
      { n: comment.n, body: trimmed },
      { onSettled: () => setIsEditing(false) },
    );
  }

  function handleCancel() {
    setIsEditing(false);
    setDraft(comment.body);
  }

  return (
    <div className="py-3 px-3 border-b border-nord-3 last:border-b-0">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-sm font-medium text-nord-6">{comment.displayName}</span>
        <span className="text-xs text-nord-4">@{comment.author}</span>
        <span className="text-xs text-nord-4" title={comment.timestamp}>
          {formatTimestamp(comment.timestamp)}
        </span>
        {comment.updated && (
          <span className="text-xs text-nord-4/60" title={comment.updated}>
            (edited {formatTimestamp(comment.updated)})
          </span>
        )}
        {canEdit && !isEditing && (
          <div className="ml-auto flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-6 px-2 text-xs gap-1 border-nord-3 text-nord-4 hover:text-nord-6 hover:border-nord-4 bg-transparent"
            >
              <Pencil size={11} />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
              className="h-6 px-2 text-xs gap-1 border-nord-3 text-nord-4 hover:text-nord-11 hover:border-nord-11 bg-transparent"
            >
              <Trash2 size={11} />
              Delete
            </Button>
          </div>
        )}
      </div>
      {isEditing ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full bg-nord-2 border border-nord-3 rounded px-3 py-2 text-sm text-nord-6 focus:outline-none focus:border-nord-8 resize-none [field-sizing:content] min-h-[4.5rem] max-h-48"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saveDisabled}
              className="px-3 py-1 text-xs rounded bg-nord-8 text-nord-0 hover:bg-nord-9 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={mutation.isPending}
              className="px-3 py-1 text-xs rounded bg-nord-3 text-nord-6 hover:bg-nord-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <MarkdownBody source={comment.body} />
      )}
      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete comment"
        footer={
          <>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1 text-xs rounded bg-nord-3 text-nord-6 hover:bg-nord-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-3 py-1 text-xs rounded bg-nord-11 text-white hover:opacity-90 transition-opacity"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="py-4 text-sm text-nord-4">This comment will be permanently removed. Are you sure?</p>
      </Modal>
    </div>
  );
}
