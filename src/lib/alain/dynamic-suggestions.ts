import type { StructuredContext } from "./context-tracker";

export interface DynamicSuggestion {
  label: string;
  message: string;
}

/**
 * Generate server-side dynamic suggestions based on structured conversation context.
 * These are sent after each ALAIN response to update the client UI.
 */
export function generateDynamicSuggestions(ctx: StructuredContext): DynamicSuggestion[] {
  const suggestions: DynamicSuggestion[] = [];
  const topicTypes = new Set(ctx.topics.map((t) => t.type));

  // If a vehicle is actively being discussed → contextual suggestions
  if (ctx.activeVehicle) {
    const v = ctx.activeVehicle;

    if (!topicTypes.has("reliability")) {
      suggestions.push({
        label: `Fiabilité ${shorten(v)}`,
        message: `Le ${v} est-il fiable ?`,
      });
    }

    if (!topicTypes.has("family")) {
      suggestions.push({
        label: `Famille ${shorten(v)}`,
        message: `Le ${v} est-il adapté à une famille avec 2 enfants ?`,
      });
    }

    if (!topicTypes.has("budget")) {
      suggestions.push({
        label: "Coût mensuel",
        message: `Combien coûte le ${v} par mois tout compris ?`,
      });
    }

    if (!topicTypes.has("comparison")) {
      suggestions.push({
        label: "Comparer",
        message: `Quels sont les concurrents directs du ${v} ?`,
      });
    }
  }

  // If comparison is active → verdict suggestion
  if (ctx.comparisonPair) {
    suggestions.push({
      label: "Verdict final",
      message: "Lequel tu recommandes entre les deux ?",
    });
  }

  // If no context → default suggestions
  if (suggestions.length === 0) {
    return [
      {
        label: "SUV familial",
        message: "Quel est le meilleur SUV familial avec 3 sièges enfants ?",
      },
      {
        label: "Budget 25k€",
        message: "Quelle voiture neuve pour un budget de 25 000€ ?",
      },
      {
        label: "Fiabilité",
        message: "Quelles sont les voitures les plus fiables du marché ?",
      },
    ];
  }

  return suggestions.slice(0, 4);
}

/** Shorten a vehicle name for button labels (max ~15 chars) */
function shorten(name: string): string {
  // "Volkswagen Golf" → "Golf", "BMW Série 3" → "Série 3"
  const parts = name.split(/\s+/);
  if (parts.length <= 1) return name;
  return parts.slice(1).join(" ").slice(0, 15);
}
