"use client";

import { useState, useEffect } from "react";
import {
  useGamificationStore,
  BADGES,
  RARITY_CONFIG,
  getLevelForXP,
  getXPProgress,
  type BadgeDef,
  type BadgeRarity,
} from "@/lib/gamification-store";
import { motion } from "framer-motion";
import { Flame, Star, Zap } from "lucide-react";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<BadgeDef["category"], { label: string; icon: string }> = {
  exploration: { label: "Exploration", icon: "\ud83c\udf0d" },
  comparison:  { label: "Comparaison", icon: "\u2694\ufe0f" },
  expert:      { label: "Expert",      icon: "\ud83c\udf93" },
  social:      { label: "Social",      icon: "\ud83d\udcac" },
};

// ---------------------------------------------------------------------------
// Badge card — rarity-aware
// ---------------------------------------------------------------------------

function BadgeCard({
  badge,
  unlocked,
  unlockDate,
}: {
  badge: BadgeDef;
  unlocked: boolean;
  unlockDate?: number;
}) {
  const rarity = RARITY_CONFIG[badge.rarity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex flex-col items-center rounded-xl border p-4 text-center transition ${
        unlocked
          ? "surface-2"
          : "border-[var(--border-subtle)] surface-3 opacity-40 grayscale"
      }`}
      style={unlocked ? { borderColor: `${rarity.color}40` } : undefined}
    >
      {/* Rarity glow for unlocked */}
      {unlocked && (
        <div
          className="absolute inset-0 rounded-xl opacity-10"
          style={{ background: `radial-gradient(ellipse at center, ${rarity.color}, transparent 70%)` }}
        />
      )}

      <span className="relative text-3xl">{badge.icon}</span>
      <p className="relative mt-2 text-sm font-semibold text-white">{badge.name}</p>
      <p className="relative mt-1 text-[11px] text-muted-foreground">{badge.description}</p>

      {/* Rarity pill */}
      <span
        className="relative mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{ color: rarity.color, backgroundColor: `${rarity.color}15` }}
      >
        {rarity.label} &middot; {rarity.xp} XP
      </span>

      {/* Unlock check */}
      {unlocked && (
        <span
          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white"
          style={{ backgroundColor: rarity.color }}
        >
          &#10003;
        </span>
      )}

      {/* Unlock date */}
      {unlocked && unlockDate && (
        <p className="relative mt-1 text-[9px] text-muted-foreground">
          {new Date(unlockDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </p>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main grid
// ---------------------------------------------------------------------------

export function BadgeGrid() {
  const [mounted, setMounted] = useState(false);
  const unlockedBadges = useGamificationStore((s) => s.unlockedBadges);
  const stats = useGamificationStore((s) => s.stats);
  const xp = useGamificationStore((s) => s.xp);
  const currentStreak = useGamificationStore((s) => s.currentStreak);
  const longestStreak = useGamificationStore((s) => s.longestStreak);
  const history = useGamificationStore((s) => s.badgeUnlockHistory);

  useEffect(() => setMounted(true), []);

  const unlockedCount = unlockedBadges.length;
  const totalCount = BADGES.length;
  const pct = Math.round((unlockedCount / totalCount) * 100);
  const level = getLevelForXP(xp);
  const xpProgress = getXPProgress(xp);

  const categories = (Object.keys(CATEGORY_LABELS) as BadgeDef["category"][]);

  if (!mounted) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl surface-3" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* ── Level + XP bar ─────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-[var(--border-subtle)] surface-2 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Niveau {level.level} &mdash; {level.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {xp} XP total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-center">
            <div>
              <div className="flex items-center gap-1 text-orange-400">
                <Flame className="h-4 w-4" />
                <span className="text-mono text-lg font-bold">{currentStreak}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">S\u00e9rie</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-amber-400">
                <Star className="h-4 w-4" />
                <span className="text-mono text-lg font-bold">{longestStreak}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Record</p>
            </div>
          </div>
        </div>
        {/* XP progress bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              Prochain : Nv.{level.level + 1 <= 7 ? level.level + 1 : level.level}
            </span>
            <span className="text-mono text-primary">{xpProgress.pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${xpProgress.pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Overall badge progress ─────────────────────────── */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-white">
            {unlockedCount}/{totalCount} badges d\u00e9bloqu\u00e9s
          </span>
          <span className="text-mono text-sm font-bold text-primary">{pct}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Rarity breakdown ───────────────────────────────── */}
      <div className="mb-6 grid grid-cols-4 gap-2">
        {(["common", "rare", "epic", "legendary"] as BadgeRarity[]).map((r) => {
          const cfg = RARITY_CONFIG[r];
          const total = BADGES.filter((b) => b.rarity === r).length;
          const unlocked = BADGES.filter((b) => b.rarity === r && unlockedBadges.includes(b.id)).length;
          return (
            <div key={r} className="rounded-lg border border-[var(--border-subtle)] surface-3 px-2 py-2 text-center">
              <p className="text-mono text-sm font-bold" style={{ color: cfg.color }}>
                {unlocked}/{total}
              </p>
              <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Stats summary ──────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="V\u00e9hicules vus" value={stats.vehiclesViewed} />
        <StatPill label="Marques" value={stats.brandsViewed} />
        <StatPill label="Comparaisons" value={stats.comparisons} />
        <StatPill label="Questions ALAIN" value={stats.alainQuestions} />
      </div>

      {/* ── Badge grid by category ─────────────────────────── */}
      {categories.map((cat) => {
        const catBadges = BADGES.filter((b) => b.category === cat);
        if (catBadges.length === 0) return null;
        const catUnlocked = catBadges.filter((b) => unlockedBadges.includes(b.id)).length;
        const catPct = Math.round((catUnlocked / catBadges.length) * 100);
        const cfg = CATEGORY_LABELS[cat];

        return (
          <section key={cat} className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                <span>{cfg.icon}</span> {cfg.label}
              </h3>
              <span className="text-xs text-muted-foreground">
                {catUnlocked}/{catBadges.length} &middot; {catPct}%
              </span>
            </div>
            {/* Category progress bar */}
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-500"
                style={{ width: `${catPct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {catBadges.map((badge) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  unlocked={unlockedBadges.includes(badge.id)}
                  unlockDate={history[badge.id]}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] surface-3 px-3 py-2 text-center">
      <div className="text-mono text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
