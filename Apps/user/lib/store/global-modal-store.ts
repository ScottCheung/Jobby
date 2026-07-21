import { create } from 'zustand';
import type { ReactNode } from 'react';

type GlobalModalConfig = {
  content: ReactNode;
  className?: string;
  layoutId?: string;
  onClose?: () => void;
};

type GlobalModalStore = {
  config: GlobalModalConfig | null;
  actions: {
    openModal: (config: GlobalModalConfig) => void;
    closeModal: () => void;
  };
};

export const useGlobalModalStore = create<GlobalModalStore>()((set) => ({
  config: null,
  actions: {
    openModal: (config) => set({ config }),
    closeModal: () => set({ config: null }),
  },
}));
