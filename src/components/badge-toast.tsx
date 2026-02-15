"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGamificationStore, BADGES, RARITY_CONFIG } from "@/lib/gamification-store";

export function BadgeToast() {
  const lastUnlocked = useGamificationStore((s) => s.lastUnlocked);
  const dismissToast = useGamificationStore((s) => s.dismissToast);

  const badge = lastUnlocked ? BADGES.find((b) => b.id === lastUnlocked) : null;
  const rarity = badge ? RARITY_CONFIG[badge.rarity] : null;

  useEffect(() => {
    if (!lastUnlocked) return;
    const timer = setTimeout(dismissToast, 5000);
    return () => clearTimeout(timer);
  }, [lastUnlocked, dismissToast]);

  return (
    <AnimatePresence>
      {badge && rarity && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2"
        >
          <button
            onClick={dismissToast}
            className="flex items-center gap-3 rounded-full border px-5 py-3 shadow-2xl backdrop-blur-lg"
            style={{
              borderColor: `${rarity.color}50`,
              backgroundColor: `${rarity.color}15`,
              boxShadow: `0 0 30px ${rarity.color}25`,
            }}
          >
            <span className="text-2xl">{badge.icon}</span>
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: rarity.color }}>
                Badge d&eacute;bloqu&eacute; !
              </p>
              <p className="text-sm font-semibold text-white">{badge.name}</p>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ color: rarity.color, backgroundColor: `${rarity.color}20` }}
            >
              +{rarity.xp} XP
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
