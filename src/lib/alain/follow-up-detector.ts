/**
 * Detects if a user message is a follow-up to the previous exchange
 * rather than a new topic. This changes how we route and prompt.
 */

import type { StructuredContext } from "./context-tracker";

export type FollowUpType =
  | "clarification"
  | "refinement"
  | "comparison_add"
  | "deep_dive"
  | "opinion"
  | "negation"
  | "new_topic"
  | "continuation";

export interface FollowUpResult {
  type: FollowUpType;
  resolvedQuery: string;
  needsToolCall: boolean;
  suggestedTool?: string;
}

const BRAND_RE =
  /\b(bmw|mercedes|audi|porsche|volkswagen|vw|peugeot|renault|citro[eë]n|tesla|toyota|honda|ford|fiat|alfa romeo|volvo|mazda|hyundai|kia|nissan|skoda|seat|cupra|opel|mini|jaguar|land rover|lamborghini|ferrari|maserati|bentley|rolls[- ]royce|aston martin|ds|dacia|suzuki|mitsubishi|lexus|infiniti|genesis|subaru|chevrolet)\b/i;

const CLARIFICATION_RE = /^(c'est[- ]à[- ]dire|comment [çc]a|[çc]a veut dire quoi|explique|pr[eé]cise|je comprends pas)/i;
const REFINEMENT_RE = /^(et |mais )(en |avec |sans |la version |le mod[eè]le )/i;
const COMPARISON_ADD_RE = /^(et )(la |le |un |une )?([\w]+)/i;
const DEEP_DIVE_RE = /^(parle[- ]moi|dis[- ]moi|donne[- ]moi|montre)([\s-]*(plus|davantage))?\s*(de |du |de la |des |sur )/i;
const OPINION_RE = /^(t'en penses quoi|ton avis|tu recommandes|tu conseilles|le meilleur|le pire)/i;
const NEGATION_RE = /^(non|pas [çc]a|je voulais dire|je parlais de|en fait)/i;

export function detectFollowUp(
  message: string,
  ctx: StructuredContext
): FollowUpResult {
  const trimmed = message.trim();

  // 1. Clarification: "c'est-à-dire ?", "comment ça ?"
  if (CLARIFICATION_RE.test(trimmed)) {
    return { type: "clarification", resolvedQuery: trimmed, needsToolCall: false };
  }

  // 2. Negation: "non je voulais dire le break"
  if (NEGATION_RE.test(trimmed)) {
    return { type: "negation", resolvedQuery: trimmed, needsToolCall: true, suggestedTool: "search_vehicles" };
  }

  // 3. Refinement with active vehicle: "et en diesel ?"
  if (REFINEMENT_RE.test(trimmed) && ctx.activeVehicle) {
    const suffix = trimmed.replace(REFINEMENT_RE, "").replace(/[?!.,;:]/g, "").trim();
    return {
      type: "refinement",
      resolvedQuery: `${ctx.activeVehicle} ${suffix}`,
      needsToolCall: true,
      suggestedTool: "search_vehicles",
    };
  }

  // 4. Adding to comparison: "et la Mercedes ?" (with active vehicle)
  if (COMPARISON_ADD_RE.test(trimmed) && ctx.activeVehicle) {
    const match = COMPARISON_ADD_RE.exec(trimmed);
    const newVehicle = match?.[3] || trimmed;
    // Only treat as comparison_add if the added word looks like a brand/model
    if (BRAND_RE.test(newVehicle) || newVehicle.length > 2) {
      return {
        type: "comparison_add",
        resolvedQuery: `${ctx.activeVehicle} vs ${newVehicle}`,
        needsToolCall: true,
        suggestedTool: "search_vehicles",
      };
    }
  }

  // 5. Deep dive: "parle-moi plus de sa fiabilité"
  if (DEEP_DIVE_RE.test(trimmed) && ctx.activeVehicle) {
    const topic = trimmed.replace(DEEP_DIVE_RE, "").trim();
    return {
      type: "deep_dive",
      resolvedQuery: `${ctx.activeVehicle} ${topic}`,
      needsToolCall: true,
      suggestedTool: inferToolFromTopic(topic),
    };
  }

  // 6. Opinion: "t'en penses quoi ?"
  if (OPINION_RE.test(trimmed)) {
    return { type: "opinion", resolvedQuery: trimmed, needsToolCall: false };
  }

  // 7. Short implicit follow-up (no brand mentioned, short message, active vehicle exists)
  if (trimmed.length < 30 && !BRAND_RE.test(trimmed) && ctx.activeVehicle) {
    const tool = inferToolFromTopic(trimmed);
    if (tool) {
      return {
        type: "continuation",
        resolvedQuery: `${ctx.activeVehicle} ${trimmed.replace(/[?!.,;:]/g, "").trim()}`,
        needsToolCall: true,
        suggestedTool: tool,
      };
    }
  }

  // 8. New topic (no follow-up pattern detected)
  return { type: "new_topic", resolvedQuery: trimmed, needsToolCall: true };
}

function inferToolFromTopic(topic: string): string | undefined {
  const t = topic.toLowerCase();
  if (/fiab|panne|probl[eè]m/i.test(t)) return "get_reliability";
  if (/coffre|espace|volume/i.test(t)) return "get_cargo_info";
  if (/s[eé]curit[eé]|ncap|crash/i.test(t)) return "search_and_detail";
  if (/famille|isofix|si[eè]ge/i.test(t)) return "check_family_fit";
  if (/prix|co[uû]t|tco|budget/i.test(t)) return "calculate_tco";
  if (/rappel|recall/i.test(t)) return "get_recalls";
  return undefined;
}
