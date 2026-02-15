const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.fr";

/**
 * Helper for generating canonical URL metadata.
 * Use in generateMetadata to ensure all pages have canonical URLs.
 */
export function canonical(path: string): { alternates: { canonical: string } } {
  return { alternates: { canonical: `${BASE}${path}` } };
}
