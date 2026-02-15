"use client";

import { useState, useEffect } from "react";
import { useGamificationStore, BADGES, type BadgeDef } from "@/lib/gamification-store";
import { motion } from "framer-motion";

const CATEGORY_LABELS: Record<BadgeDef["category"], string> = {
  exploration: "Exploration",
  comparison: "Comparaison",
  expert: "Expert",
  social: "Social",
};

function BadgeCard({ badge, unlocked }: { badge: BadgeDef; unlocked: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex flex-col items-center rounded-xl border p-4 text-center transition ${
        unlocked
          ? "border-primary/30 surface-2"
          : "border-[var(--border-subtle)] surface-3 opacity-40 grayscale"
      }`}
    >
      <span className="text-3xl">{badge.icon}</span>
      <p className="mt-2 text-sm font-semibold text-white">{badge.name}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{badge.description}</p>
      {unlocked && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
          &#10003;
        </span>
      )}
    </motion.div>
  );
}

export function BadgeGrid() {
  const [mounted, setMounted] = useState(false);
  const unlockedBadges = useGamificationStore((s) => s.unlockedBadges);
  const stats = useGamificationStore((s) => s.stats);

  useEffect(() => setMounted(true), []);

  const unlockedCount = unlockedBadges.length;
  const totalCount = BADGES.length;
  const pct = Math.round((unlockedCount / totalCount) * 100);

  const categories = Object.keys(CATEGORY_LABELS) as BadgeDef["category"][];

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
      {/* Progress bar */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-white">
            {unlockedCount}/{totalCount} badges d&eacute;bloqu&eacute;s
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

      {/* Stats summary */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="V&eacute;hicules vus" value={stats.vehiclesViewed} />
        <StatPill label="Marques" value={stats.brandsViewed} />
        <StatPill label="Comparaisons" value={stats.comparisons} />
        <StatPill label="Questions ALAIN" value={stats.alainQuestions} />
      </div>

      {/* Badge grid by category */}
      {categories.map((cat) => {
        const catBadges = BADGES.filter((b) => b.category === cat);
        if (catBadges.length === 0) return null;
        return (
          <section key={cat} className="mb-8">
            <h3 className="mb-3 font-display text-lg font-semibold text-white">
              {CATEGORY_LABELS[cat]}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {catBadges.map((badge) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  unlocked={unlockedBadges.includes(badge.id)}
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
