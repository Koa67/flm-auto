const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.fr";

interface BreadcrumbSegment {
  name: string;
  url?: string; // omit for the last item (Schema.org convention)
}

/**
 * Generate a BreadcrumbList JSON-LD schema.
 * The last item should NOT have a url (Schema.org convention).
 */
export function generateBreadcrumbSchema(segments: BreadcrumbSegment[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: segments.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      ...(s.url ? { item: s.url.startsWith("http") ? s.url : `${BASE}${s.url}` } : {}),
    })),
  };
}
