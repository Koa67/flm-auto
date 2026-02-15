const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.fr";

/**
 * WebSite + SearchAction schema for the homepage.
 * Enables Google Sitelinks Search Box.
 */
export function generateWebSiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "FLM AUTO",
    url: BASE,
    description:
      "Encyclopédie automobile française : 32 marques, 4000+ générations, fiches techniques, comparateur, Family Fit",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE}/recherche?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    publisher: {
      "@type": "Organization",
      name: "FLM AUTO",
      url: BASE,
    },
  };
}
