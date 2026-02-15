import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentItem {
  id: string;
  brand: string;
  model: string;
  gen: string;
  slug: string;
  thumbnail: string | null;
  viewedAt: number;
}

interface RecentlyViewedState {
  items: RecentItem[];
  addItem: (item: Omit<RecentItem, "viewedAt">) => void;
  clearAll: () => void;
}

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const filtered = state.items.filter((i) => i.id !== item.id);
          return {
            items: [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, 20),
          };
        }),
      clearAll: () => set({ items: [] }),
    }),
    { name: "flm:recently-viewed" }
  )
);
