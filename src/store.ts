import { create } from 'zustand';

type StoreState = {
  selectedProject: string | null;
  setSelectedProject: (name: string) => void;
};

export const useStore = create<StoreState>((set) => ({
  selectedProject: null,
  setSelectedProject: (name) => set({ selectedProject: name }),
}));
