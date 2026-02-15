"use client";

import { useEffect, useRef } from "react";
import { useGamificationStore } from "@/lib/gamification-store";

/**
 * Invisible component that tracks night visits (after 23h local time)
 * for the "Noctambule" badge. Mounted once in layout.tsx.
 */
export function NightOwlTracker() {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 5) {
      tracked.current = true;
      useGamificationStore.getState().incrementStat("nightVisits");
    }
  }, []);

  return null;
}
