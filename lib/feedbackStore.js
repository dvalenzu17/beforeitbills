import { create } from 'zustand';

export const useFeedbackStore = create((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
