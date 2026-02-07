"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "flm-favorites";

const listeners = new Set<() => void>();

function getSnapshot(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getServerSnapshot(): string[] {
  return [];
}

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let cachedSnapshot: string[] = [];
let cachedRaw = "";

function getStableSnapshot(): string[] {
  const raw = typeof window !== "undefined"
    ? localStorage.getItem(STORAGE_KEY) || ""
    : "";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSnapshot = raw ? JSON.parse(raw) : [];
    } catch {
      cachedSnapshot = [];
    }
  }
  return cachedSnapshot;
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getStableSnapshot, getServerSnapshot);

  const toggle = useCallback((generationId: string) => {
    const current = getSnapshot();
    const next = current.includes(generationId)
      ? current.filter((id) => id !== generationId)
      : [...current, generationId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cachedRaw = "";
    notify();
  }, []);

  const isFavorite = useCallback(
    (generationId: string) => favorites.includes(generationId),
    [favorites]
  );

  return { favorites, toggle, isFavorite };
}
