import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CompareVehicle {
  id: string;
  name: string;
  image?: string;
}

interface CompareStore {
  vehicles: CompareVehicle[];
  addVehicle: (v: CompareVehicle) => void;
  removeVehicle: (id: string) => void;
  clearAll: () => void;
  isSelected: (id: string) => boolean;
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      vehicles: [],
      addVehicle: (v) =>
        set((state) => {
          if (state.vehicles.length >= 4) return state;
          if (state.vehicles.find((x) => x.id === v.id)) return state;
          return { vehicles: [...state.vehicles, v] };
        }),
      removeVehicle: (id) =>
        set((state) => ({
          vehicles: state.vehicles.filter((v) => v.id !== id),
        })),
      clearAll: () => set({ vehicles: [] }),
      isSelected: (id) => get().vehicles.some((v) => v.id === id),
    }),
    { name: "flm-compare" }
  )
);
