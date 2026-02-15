/**
 * User profile store — Zustand + localStorage ("flm-user-profile").
 * Persists onboarding preferences (budget, fuel, usage, child seats)
 * used to seed ALAIN context and personalize recommendations.
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UsageType = "city" | "highway" | "mixed";
export type FuelPreference =
  | "any"
  | "essence"
  | "diesel"
  | "electrique"
  | "hybride";
export type Priority =
  | "economy"
  | "safety"
  | "performance"
  | "space"
  | "reliability"
  | "tech";

export interface UserProfile {
  budget_min: number;
  budget_max: number;
  usage: UsageType;
  km_annual: number;
  family_size: number;
  child_seats_needed: number;
  fuel_preference: FuelPreference;
  priorities: Priority[];
  completed: boolean;
}

interface ProfileStore {
  profile: UserProfile;
  setProfile: (partial: Partial<UserProfile>) => void;
  resetProfile: () => void;
}

const DEFAULT_PROFILE: UserProfile = {
  budget_min: 15000,
  budget_max: 40000,
  usage: "mixed",
  km_annual: 15000,
  family_size: 2,
  child_seats_needed: 0,
  fuel_preference: "any",
  priorities: [],
  completed: false,
};

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profile: { ...DEFAULT_PROFILE },
      setProfile: (partial) =>
        set((state) => ({
          profile: { ...state.profile, ...partial },
        })),
      resetProfile: () => set({ profile: { ...DEFAULT_PROFILE } }),
    }),
    { name: "flm-user-profile" }
  )
);
