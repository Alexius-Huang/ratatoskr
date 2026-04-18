import type { TabId } from '../store';
import { useStore } from '../store';

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'epics', label: 'Epics' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'board', label: 'Board' },
  { id: 'archive', label: 'Archive' },
];

export function TabBar() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);

  return (
    <div className="flex border-b border-nord-3 bg-nord-1">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              isActive
                ? 'text-nord-8 border-nord-8'
                : 'text-nord-4 border-transparent hover:text-nord-6 hover:border-nord-3'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
