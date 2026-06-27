/** @format */

'use client';

import { create } from 'zustand';

type ToastStore = {
  message: string;
  setMessage: (message: string) => void;
  clearMessage: () => void;
};

export const useToastStore = create<ToastStore>()((set) => ({
  message: '',
  setMessage: (message) => set({ message }),
  clearMessage: () => set({ message: '' }),
}));
