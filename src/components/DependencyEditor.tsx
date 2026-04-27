import { useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { useTickets } from '../lib/api';
import { Badge } from './shadcn/badge';
import { Button } from './ui/Button';

type Props = {
  projectName: string;
  currentDisplayId?: string;
  blockedBy: string[];
  blocks: string[];
  onBlockedByChange: (next: string[]) => void;
  onBlocksChange: (next: string[]) => void;
};

type Relationship = 'blocked_by' | 'blocks';

export function DependencyEditor({
  projectName,
  currentDisplayId,
  blockedBy,
  blocks,
  onBlockedByChange,
  onBlocksChange,
}: Props) {
  const [relationship, setRelationship] = useState<Relationship>('blocked_by');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const { data: tickets } = useTickets(projectName);

  const excluded = new Set(
    [currentDisplayId, ...blockedBy, ...blocks].filter(Boolean) as string[],
  );

  const filtered = (tickets ?? []).filter((t) => {
    if (excluded.has(t.displayId)) return false;
    if (t.type === 'Epic') return false;
    if (!query) return true;
    return `${t.displayId} — ${t.title}`.toLowerCase().includes(query.toLowerCase());
  }).slice(0, 25);

  function togglePending(displayId: string) {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(displayId)) {
        next.delete(displayId);
      } else {
        next.add(displayId);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (pending.size === 0) return;
    if (relationship === 'blocked_by') {
      onBlockedByChange([...blockedBy, ...Array.from(pending)]);
    } else {
      onBlocksChange([...blocks, ...Array.from(pending)]);
    }
    setPending(new Set());
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-nord-4 uppercase tracking-wider">
        Dependencies
      </span>

      <div className="flex gap-2 items-start">
        <select
          value={relationship}
          onChange={(e) => setRelationship(e.target.value as Relationship)}
          className="bg-nord-2 border border-nord-3 rounded px-2 py-1.5 text-sm text-nord-6 focus:outline-none focus:border-nord-8 shrink-0"
        >
          <option value="blocked_by">is blocked by</option>
          <option value="blocks">blocks</option>
        </select>

        <div className="relative flex-1">
          <div className="flex items-center bg-nord-2 border border-nord-3 rounded focus-within:border-nord-8 transition-colors">
            <Search className="ml-2 w-3.5 h-3.5 text-nord-4 shrink-0" />
            <input
              type="text"
              placeholder="Search tickets…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={handleKeyDown}
              className="bg-transparent pl-1.5 pr-2 py-1.5 text-sm text-nord-6 placeholder-nord-4 focus:outline-none flex-1 min-w-0"
            />
          </div>

          {open && (
            <ul
              role="listbox"
              className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-nord-1 border border-nord-3 rounded shadow-lg"
              onMouseDown={(e) => e.preventDefault()}
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-nord-4 select-none">
                  {query ? 'No matching tickets' : 'No available tickets'}
                </li>
              ) : (
                filtered.map((t) => {
                  const selected = pending.has(t.displayId);
                  return (
                    <li
                      key={t.displayId}
                      role="option"
                      aria-selected={selected}
                      onClick={() => togglePending(t.displayId)}
                      className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer ${
                        selected ? 'bg-nord-3' : 'hover:bg-nord-2'
                      }`}
                    >
                      <span className="w-4 shrink-0">
                        {selected && <Check size={13} className="text-nord-8" />}
                      </span>
                      <span className="font-mono text-nord-9 shrink-0">{t.displayId}</span>
                      <span className="text-nord-6 truncate">{t.title}</span>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>

        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={pending.size === 0}
        >
          Confirm
        </Button>
      </div>

      {(blockedBy.length > 0 || blocks.length > 0) && (
        <div className="flex flex-col gap-1.5">
          {blockedBy.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-nord-4 shrink-0">Blocked by</span>
              {blockedBy.map((id) => (
                <Badge
                  key={id}
                  variant="secondary"
                  className="rounded font-mono pr-1 gap-1"
                >
                  {id}
                  <button
                    type="button"
                    aria-label={`Remove ${id} from blocked by`}
                    onClick={() => onBlockedByChange(blockedBy.filter((x) => x !== id))}
                    className="inline-flex items-center hover:opacity-70"
                  >
                    <X size={11} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          {blocks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-nord-4 shrink-0">Blocks</span>
              {blocks.map((id) => (
                <Badge
                  key={id}
                  variant="secondary"
                  className="rounded font-mono pr-1 gap-1"
                >
                  {id}
                  <button
                    type="button"
                    aria-label={`Remove ${id} from blocks`}
                    onClick={() => onBlocksChange(blocks.filter((x) => x !== id))}
                    className="inline-flex items-center hover:opacity-70"
                  >
                    <X size={11} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
