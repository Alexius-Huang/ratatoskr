import { create } from 'zustand';

export type TabId = 'epics' | 'tickets' | 'board' | 'archive';

type StoreState = {
  selectedProject: string | null;
  activeTab: TabId;
  setSelectedProject: (name: string) => void;
  setActiveTab: (tab: TabId) => void;
};

export const useStore = create<StoreState>((set) => ({
  selectedProject: null,
  activeTab: 'tickets',
  setSelectedProject: (name) =>
    set({ selectedProject: name, activeTab: 'tickets' }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
