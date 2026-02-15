export interface Suggestion {
  text: string;
  action: string;
  icon: "car" | "compare" | "family" | "ev" | "search" | "trunk" | "star" | "shield" | "calculator";
}

/**
 * Static welcome-screen suggestions shown when the chat opens with no messages.
 * Contextual follow-up suggestions are handled server-side via dynamic-suggestions.ts (SSE).
 */
export function getDefaultSuggestions(): Suggestion[] {
  return [
    {
      text: "Meilleur SUV familial",
      action: "Quel est le meilleur SUV familial en 2025 ?",
      icon: "car",
    },
    {
      text: "Voiture la plus fiable",
      action: "Quelles sont les voitures les plus fiables du marche ?",
      icon: "shield",
    },
    {
      text: "Plus grand coffre",
      action: "Quel vehicule a le plus grand coffre ?",
      icon: "trunk",
    },
    {
      text: "Meilleur rapport qualite-prix",
      action: "Quel vehicule offre le meilleur rapport qualite-prix ?",
      icon: "star",
    },
  ];
}
