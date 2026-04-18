export type TabId = 'epics' | 'tickets' | 'board' | 'archive';

export const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'epics', label: 'Epics' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'board', label: 'Board' },
  { id: 'archive', label: 'Archive' },
];

const VALID_TABS = new Set<TabId>(TABS.map((t) => t.id));

export function isValidTab(value: string | undefined): value is TabId {
  return value !== undefined && VALID_TABS.has(value as TabId);
}
