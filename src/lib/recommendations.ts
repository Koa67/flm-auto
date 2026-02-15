import type { UserProfile } from "@/lib/profile-store";

export interface Recommendation {
  label: string;
  href: string;
}

export function getRecommendations(profile: UserProfile): Recommendation[] {
  const recs: Recommendation[] = [];

  recs.push({ label: "Configurateur personnalis\u00e9", href: "/configurateur" });

  if (profile.fuel_preference === "electrique") {
    recs.push({ label: "Meilleures \u00e9lectriques", href: "/meilleur/meilleur-autonomie-electrique" });
  } else if (profile.fuel_preference === "hybride") {
    recs.push({ label: "Meilleures hybrides", href: "/recherche?fuel=hybrid" });
  }

  if (profile.child_seats_needed >= 2) {
    recs.push({ label: "Top Family Fit", href: "/meilleur/meilleur-family-fit" });
  }
  if (profile.family_size >= 5) {
    recs.push({ label: "Meilleurs 7 places", href: "/meilleur/meilleur-7-places" });
  }

  if (profile.priorities.includes("safety")) {
    recs.push({ label: "Top s\u00e9curit\u00e9 5\u2605", href: "/meilleur/meilleur-securite-5-etoiles" });
  }
  if (profile.priorities.includes("space")) {
    recs.push({ label: "Plus grands coffres", href: "/meilleur/plus-grand-coffre" });
  }
  if (profile.priorities.includes("performance")) {
    recs.push({ label: "Les plus rapides", href: "/meilleur/meilleur-0-100" });
  }

  return recs.slice(0, 4);
}
