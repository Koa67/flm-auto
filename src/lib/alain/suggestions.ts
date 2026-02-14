import type { ConversationContext, Message } from "./conversation-store";

export interface Suggestion {
  text: string;
  action: string;
  icon: "car" | "compare" | "family" | "ev" | "search" | "trunk" | "star" | "shield" | "calculator";
}

const MAX_SUGGESTIONS = 4;

/**
 * Generate contextual suggestions based on conversation history,
 * user preferences, current page, and last assistant response.
 */
export function generateSuggestions(
  context: ConversationContext,
  currentPage?: string,
  messages?: Message[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // --- Post-response contextual suggestions ---
  const lastAssistant = messages?.filter((m) => m.role === "assistant").slice(-1)[0];
  const lastUser = messages?.filter((m) => m.role === "user").slice(-1)[0];

  if (lastAssistant && messages && messages.length >= 2) {
    const content = lastAssistant.content;
    const mentionsVehicle = /\b(bmw|mercedes|audi|porsche|volkswagen|peugeot|renault|citroen|tesla|toyota|honda|volvo|mazda|hyundai|kia|nissan)\b/i.test(content);
    const mentionsCompare = /compar|vs|versus/i.test(lastUser?.content || "");

    if (mentionsVehicle && !mentionsCompare) {
      if (context.lastVehicles.length >= 1) {
        suggestions.push({
          text: "Comparer avec le dernier vu",
          action: "Compare ce vehicule avec le dernier que j'ai consulte",
          icon: "compare",
        });
      }
      suggestions.push({
        text: "Combien ca coute par mois ?",
        action: "Quel est le cout mensuel reel de ce vehicule (TCO) ?",
        icon: "calculator",
      });
      if (context.preferences.childSeats && context.preferences.childSeats > 0) {
        suggestions.push({
          text: "Compatible sieges enfants ?",
          action: "Ce vehicule est-il compatible avec des sieges enfants a l'arriere ?",
          icon: "family",
        });
      }
    }

    if (mentionsCompare) {
      suggestions.push({
        text: "Lequel est le plus fiable ?",
        action: "Parmi ces vehicules, lequel est le plus fiable ?",
        icon: "shield",
      });
      suggestions.push({
        text: "Lequel coute le moins ?",
        action: "Lequel est le moins cher a l'usage (TCO) ?",
        icon: "calculator",
      });
    }

    if (suggestions.length >= MAX_SUGGESTIONS) {
      return suggestions.slice(0, MAX_SUGGESTIONS);
    }
  }

  // --- Page-specific suggestions ---

  const vehiclePageMatch = currentPage?.match(
    /^\/marques\/([^/]+)\/([^/]+)\/([^/]+)\/?$/
  );
  if (vehiclePageMatch) {
    const [, brand, model] = vehiclePageMatch;
    const displayName = `${decodeURIComponent(brand)} ${decodeURIComponent(model)}`;

    suggestions.push({
      text: `Fiche technique ${displayName}`,
      action: `Donne-moi la fiche technique complete de la ${displayName}`,
      icon: "car",
    });

    suggestions.push({
      text: "Compatibilite sieges enfants",
      action: `Ce vehicule est-il compatible avec 3 sieges enfants a l'arriere ?`,
      icon: "family",
    });

    suggestions.push({
      text: "Problemes moteur connus ?",
      action: `Y a-t-il des problemes de fiabilite connus sur ce vehicule ?`,
      icon: "shield",
    });

    if (context.lastVehicles.length >= 1) {
      const lastViewed = context.lastVehicles[context.lastVehicles.length - 1];
      if (lastViewed !== currentPage) {
        suggestions.push({
          text: "Comparer avec le dernier vu",
          action: `Compare ce vehicule avec le dernier que j'ai consulte`,
          icon: "compare",
        });
      }
    }

    return suggestions.slice(0, MAX_SUGGESTIONS);
  }

  // --- Context-based suggestions ---

  // If 2+ vehicles viewed, suggest comparison
  if (context.lastVehicles.length >= 2) {
    suggestions.push({
      text: "Comparer mes derniers vehicules",
      action: "Compare les deux derniers vehicules que j'ai consultes",
      icon: "compare",
    });
  }

  // If child seats preference is set
  if (context.preferences.childSeats && context.preferences.childSeats > 0) {
    suggestions.push({
      text: "Vehicules compatibles 3-across",
      action:
        "Quels vehicules sont compatibles avec 3 sieges enfants cote a cote a l'arriere ?",
      icon: "family",
    });
  }

  // If electric fuel type preference
  if (
    context.preferences.fuelTypes?.some((f) =>
      ["electrique", "electric", "ev"].includes(f.toLowerCase())
    )
  ) {
    suggestions.push({
      text: "Autonomie reelle des electriques",
      action:
        "Quels vehicules electriques ont la meilleure autonomie reelle ?",
      icon: "ev",
    });
  }

  // If budget is set
  if (context.preferences.budget) {
    const max = context.preferences.budget.max;
    if (max > 0) {
      suggestions.push({
        text: `Meilleur rapport qualite-prix < ${(max / 1000).toFixed(0)}k`,
        action: `Quel est le meilleur vehicule pour un budget de ${max} euros ?`,
        icon: "star",
      });
    }
  }

  // If already have enough, return early
  if (suggestions.length >= MAX_SUGGESTIONS) {
    return suggestions.slice(0, MAX_SUGGESTIONS);
  }

  // --- General fallback suggestions ---
  const fallbacks: Suggestion[] = [
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

  // Add fallbacks that are not already in suggestions (by action text)
  const existingActions = new Set(suggestions.map((s) => s.action));
  for (const fallback of fallbacks) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    if (!existingActions.has(fallback.action)) {
      suggestions.push(fallback);
    }
  }

  return suggestions.slice(0, MAX_SUGGESTIONS);
}
