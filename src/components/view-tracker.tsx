"use client";

import { useEffect, useRef } from "react";
import { useGamificationStore, type StatKey } from "@/lib/gamification-store";
import { useRecentlyViewed, type RecentItem } from "@/lib/recently-viewed-store";

interface ViewTrackerProps {
  /** The stat key to increment */
  statKey: StatKey;
  /** For unique tracking (e.g. "brands"), provide setKey + value */
  uniqueSetKey?: string;
  uniqueValue?: string;
  /** Recently viewed data — when provided, adds to recently viewed shelf */
  recentlyViewed?: Omit<RecentItem, "viewedAt">;
}

/**
 * Invisible component that tracks a page view for gamification
 * and optionally records it in the recently-viewed store.
 * Uses useRef to prevent double-tracking in React strict mode.
 */
export function ViewTracker({ statKey, uniqueSetKey, uniqueValue, recentlyViewed }: ViewTrackerProps) {
  const tracked = useRef(false);
  const incrementStat = useGamificationStore((s) => s.incrementStat);
  const trackUnique = useGamificationStore((s) => s.trackUnique);
  const addRecentItem = useRecentlyViewed((s) => s.addItem);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    if (uniqueSetKey && uniqueValue) {
      trackUnique(statKey, uniqueSetKey, uniqueValue);
    } else {
      incrementStat(statKey);
    }

    if (recentlyViewed) {
      addRecentItem(recentlyViewed);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
