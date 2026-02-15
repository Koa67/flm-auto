/**
 * Gamification store — Zustand + localStorage ("flm-gamification").
 * Tracks user stats, awards 31 badges with rarity tiers,
 * and manages XP/levels across 4 categories.
 *
 * Persistence key: "flm-gamification"
 * Unique sets key: "flm-gamification-sets"
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Rarity system
// ---------------------------------------------------------------------------

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_CONFIG: Record<BadgeRarity, { label: string; color: string; xp: number }> = {
  common:    { label: "Commun",    color: "#9ca3af", xp: 10  },
  rare:      { label: "Rare",      color: "#3b82f6", xp: 25  },
  epic:      { label: "\u00c9pique",     color: "#a855f7", xp: 50  },
  legendary: { label: "L\u00e9gendaire", color: "#f59e0b", xp: 100 },
};

// ---------------------------------------------------------------------------
// Level system — XP thresholds
// ---------------------------------------------------------------------------

export const LEVELS = [
  { level: 1,  title: "D\u00e9butant",    xpRequired: 0 },
  { level: 2,  title: "Curieux",      xpRequired: 30 },
  { level: 3,  title: "Passionn\u00e9",   xpRequired: 80 },
  { level: 4,  title: "Connaisseur",  xpRequired: 150 },
  { level: 5,  title: "Expert",       xpRequired: 250 },
  { level: 6,  title: "Ma\u00eetre",      xpRequired: 400 },
  { level: 7,  title: "L\u00e9gende",     xpRequired: 600 },
] as const;

export function getLevelForXP(xp: number): (typeof LEVELS)[number] {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getXPProgress(xp: number): { current: number; next: number; pct: number } {
  const level = getLevelForXP(xp);
  const idx = LEVELS.findIndex((l) => l.level === level.level);
  const nextLevel = LEVELS[idx + 1];
  if (!nextLevel) return { current: xp, next: xp, pct: 100 };
  const base = level.xpRequired;
  const range = nextLevel.xpRequired - base;
  const progress = xp - base;
  return { current: progress, next: range, pct: Math.round((progress / range) * 100) };
}

// ---------------------------------------------------------------------------
// Badge definitions
// ---------------------------------------------------------------------------

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  category: "exploration" | "comparison" | "expert" | "social";
  rarity: BadgeRarity;
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
  | "nightVisits"
  | "profileCompleted";

export const BADGES: BadgeDef[] = [
  // ── Exploration ──────────────────────────────────────────────
  { id: "first-look",      name: "Premier regard",   description: "Consulter une fiche v\u00e9hicule",           icon: "\ud83d\udc40", category: "exploration", rarity: "common",    threshold: 1,   statKey: "vehiclesViewed" },
  { id: "collector",       name: "Collectionneur",   description: "Consulter 10 fiches v\u00e9hicules",          icon: "\ud83c\udfc6", category: "exploration", rarity: "rare",      threshold: 10,  statKey: "vehiclesViewed" },
  { id: "encyclopedist",   name: "Encyclop\u00e9diste",   description: "Consulter 50 fiches v\u00e9hicules",          icon: "\ud83d\udcda", category: "exploration", rarity: "epic",      threshold: 50,  statKey: "vehiclesViewed" },
  { id: "car-guru",        name: "Gourou Auto",      description: "Consulter 100 fiches v\u00e9hicules",         icon: "\ud83e\uddd8", category: "exploration", rarity: "legendary", threshold: 100, statKey: "vehiclesViewed" },
  { id: "brand-explorer",  name: "Globe-trotter",    description: "Explorer 5 marques diff\u00e9rentes",          icon: "\ud83c\udf0d", category: "exploration", rarity: "rare",      threshold: 5,   statKey: "brandsViewed" },
  { id: "brand-master",    name: "Ma\u00eetre des marques", description: "Explorer 15 marques diff\u00e9rentes",     icon: "\ud83c\udf1f", category: "exploration", rarity: "epic",      threshold: 15,  statKey: "brandsViewed" },
  { id: "photo-hunter",    name: "Photographe",      description: "Consulter 5 galeries photos",            icon: "\ud83d\udcf8", category: "exploration", rarity: "common",    threshold: 5,   statKey: "photosViewed" },
  { id: "cinephile",       name: "Cin\u00e9phile",        description: "Regarder 3 pages vid\u00e9os",                icon: "\ud83c\udfac", category: "exploration", rarity: "common",    threshold: 3,   statKey: "videosWatched" },
  { id: "night-owl",       name: "Noctambule",       description: "Naviguer sur le site apr\u00e8s 23h",         icon: "\ud83c\udf19", category: "exploration", rarity: "rare",      threshold: 1,   statKey: "nightVisits" },
  { id: "search-pro",      name: "D\u00e9tective",        description: "Effectuer 10 recherches",                icon: "\ud83d\udd0e", category: "exploration", rarity: "common",    threshold: 10,  statKey: "searchesPerformed" },

  // ── Comparison ───────────────────────────────────────────────
  { id: "first-duel",      name: "Premier duel",     description: "Effectuer une comparaison",              icon: "\u2694\ufe0f", category: "comparison", rarity: "common",    threshold: 1,   statKey: "comparisons" },
  { id: "matchmaker",      name: "Arbitre",          description: "Effectuer 5 comparaisons",               icon: "\ud83e\udd4a", category: "comparison", rarity: "rare",      threshold: 5,   statKey: "comparisons" },
  { id: "duel-master",     name: "Ma\u00eetre du duel",   description: "Effectuer 15 comparaisons",              icon: "\u2696\ufe0f", category: "comparison", rarity: "epic",      threshold: 15,  statKey: "comparisons" },

  // ── Expert ───────────────────────────────────────────────────
  { id: "safety-first",    name: "Safety first",     description: "Consulter 3 fiches s\u00e9curit\u00e9",            icon: "\ud83d\udee1\ufe0f", category: "expert", rarity: "common",    threshold: 3,   statKey: "safetychecked" },
  { id: "mechanic",        name: "M\u00e9cano",           description: "Consulter 3 fiches fiabilit\u00e9",           icon: "\ud83d\udd27", category: "expert", rarity: "common",    threshold: 3,   statKey: "fiabiliteViewed" },
  { id: "accountant",      name: "Comptable",        description: "Calculer 3 TCO",                         icon: "\ud83e\uddee", category: "expert", rarity: "rare",      threshold: 3,   statKey: "tcoCalculated" },
  { id: "tetris-master",   name: "Ma\u00eetre Tetris",    description: "Tester le simulateur coffre 3 fois",      icon: "\ud83d\udce6", category: "expert", rarity: "rare",      threshold: 3,   statKey: "coffreChecked" },
  { id: "dimension-freak", name: "M\u00e8tre-ruban",      description: "Consulter 3 fiches dimensions",           icon: "\ud83d\udcd0", category: "expert", rarity: "common",    threshold: 3,   statKey: "dimensionsViewed" },
  { id: "lens-master",     name: "Optique",          description: "Utiliser les vues profil 5 fois",        icon: "\ud83d\udd0d", category: "expert", rarity: "rare",      threshold: 5,   statKey: "lensesUsed" },
  { id: "speed-demon",     name: "Speed Demon",      description: "Consulter 5 fiches alternatives",        icon: "\u26a1", category: "expert", rarity: "common",    threshold: 5,   statKey: "alternativesViewed" },
  { id: "polymath",        name: "Polymathe",        description: "Consulter s\u00e9curit\u00e9 + fiabilit\u00e9 + TCO + dimensions", icon: "\ud83c\udf93", category: "expert", rarity: "epic", threshold: 3, statKey: "safetychecked" },

  // ── Social / ALAIN ───────────────────────────────────────────
  { id: "first-chat",      name: "Bavard",           description: "Poser une question \u00e0 ALAIN",               icon: "\ud83d\udcac", category: "social", rarity: "common",    threshold: 1,   statKey: "alainQuestions" },
  { id: "alain-fan",       name: "Fan d'ALAIN",      description: "Poser 10 questions \u00e0 ALAIN",              icon: "\ud83e\udd16", category: "social", rarity: "rare",      threshold: 10,  statKey: "alainQuestions" },
  { id: "alain-devotee",   name: "Disciple d'ALAIN", description: "Poser 25 questions \u00e0 ALAIN",              icon: "\ud83e\udde0", category: "social", rarity: "epic",      threshold: 25,  statKey: "alainQuestions" },
  { id: "perfectionist",   name: "Perfectionniste",  description: "Ajouter 5 favoris",                     icon: "\u2764\ufe0f", category: "social", rarity: "common",    threshold: 5,   statKey: "favoritesAdded" },
  { id: "curator",         name: "Conservateur",     description: "Ajouter 15 favoris",                    icon: "\ud83d\uddbc\ufe0f", category: "social", rarity: "rare",      threshold: 15,  statKey: "favoritesAdded" },
  { id: "identified",      name: "Identifi\u00e9",        description: "Compl\u00e9ter son profil utilisateur",       icon: "\ud83c\udfaf", category: "social", rarity: "common",    threshold: 1,   statKey: "profileCompleted" },

  // ── Legendary milestone ──────────────────────────────────────
  { id: "completionist",   name: "Compl\u00e9tiste",      description: "D\u00e9bloquer 25 autres badges",             icon: "\ud83d\udc8e", category: "exploration", rarity: "legendary", threshold: 25,  statKey: "vehiclesViewed" },
];

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

export type Stats = Record<StatKey, number>;

interface GamificationStore {
  stats: Stats;
  xp: number;
  unlockedBadges: string[]; // badge IDs
  badgeUnlockHistory: Record<string, number>; // badge ID → timestamp
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
  nightVisits: 0,
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
      xp: 0,
      unlockedBadges: [],
      badgeUnlockHistory: {},
      lastUnlocked: null,

      dismissToast: () => set({ lastUnlocked: null }),

      incrementStat: (key, amount = 1) => {
        set((state) => {
          const newStats = { ...state.stats, [key]: (state.stats[key] || 0) + amount };
          const result = checkNewBadges(newStats, state.unlockedBadges, state.badgeUnlockHistory);
          return {
            stats: newStats,
            xp: state.xp + result.xpGained,
            unlockedBadges: result.allBadges,
            badgeUnlockHistory: result.history,
            lastUnlocked: result.justUnlocked,
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
          const result = checkNewBadges(newStats, state.unlockedBadges, state.badgeUnlockHistory);
          return {
            stats: newStats,
            xp: state.xp + result.xpGained,
            unlockedBadges: result.allBadges,
            badgeUnlockHistory: result.history,
            lastUnlocked: result.justUnlocked,
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
  currentBadges: string[],
  currentHistory: Record<string, number>
): { allBadges: string[]; justUnlocked: string | null; xpGained: number; history: Record<string, number> } {
  let justUnlocked: string | null = null;
  let xpGained = 0;
  const allBadges = [...currentBadges];
  const history = { ...currentHistory };
  const now = Date.now();

  for (const badge of BADGES) {
    if (allBadges.includes(badge.id)) continue;

    // Special "polymath" check — needs 4 different expert stats >= threshold
    if (badge.id === "polymath") {
      const expertStats: StatKey[] = ["safetychecked", "fiabiliteViewed", "tcoCalculated", "dimensionsViewed"];
      const qualifying = expertStats.filter((k) => (stats[k] || 0) >= badge.threshold).length;
      if (qualifying >= 4) {
        allBadges.push(badge.id);
        history[badge.id] = now;
        xpGained += RARITY_CONFIG[badge.rarity].xp;
        justUnlocked = badge.id;
      }
      continue;
    }

    // Special "completionist" check — needs 25 other badges
    if (badge.id === "completionist") {
      if (allBadges.length >= badge.threshold) {
        allBadges.push(badge.id);
        history[badge.id] = now;
        xpGained += RARITY_CONFIG[badge.rarity].xp;
        justUnlocked = badge.id;
      }
      continue;
    }

    if ((stats[badge.statKey] || 0) >= badge.threshold) {
      allBadges.push(badge.id);
      history[badge.id] = now;
      xpGained += RARITY_CONFIG[badge.rarity].xp;
      justUnlocked = badge.id;
    }
  }

  return { allBadges, justUnlocked, xpGained, history };
}
