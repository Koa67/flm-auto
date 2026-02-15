"use client";

import { useEffect, useRef } from "react";
import { useGamificationStore } from "@/lib/gamification-store";

/**
 * Invisible component that records a daily visit for streak tracking.
 * Mounted once in layout.tsx — calls recordVisit() once per session.
 */
export function StreakTracker() {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    useGamificationStore.getState().recordVisit();
  }, []);

  return null;
}
