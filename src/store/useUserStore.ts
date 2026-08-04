import { create } from 'zustand';

interface UserState {
  isAdmin: boolean;
  setAdmin: (isAdmin: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  isAdmin: false,
  setAdmin: (isAdmin) => set({ isAdmin }),
}));
