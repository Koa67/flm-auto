export interface EventMap {
  page_view: { path: string };
  vehicle_view: { brand: string; model: string; generation: string };
  compare_start: { count: number };
  compare_export_pdf: { count: number };
  search: { query: string; results: number };
  search_save: { query: string };
  wishlist_add: { generation_id: string; brand: string; model: string };
  wishlist_remove: { generation_id: string };
  affiliation_click: { partner: string; brand: string; model: string };
  alain_chat: { query: string };
  photo_gallery_open: { generation_id: string };
  video_play: { generation_id: string; source: string };
  family_fit_check: { generation_id: string };
  cargo_calculator: { generation_id: string };
  filter_apply: { filter: string; value: string };
  theme_toggle: { theme: string };
  share: { method: string; vehicle: string };
}

export function trackEvent<K extends keyof EventMap>(
  event: K,
  properties: EventMap[K]
): void {
  try {
    if (typeof window === "undefined") return;

    // Dynamic import to avoid bundling issues — Vercel Analytics
    // exposes track() on the va object attached by the <Analytics /> component
    const w = window as unknown as {
      va?: (event: string, props: Record<string, unknown>) => void;
    };
    if (typeof w.va === "function") {
      w.va(event as string, properties as Record<string, unknown>);
    } else if (process.env.NODE_ENV === "development") {
      console.debug("[Analytics]", event, properties);
    }
  } catch {
    // Analytics should never break the app
  }
}

export function trackPageView(path: string): void {
  trackEvent("page_view", { path });
}
