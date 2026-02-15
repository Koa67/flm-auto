/**
 * Server-side conversation context tracker for ALAIN v5.
 * Extracts structured context from message history to improve
 * pre-routing and system prompt injection.
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationTopic {
  type: "vehicle" | "comparison" | "budget" | "family" | "reliability" | "general";
  entities: string[];
  generationIds: string[];
  lastMentionedIndex: number;
}

export interface StructuredContext {
  topics: ConversationTopic[];
  activeVehicle: string | null;
  activeVehicleId: string | null;
  comparisonPair: [string, string] | null;
  userIntent: "exploring" | "comparing" | "deciding" | "researching";
  turnCount: number;
  hasPreferences: boolean;
}

const BRAND_RE =
  /\b(bmw|mercedes|audi|porsche|volkswagen|vw|peugeot|renault|citro[eë]n|tesla|toyota|honda|ford|fiat|alfa romeo|volvo|mazda|hyundai|kia|nissan|skoda|seat|cupra|opel|mini|jaguar|land rover|lamborghini|ferrari|maserati|bentley|rolls[- ]royce|aston martin|ds|dacia|suzuki|mitsubishi|lexus|infiniti|genesis|subaru|chevrolet)\b/gi;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Match "Brand Model" patterns — e.g. "BMW Série 3", "Peugeot 308", "Tesla Model 3"
const VEHICLE_NAME_RE =
  /\b(bmw|mercedes|audi|porsche|volkswagen|vw|peugeot|renault|citro[eë]n|tesla|toyota|honda|ford|fiat|alfa romeo|volvo|mazda|hyundai|kia|nissan|skoda|seat|cupra|opel|mini|jaguar|land rover|lamborghini|ferrari|maserati|bentley|rolls[- ]royce|aston martin|ds|dacia|suzuki|mitsubishi|lexus|infiniti|genesis|subaru|chevrolet)\s+([A-Za-zÀ-ÿ0-9][\w\s/-]{0,25}?)(?=[.,;:?!\s]|$)/gi;

export function buildStructuredContext(messages: ChatMessage[]): StructuredContext {
  const topics: ConversationTopic[] = [];
  const vehicleNames: string[] = [];
  const vehicleIds: string[] = [];
  let activeVehicle: string | null = null;
  let activeVehicleId: string | null = null;
  let comparisonPair: [string, string] | null = null;
  let hasComparePattern = false;
  let hasBudgetPattern = false;
  let hasReliabilityPattern = false;
  let hasFamilyPattern = false;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const content = msg.content;

    // Extract vehicle names
    let nameMatch;
    VEHICLE_NAME_RE.lastIndex = 0;
    while ((nameMatch = VEHICLE_NAME_RE.exec(content)) !== null) {
      const brand = nameMatch[1].trim();
      const model = nameMatch[2].trim();
      const fullName = `${capitalize(brand)} ${model}`.replace(/\s+/g, " ");
      // Deduplicate by normalized name
      if (!vehicleNames.some((v) => normalize(v) === normalize(fullName))) {
        vehicleNames.push(fullName);
      }
      activeVehicle = fullName;
    }

    // Extract generation UUIDs from tool results (injected by pre-router)
    UUID_RE.lastIndex = 0;
    let uuidMatch;
    while ((uuidMatch = UUID_RE.exec(content)) !== null) {
      const id = uuidMatch[0];
      if (!vehicleIds.includes(id)) {
        vehicleIds.push(id);
      }
      activeVehicleId = id;
    }

    // Detect topic patterns
    if (/compar|vs\.?|versus|face\s*[àa]|contre/i.test(content)) {
      hasComparePattern = true;
    }
    if (/budget|prix|co[uû]t|tco|mensuel|combien/i.test(content)) {
      hasBudgetPattern = true;
    }
    if (/fiab|panne|probl[eè]m|t[uü]v|red\s*flag|d[eé]faut/i.test(content)) {
      hasReliabilityPattern = true;
    }
    if (/isofix|si[eè]ge.*enfant|family|famille|poussette|b[eé]b[eé]/i.test(content)) {
      hasFamilyPattern = true;
    }
  }

  // Build topics
  if (vehicleNames.length > 0) {
    topics.push({
      type: "vehicle",
      entities: vehicleNames,
      generationIds: vehicleIds,
      lastMentionedIndex: messages.length - 1,
    });
  }
  if (hasComparePattern && vehicleNames.length >= 2) {
    topics.push({
      type: "comparison",
      entities: vehicleNames.slice(-2),
      generationIds: [],
      lastMentionedIndex: messages.length - 1,
    });
    comparisonPair = [vehicleNames[vehicleNames.length - 2], vehicleNames[vehicleNames.length - 1]];
  }
  if (hasBudgetPattern) {
    topics.push({ type: "budget", entities: [], generationIds: [], lastMentionedIndex: messages.length - 1 });
  }
  if (hasFamilyPattern) {
    topics.push({ type: "family", entities: [], generationIds: [], lastMentionedIndex: messages.length - 1 });
  }
  if (hasReliabilityPattern) {
    topics.push({ type: "reliability", entities: [], generationIds: [], lastMentionedIndex: messages.length - 1 });
  }

  // Infer user intent
  let userIntent: StructuredContext["userIntent"] = "exploring";
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  if (hasComparePattern && vehicleNames.length >= 2) {
    userIntent = "comparing";
  } else if (hasBudgetPattern) {
    userIntent = "deciding";
  } else if (hasReliabilityPattern) {
    userIntent = "researching";
  } else if (userMsgCount >= 3 && vehicleNames.length >= 1) {
    userIntent = "researching";
  }

  return {
    topics,
    activeVehicle,
    activeVehicleId,
    comparisonPair,
    userIntent,
    turnCount: messages.length,
    hasPreferences: false, // set by caller
  };
}

/**
 * Build a context injection string for the ALAIN system prompt.
 */
export function buildContextPrompt(ctx: StructuredContext): string {
  if (!ctx.activeVehicle && !ctx.comparisonPair) return "";

  const parts: string[] = ["\n\n## Contexte de conversation"];

  if (ctx.activeVehicle) {
    parts.push(
      `Le véhicule actuellement discuté est : **${ctx.activeVehicle}**${ctx.activeVehicleId ? ` (ID: ${ctx.activeVehicleId})` : ""}.`
    );
  }

  if (ctx.comparisonPair) {
    parts.push(`Comparaison en cours : ${ctx.comparisonPair[0]} vs ${ctx.comparisonPair[1]}.`);
  }

  const intentLabels: Record<string, string> = {
    comparing: "comparer des modèles",
    deciding: "en phase de décision (budget/TCO)",
    researching: "faire des recherches approfondies",
    exploring: "explorer",
  };
  parts.push(`L'utilisateur semble ${intentLabels[ctx.userIntent]}.`);

  if (ctx.activeVehicle) {
    parts.push(
      `Si l'utilisateur fait une référence implicite (ex: "et en diesel ?", "son coffre ?", "fiable ?"), il parle de **${ctx.activeVehicle}**.`
    );
  }

  return parts.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
