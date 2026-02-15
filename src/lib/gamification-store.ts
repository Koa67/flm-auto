/**
 * Gamification store — Zustand + localStorage ("flm-gamification").
 * Tracks user stats (pages viewed, comparisons, ALAIN questions, etc.)
 * and awards 20 badges across 4 categories (exploration, comparison, expert, social).
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Badge definitions
// ---------------------------------------------------------------------------

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  category: "exploration" | "comparison" | "expert" | "social";
  threshold: number;
  statKey: StatKey;
}

export type StatKey =
  | "vehiclesViewed"
  | "brandsViewed"
  | "comparisons"
  | "alainQuestions"
  | "tcoCalculated"
  | "coffreChecked"
  | "photosViewed"
  | "videosWatched"
  | "safetychecked"
  | "fiabiliteViewed"
  | "dimensionsViewed"
  | "alternativesViewed"
  | "lensesUsed"
  | "favoritesAdded"
  | "searchesPerformed"
  | "pagesVisited"
  | "profileCompleted";

export const BADGES: BadgeDef[] = [
  // Exploration
  { id: "first-look", name: "Premier regard", description: "Consulter une fiche véhicule", icon: "👀", category: "exploration", threshold: 1, statKey: "vehiclesViewed" },
  { id: "collector", name: "Collectionneur", description: "Consulter 10 fiches véhicules", icon: "🏆", category: "exploration", threshold: 10, statKey: "vehiclesViewed" },
  { id: "encyclopedist", name: "Encyclopédiste", description: "Consulter 50 fiches véhicules", icon: "📚", category: "exploration", threshold: 50, statKey: "vehiclesViewed" },
  { id: "brand-explorer", name: "Globe-trotter", description: "Explorer 5 marques différentes", icon: "🌍", category: "exploration", threshold: 5, statKey: "brandsViewed" },
  { id: "photo-hunter", name: "Photographe", description: "Consulter 5 galeries photos", icon: "📸", category: "exploration", threshold: 5, statKey: "photosViewed" },
  { id: "cinephile", name: "Cinéphile", description: "Regarder 3 pages vidéos", icon: "🎬", category: "exploration", threshold: 3, statKey: "videosWatched" },

  // Comparison
  { id: "first-duel", name: "Premier duel", description: "Effectuer une comparaison", icon: "⚔️", category: "comparison", threshold: 1, statKey: "comparisons" },
  { id: "matchmaker", name: "Arbitre", description: "Effectuer 5 comparaisons", icon: "🥊", category: "comparison", threshold: 5, statKey: "comparisons" },

  // Expert
  { id: "safety-first", name: "Safety first", description: "Consulter 3 fiches sécurité", icon: "🛡️", category: "expert", threshold: 3, statKey: "safetychecked" },
  { id: "mechanic", name: "Mécano", description: "Consulter 3 fiches fiabilité", icon: "🔧", category: "expert", threshold: 3, statKey: "fiabiliteViewed" },
  { id: "accountant", name: "Comptable", description: "Calculer 3 TCO", icon: "🧮", category: "expert", threshold: 3, statKey: "tcoCalculated" },
  { id: "tetris-master", name: "Maître Tetris", description: "Tester le simulateur coffre 3 fois", icon: "📦", category: "expert", threshold: 3, statKey: "coffreChecked" },
  { id: "dimension-freak", name: "Mètre-ruban", description: "Consulter 3 fiches dimensions", icon: "📐", category: "expert", threshold: 3, statKey: "dimensionsViewed" },
  { id: "lens-master", name: "Optique", description: "Utiliser les vues profil 5 fois", icon: "🔍", category: "expert", threshold: 5, statKey: "lensesUsed" },

  // Social / ALAIN
  { id: "first-chat", name: "Bavard", description: "Poser une question \u00e0 ALAIN", icon: "\ud83d\udcac", category: "social", threshold: 1, statKey: "alainQuestions" },
  { id: "alain-fan", name: "Fan d'ALAIN", description: "Poser 10 questions \u00e0 ALAIN", icon: "\ud83e\udd16", category: "social", threshold: 10, statKey: "alainQuestions" },

  // New Phase 24 badges (17-20)
  { id: "night-owl", name: "Noctambule", description: "Naviguer sur le site apr\u00e8s 23h", icon: "\ud83c\udf19", category: "exploration", threshold: 1, statKey: "pagesVisited" },
  { id: "speed-demon", name: "Speed Demon", description: "Consulter 5 fiches alternatives", icon: "\u26a1", category: "expert", threshold: 5, statKey: "alternativesViewed" },
  { id: "perfectionist", name: "Perfectionniste", description: "Ajouter 5 favoris", icon: "\u2764\ufe0f", category: "social", threshold: 5, statKey: "favoritesAdded" },
  { id: "identified", name: "Identifi\u00e9", description: "Compl\u00e9ter son profil utilisateur", icon: "\ud83c\udfaf", category: "social", threshold: 1, statKey: "profileCompleted" },
];

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

export type Stats = Record<StatKey, number>;

interface GamificationStore {
  stats: Stats;
  unlockedBadges: string[]; // badge IDs
  lastUnlocked: string | null; // for toast
  dismissToast: () => void;
  incrementStat: (key: StatKey, amount?: number) => void;
  /** Track a unique set item (e.g. brand slug) — returns new count */
  trackUnique: (key: StatKey, setKey: string, value: string) => void;
}

const DEFAULT_STATS: Stats = {
  vehiclesViewed: 0,
  brandsViewed: 0,
  comparisons: 0,
  alainQuestions: 0,
  tcoCalculated: 0,
  coffreChecked: 0,
  photosViewed: 0,
  videosWatched: 0,
  safetychecked: 0,
  fiabiliteViewed: 0,
  dimensionsViewed: 0,
  alternativesViewed: 0,
  lensesUsed: 0,
  favoritesAdded: 0,
  searchesPerformed: 0,
  pagesVisited: 0,
  profileCompleted: 0,
};

// ---------------------------------------------------------------------------
// Zustand store — persisted to localStorage
// ---------------------------------------------------------------------------

// Separate unique sets stored alongside (e.g. brands seen)
const UNIQUE_SETS_KEY = "flm-gamification-sets";

function loadUniqueSets(): Record<string, Set<string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(UNIQUE_SETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const result: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[k] = new Set(v);
    }
    return result;
  } catch {
    return {};
  }
}

function saveUniqueSets(sets: Record<string, Set<string>>) {
  if (typeof window === "undefined") return;
  const serializable: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(sets)) {
    serializable[k] = [...v];
  }
  localStorage.setItem(UNIQUE_SETS_KEY, JSON.stringify(serializable));
}

let uniqueSets: Record<string, Set<string>> = {};

export const useGamificationStore = create<GamificationStore>()(
  persist(
    (set, get) => ({
      stats: { ...DEFAULT_STATS },
      unlockedBadges: [],
      lastUnlocked: null,

      dismissToast: () => set({ lastUnlocked: null }),

      incrementStat: (key, amount = 1) => {
        set((state) => {
          const newStats = { ...state.stats, [key]: (state.stats[key] || 0) + amount };
          const newBadges = checkNewBadges(newStats, state.unlockedBadges);
          return {
            stats: newStats,
            unlockedBadges: newBadges.allBadges,
            lastUnlocked: newBadges.justUnlocked,
          };
        });
      },

      trackUnique: (key, setKey, value) => {
        // Lazy init
        if (Object.keys(uniqueSets).length === 0) {
          uniqueSets = loadUniqueSets();
        }
        if (!uniqueSets[setKey]) uniqueSets[setKey] = new Set();
        if (uniqueSets[setKey].has(value)) return; // already tracked

        uniqueSets[setKey].add(value);
        saveUniqueSets(uniqueSets);

        const newCount = uniqueSets[setKey].size;
        set((state) => {
          const newStats = { ...state.stats, [key]: newCount };
          const newBadges = checkNewBadges(newStats, state.unlockedBadges);
          return {
            stats: newStats,
            unlockedBadges: newBadges.allBadges,
            lastUnlocked: newBadges.justUnlocked,
          };
        });
      },
    }),
    { name: "flm-gamification" }
  )
);

// ---------------------------------------------------------------------------
// Badge check logic
// ---------------------------------------------------------------------------

function checkNewBadges(
  stats: Stats,
  currentBadges: string[]
): { allBadges: string[]; justUnlocked: string | null } {
  let justUnlocked: string | null = null;
  const allBadges = [...currentBadges];

  for (const badge of BADGES) {
    if (allBadges.includes(badge.id)) continue;
    if ((stats[badge.statKey] || 0) >= badge.threshold) {
      allBadges.push(badge.id);
      justUnlocked = badge.id; // last one wins for toast
    }
  }

  return { allBadges, justUnlocked };
}
