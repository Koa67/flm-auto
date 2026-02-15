import { NextRequest } from "next/server";
import { ALAIN_SYSTEM_PROMPT } from "@/lib/alain/prompts";
import { ALAIN_TOOLS } from "@/lib/alain/tools";
import { executeTool } from "@/lib/alain/execute-tool";
import { alainChatSchema } from "@/lib/validators";
import { buildStructuredContext, buildContextPrompt, type StructuredContext } from "@/lib/alain/context-tracker";
import { generateDynamicSuggestions } from "@/lib/alain/dynamic-suggestions";
import { detectFollowUp } from "@/lib/alain/follow-up-detector";

const MAX_TURNS = 5;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const ALAIN_MODEL = process.env.ALAIN_MODEL || "alain-auto";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface UserPreferences {
  budget?: { min: number; max: number };
  fuelTypes?: string[];
  childSeats?: number;
  priorities?: string[];
  usage?: string[];
}

// Build a preference summary for the system prompt
function buildPreferencePrompt(prefs: UserPreferences): string {
  const parts: string[] = [];
  if (prefs.budget) {
    parts.push(`Budget : ${prefs.budget.min > 0 ? `${prefs.budget.min.toLocaleString("fr-FR")} - ` : "max "}${prefs.budget.max.toLocaleString("fr-FR")} euros`);
  }
  if (prefs.fuelTypes?.length) parts.push(`Carburant : ${prefs.fuelTypes.join(", ")}`);
  if (prefs.childSeats) parts.push(`${prefs.childSeats} enfant(s) (sieges auto)`);
  if (prefs.priorities?.length) parts.push(`Priorites : ${prefs.priorities.join(", ")}`);
  if (prefs.usage?.length) parts.push(`Usage : ${prefs.usage.join(", ")}`);
  return parts.length > 0
    ? `\n\n## Preferences utilisateur\nL'utilisateur a indique les preferences suivantes : ${parts.join(" | ")}.\nAdapte tes reponses en consequence.`
    : "";
}

// Sliding window: for long conversations, send a summary + last 4 messages
function buildSlidingWindow(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= 10) return messages;

  const older = messages.slice(0, -4);
  const recent = messages.slice(-4);

  const vehiclesMentioned = new Set<string>();
  const topics = new Set<string>();

  const vehicleRe = /\b(bmw|mercedes|audi|porsche|volkswagen|peugeot|renault|citroen|tesla|toyota|honda|volvo|mazda|hyundai|kia|nissan|ford|fiat)\s+([a-z0-9\s-]+?)(?:\s|,|\.|$)/gi;

  for (const m of older) {
    let match;
    while ((match = vehicleRe.exec(m.content)) !== null) {
      vehiclesMentioned.add(`${match[1]} ${match[2]}`.trim());
    }
    if (/fiabilit|moteur|panne/i.test(m.content)) topics.add("fiabilite");
    if (/coffre|volume|espace/i.test(m.content)) topics.add("coffre");
    if (/securit|ncap|crash/i.test(m.content)) topics.add("securite");
    if (/compar|vs|versus/i.test(m.content)) topics.add("comparaison");
    if (/isofix|siege.*enfant|family/i.test(m.content)) topics.add("famille");
    if (/budget|prix|cout/i.test(m.content)) topics.add("budget");
  }

  const summaryParts: string[] = [];
  if (vehiclesMentioned.size > 0) {
    summaryParts.push(`Vehicules discutes : ${[...vehiclesMentioned].slice(0, 8).join(", ")}`);
  }
  if (topics.size > 0) {
    summaryParts.push(`Sujets abordes : ${[...topics].join(", ")}`);
  }
  summaryParts.push(`${older.length} messages precedents resumes ci-dessus.`);

  const summaryMessage: ChatMessage = {
    role: "user",
    content: `[Resume de la conversation precedente] ${summaryParts.join(". ")}`,
  };

  return [summaryMessage, ...recent];
}

// ---------------------------------------------------------------------------
// Ollama provider (local SLM)
// ---------------------------------------------------------------------------

interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
}

interface OllamaResponse {
  message: OllamaMessage;
  done: boolean;
}

async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ollamaChat(
  messages: OllamaMessage[],
  tools?: { name: string; description: string; input_schema: any }[]
): Promise<OllamaResponse> {
  const body: Record<string, unknown> = {
    model: ALAIN_MODEL,
    messages,
    stream: false,
    options: { temperature: 0.3, num_ctx: 4096 },
  };

  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama ${res.status}: ${text}`);
  }

  return res.json();
}

// Stream version: yields text chunks from Ollama
async function* ollamaChatStream(
  messages: OllamaMessage[]
): AsyncGenerator<{ content: string; done: boolean }> {
  const body = {
    model: ALAIN_MODEL,
    messages,
    stream: true,
    options: { temperature: 0.3, num_ctx: 4096 },
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama ${res.status}: ${text}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        yield {
          content: json.message?.content || "",
          done: json.done || false,
        };
      } catch {
        // Partial JSON, wait for more data
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer);
      yield { content: json.message?.content || "", done: json.done || false };
    } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Pre-router: detect vehicle-specific queries and force tool calls for small
// models that don't reliably use tools on their own (3B parameter limitation).
// ---------------------------------------------------------------------------

const BRAND_PATTERNS = /\b(bmw|mercedes|audi|porsche|volkswagen|vw|peugeot|renault|citro[eë]n|tesla|toyota|honda|ford|fiat|alfa romeo|volvo|mazda|hyundai|kia|nissan|skoda|seat|cupra|opel|mini|jaguar|land rover|lamborghini|ferrari|maserati|bentley|rolls[- ]royce|aston martin|ds|dacia|suzuki|mitsubishi|lexus|infiniti|genesis|subaru|chevrolet)\b/i;

const CHASSIS_PATTERN = /\b([EFGW]\d{1,3}|[A-Z]{1,2}\d{2,3})\b/;

const ENGINE_PATTERN = /\b(PureTech|BlueHDi|THP|N[45]\d[A-Z]?\w*|EA\d{3}|TSI|TFSI|B[45]8|S[56]3|M[25]7|K20|1NZ|2JZ|RB26|LS[1-9]|HEMI|EcoBoost|Skyactiv|MultiAir|Multijet|HDi|dCi|TCe|Renesis|Boxer|H4|FA20)\b/i;

const COMPARE_PATTERN = /\b(compare[rz]?|vs\.?|versus|diff[eé]rence|face\s*[àa]|contre|ou\b.*mieux)\b/i;
const FAMILY_PATTERN = /\b(isofix|si[eè]ge[s]?\s*(?:enfant|auto|b[eé]b[eé])|family\s*fit|3[\s-]?across|poussette|bébé|enfant)/i;
const CARGO_PATTERN = /\b(coffre|volume\s*(?:coffre|litres?)|cargo|chargement|valise[s]?)\b/i;
const SAFETY_PATTERN = /\b(ncap|euro\s*ncap|s[eé]curit[eé]|crash\s*test|[eé]toile[s]?\s*(?:ncap|s[eé]curit[eé])|note\s*s[eé]curit[eé]|safety)\b/i;
const RECALL_PATTERN = /\b(rappel[s]?|recall[s]?|d[eé]faut|campagne\s*de\s*rappel)\b/i;
const RELIABILITY_PATTERN = /\b(fiab[il]*[eé]|pannes?|probl[eè]mes?\s*connus?|taux\s*de\s*panne|t[uü]v|d[eé]fauts?|red\s*flags?|points?\s*faibles?)\b/i;
const TCO_PATTERN = /\b(tco|co[uû]t\s*(?:total|mensuel|r[eé]el|possession)|combien\s*(?:co[uû]te|revient|par\s*mois)|budget\s*mensuel|d[eé]pr[eé]ciation|malus)\b/i;

type DetectedType = "search" | "engine" | "compare" | "family" | "cargo" | "safety" | "recall" | "reliability" | "tco" | null;

// Anaphore / implicit reference patterns (v5)
const REFINEMENT_RE = /^(et |mais )(en |avec |sans |la version |le modèle )/i;
const COMPARISON_ADD_RE = /^(et )(la |le |un |une )?([\w]+)/i;
const POSSESSIVE_RE = /\b(son |sa |ses |leur )(coffre|prix|fiabilit[eé]|consommation|s[eé]curit[eé]|puissance|moteur|poids|0[- ][àa][- ]100)/i;
const DEICTIC_RE = /\b(celui-l[àa]|celle-ci|ce mod[eè]le|cette voiture|cette bagnole)\b/i;
const COMPARE_IMPLICIT_RE = /\b(lequel|laquelle|compare[- ]les|les deux)\b/i;

function detectVehicleQuery(message: string, ctx?: StructuredContext): { type: DetectedType; query: string } {
  // Check for engine code queries first (most specific)
  const engineMatch = ENGINE_PATTERN.exec(message);
  if (engineMatch && /fiab|problèm|souci|connu|warning|alert|panne/i.test(message)) {
    return { type: "engine", query: engineMatch[1] };
  }

  const hasBrand = BRAND_PATTERNS.test(message);
  const hasChassis = CHASSIS_PATTERN.test(message);
  const hasVehicle = hasBrand || hasChassis;

  // --- v5: Context-aware implicit reference resolution ---
  if (!hasVehicle && ctx?.activeVehicle) {
    // "et en diesel ?" → search activeVehicle + fuel
    if (REFINEMENT_RE.test(message)) {
      const suffix = message.replace(REFINEMENT_RE, "").replace(/[?!.,;:]/g, "").trim();
      return { type: "search", query: `${ctx.activeVehicle} ${suffix}` };
    }

    // "et la Mercedes ?" → comparison_add
    if (COMPARISON_ADD_RE.test(message) && ctx.activeVehicle) {
      return { type: "compare", query: `${ctx.activeVehicle} vs ${message.replace(/^et\s+/i, "")}` };
    }

    // "lequel est mieux ?" / "compare les deux" → use comparisonPair
    if (COMPARE_IMPLICIT_RE.test(message) && ctx.comparisonPair) {
      return { type: "compare", query: `${ctx.comparisonPair[0]} vs ${ctx.comparisonPair[1]}` };
    }

    // "son coffre ?", "sa fiabilité ?" → possessive → activeVehicle
    if (POSSESSIVE_RE.test(message)) {
      const topic = message.replace(POSSESSIVE_RE, "$2").replace(/[?!.,;:]/g, "").trim();
      const topicType = inferTopicType(topic);
      return { type: topicType || "search", query: `${ctx.activeVehicle} ${topic}` };
    }

    // "celui-là", "ce modèle" → deictic → activeVehicle
    if (DEICTIC_RE.test(message)) {
      const cleaned = message.replace(DEICTIC_RE, ctx.activeVehicle).replace(/[?!.,;:]/g, "").trim();
      return { type: "search", query: cleaned };
    }

    // Short implicit follow-up: "fiable ?", "coffre ?", "prix ?"
    if (message.length < 30) {
      const topicType = inferTopicType(message);
      if (topicType) {
        return { type: topicType, query: `${ctx.activeVehicle} ${message.replace(/[?!.,;:]/g, "").trim()}` };
      }
    }
  }

  // --- Original detection logic (explicit brand/vehicle present) ---

  // Comparison detection (needs at least one brand/vehicle reference)
  if (hasVehicle && COMPARE_PATTERN.test(message)) {
    return { type: "compare", query: message };
  }

  // Family/ISOFIX detection
  if (hasVehicle && FAMILY_PATTERN.test(message)) {
    const query = message.replace(/[?!.,;:]/g, "").trim().replace(/\s+/g, " ");
    return { type: "family", query };
  }

  // Cargo/trunk detection with vehicle
  if (hasVehicle && CARGO_PATTERN.test(message)) {
    const query = message.replace(/[?!.,;:]/g, "").trim().replace(/\s+/g, " ");
    return { type: "cargo", query };
  }

  // Safety detection with vehicle
  if (hasVehicle && SAFETY_PATTERN.test(message)) {
    const query = message.replace(/[?!.,;:]/g, "").trim().replace(/\s+/g, " ");
    return { type: "safety", query };
  }

  // Recall detection with vehicle
  if (hasVehicle && RECALL_PATTERN.test(message)) {
    const query = message.replace(/[?!.,;:]/g, "").trim().replace(/\s+/g, " ");
    return { type: "recall", query };
  }

  // Reliability detection with vehicle
  if (hasVehicle && RELIABILITY_PATTERN.test(message)) {
    const query = message.replace(/[?!.,;:]/g, "").trim().replace(/\s+/g, " ");
    return { type: "reliability", query };
  }

  // TCO / cost detection with vehicle
  if (hasVehicle && TCO_PATTERN.test(message)) {
    const query = message.replace(/[?!.,;:]/g, "").trim().replace(/\s+/g, " ");
    return { type: "tco", query };
  }

  // Generic vehicle search
  if (hasVehicle) {
    const query = message
      .replace(/[?!.,;:]/g, "")
      .replace(/\b(quelle?|combien|est-ce que?|c'?est quoi|montre|quel|volume|puissance|consommation|coffre|note|poids|vitesse|accélération|fiche technique|prix|euro ncap|sécurité|fiabilité)\b/gi, "")
      .trim()
      .replace(/\s+/g, " ");
    return { type: "search", query: query || message };
  }

  return { type: null, query: "" };
}

/** Infer a specific topic type from short text */
function inferTopicType(text: string): DetectedType | null {
  const t = text.toLowerCase();
  if (/fiab|panne|probl[eè]m|t[uü]v|red\s*flag/i.test(t)) return "reliability";
  if (/coffre|volume|espace|cargo/i.test(t)) return "cargo";
  if (/s[eé]curit[eé]|ncap|crash/i.test(t)) return "safety";
  if (/isofix|si[eè]ge|enfant|famille|family/i.test(t)) return "family";
  if (/prix|co[uû]t|tco|budget|mensuel/i.test(t)) return "tco";
  if (/rappel|recall/i.test(t)) return "recall";
  if (/compar|vs|versus/i.test(t)) return "compare";
  return null;
}

async function handleOllama(
  systemPrompt: string,
  messages: ChatMessage[],
  ctx?: StructuredContext
): Promise<{ message: string; turns_used: number; provider: string; preRouted: boolean }> {
  // Apply sliding window for long conversations
  const windowedMessages = buildSlidingWindow(messages);

  const ollamaMessages: OllamaMessage[] = [
    { role: "system", content: systemPrompt },
    ...windowedMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const ollamaTools = ALAIN_TOOLS.map((t) => ({
    name: t.name,
    description: t.description || "",
    input_schema: t.input_schema,
  }));

  // Pre-router: for vehicle-specific queries, force a tool call upfront
  // so the small model gets real data instead of hallucinating or refusing
  const lastUserMessage = messages[messages.length - 1]?.content || "";

  // v5: Follow-up detection — resolve implicit references before pre-routing
  const followUp = ctx ? detectFollowUp(lastUserMessage, ctx) : null;
  const routingQuery = followUp && followUp.type !== "new_topic" && followUp.resolvedQuery !== lastUserMessage
    ? followUp.resolvedQuery
    : lastUserMessage;
  const skipPreRouter = followUp && (followUp.type === "clarification" || followUp.type === "opinion");

  const detected = skipPreRouter ? { type: null as DetectedType, query: "" } : detectVehicleQuery(routingQuery, ctx);
  let preRouted = false;

  if (detected.type && detected.type !== null) {
    try {
      let toolResult: string | null = null;
      let contextLabel = "";

      switch (detected.type) {
        case "search": {
          const searchResult = await executeTool("search_vehicles", { query: detected.query, limit: 3 });
          const parsed = JSON.parse(searchResult);
          const hasResults = Array.isArray(parsed) ? parsed.length > 0 : parsed.results?.length !== 0;
          if (hasResults) { toolResult = searchResult; contextLabel = "résultats de recherche"; }
          break;
        }
        case "engine": {
          toolResult = await executeTool("check_engine_warnings", { engine_code: detected.query });
          contextLabel = "données de fiabilité moteur";
          break;
        }
        case "compare": {
          // Search for both vehicles mentioned, then compare or just inject search data
          const searchResult = await executeTool("search_vehicles", { query: detected.query, limit: 6 });
          const parsed = JSON.parse(searchResult);
          const hasResults = Array.isArray(parsed) ? parsed.length > 0 : parsed.results?.length !== 0;
          if (hasResults) { toolResult = searchResult; contextLabel = "véhicules trouvés pour la comparaison"; }
          break;
        }
        case "family": {
          // Search vehicle first, then get family fit data
          const searchResult = await executeTool("search_vehicles", { query: detected.query, limit: 2 });
          const parsed = JSON.parse(searchResult);
          let genId: string | null = null;
          if (Array.isArray(parsed) && parsed.length > 0) {
            genId = parsed[0].generation_id || parsed[0].generations?.[0]?.id || null;
          }
          if (genId) {
            const familyResult = await executeTool("check_family_fit", { generation_id: genId });
            toolResult = `Véhicule: ${JSON.stringify(parsed[0])}\nFamily Fit: ${familyResult}`;
            contextLabel = "données famille et ISOFIX";
          } else {
            toolResult = searchResult;
            contextLabel = "résultats de recherche";
          }
          break;
        }
        case "cargo": {
          const searchResult = await executeTool("search_vehicles", { query: detected.query, limit: 2 });
          const parsed = JSON.parse(searchResult);
          let genId: string | null = null;
          if (Array.isArray(parsed) && parsed.length > 0) {
            genId = parsed[0].generation_id || parsed[0].generations?.[0]?.id || null;
          }
          if (genId) {
            const cargoResult = await executeTool("get_cargo_info", { generation_id: genId });
            toolResult = `Véhicule: ${JSON.stringify(parsed[0])}\nCoffre: ${cargoResult}`;
            contextLabel = "données coffre";
          } else {
            toolResult = searchResult;
            contextLabel = "résultats de recherche";
          }
          break;
        }
        case "safety": {
          // Use search_and_detail to get full specs including safety
          const detailResult = await executeTool("search_and_detail", { query: detected.query });
          toolResult = detailResult;
          contextLabel = "fiche technique avec sécurité";
          break;
        }
        case "recall": {
          const searchResult = await executeTool("search_vehicles", { query: detected.query, limit: 2 });
          const parsed = JSON.parse(searchResult);
          let genId: string | null = null;
          if (Array.isArray(parsed) && parsed.length > 0) {
            genId = parsed[0].generation_id || parsed[0].generations?.[0]?.id || null;
          }
          if (genId) {
            const recallResult = await executeTool("get_recalls", { generation_id: genId });
            toolResult = `Véhicule: ${JSON.stringify(parsed[0])}\nRappels: ${recallResult}`;
            contextLabel = "rappels constructeur";
          }
          break;
        }
        case "reliability": {
          const searchResult = await executeTool("search_vehicles", { query: detected.query, limit: 2 });
          const parsed = JSON.parse(searchResult);
          let genId: string | null = null;
          if (Array.isArray(parsed) && parsed.length > 0) {
            genId = parsed[0].generation_id || parsed[0].generations?.[0]?.id || null;
          }
          if (genId) {
            const reliabilityResult = await executeTool("get_reliability", { generation_id: genId });
            toolResult = `Véhicule: ${JSON.stringify(parsed[0])}\nFiabilité: ${reliabilityResult}`;
            contextLabel = "données de fiabilité";
          } else {
            toolResult = searchResult;
            contextLabel = "résultats de recherche";
          }
          break;
        }
        case "tco": {
          const searchResult = await executeTool("search_vehicles", { query: detected.query, limit: 2 });
          const parsed = JSON.parse(searchResult);
          let genId: string | null = null;
          if (Array.isArray(parsed) && parsed.length > 0) {
            genId = parsed[0].generation_id || parsed[0].generations?.[0]?.id || null;
          }
          if (genId) {
            const tcoResult = await executeTool("calculate_tco", { generation_id: genId });
            toolResult = `Véhicule: ${JSON.stringify(parsed[0])}\nTCO: ${tcoResult}`;
            contextLabel = "coût total de possession";
          } else {
            toolResult = searchResult;
            contextLabel = "résultats de recherche";
          }
          break;
        }
      }

      if (toolResult) {
        ollamaMessages.push({
          role: "assistant",
          content: `J'ai trouvé des ${contextLabel} dans la base FLM AUTO :\n${toolResult}`,
        });
        ollamaMessages.push({
          role: "user",
          content: `En te basant sur ces données, réponds à ma question initiale : ${lastUserMessage}`,
        });
        preRouted = true;
      }
    } catch {
      // Pre-routing failed, fall through to normal flow
    }
  }

  let turns = 0;
  let finalText = "";

  while (turns < MAX_TURNS) {
    turns++;

    // If pre-routed, skip tools for the first call (data already injected)
    const response = await ollamaChat(
      ollamaMessages,
      preRouted && turns === 1 ? undefined : ollamaTools
    );
    const toolCalls = response.message.tool_calls || [];

    if (toolCalls.length === 0) {
      finalText = response.message.content;
      break;
    }

    // Add assistant message with tool calls
    ollamaMessages.push(response.message);

    // Execute tools in parallel
    for (const tc of toolCalls) {
      const result = await executeTool(tc.function.name, tc.function.arguments);
      ollamaMessages.push({ role: "tool", content: result });
    }
  }

  return { message: finalText, turns_used: turns, provider: "ollama", preRouted };
}

// ---------------------------------------------------------------------------
// Streaming Ollama handler — returns a ReadableStream for SSE
// ---------------------------------------------------------------------------

function handleOllamaStream(
  systemPrompt: string,
  messages: ChatMessage[],
  ctx?: StructuredContext
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Apply sliding window
        const windowedMessages = buildSlidingWindow(messages);
        const ollamaMessages: OllamaMessage[] = [
          { role: "system", content: systemPrompt },
          ...windowedMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        // Pre-router (non-streaming: tool calls need full responses)
        const lastUserMessage = messages[messages.length - 1]?.content || "";

        // v5: Follow-up detection for streaming
        const followUp = ctx ? detectFollowUp(lastUserMessage, ctx) : null;
        const routingQuery = followUp && followUp.type !== "new_topic" && followUp.resolvedQuery !== lastUserMessage
          ? followUp.resolvedQuery
          : lastUserMessage;
        const skipPreRouter = followUp && (followUp.type === "clarification" || followUp.type === "opinion");

        const detected = skipPreRouter ? { type: null as DetectedType, query: "" } : detectVehicleQuery(routingQuery, ctx);

        if (detected.type) {
          try {
            let toolResult: string | null = null;
            let contextLabel = "";

            // Re-use the same pre-routing logic (abbreviated — covers main cases)
            if (detected.type === "search") {
              const r = await executeTool("search_vehicles", { query: detected.query, limit: 3 });
              const p = JSON.parse(r);
              if ((Array.isArray(p) ? p.length : p.results?.length) > 0) {
                toolResult = r; contextLabel = "résultats de recherche";
              }
            } else if (detected.type === "engine") {
              toolResult = await executeTool("check_engine_warnings", { engine_code: detected.query });
              contextLabel = "données moteur";
            } else {
              // For all other types: search → get gen_id → call specific tool
              const r = await executeTool("search_vehicles", { query: detected.query, limit: 2 });
              const p = JSON.parse(r);
              const genId = Array.isArray(p) && p.length > 0
                ? p[0].generation_id || p[0].generations?.[0]?.id : null;
              if (genId) {
                const toolMap: Record<string, [string, Record<string, unknown>]> = {
                  family: ["check_family_fit", { generation_id: genId }],
                  cargo: ["get_cargo_info", { generation_id: genId }],
                  recall: ["get_recalls", { generation_id: genId }],
                  reliability: ["get_reliability", { generation_id: genId }],
                  tco: ["calculate_tco", { generation_id: genId }],
                  safety: ["search_and_detail", { query: detected.query }],
                  compare: ["search_vehicles", { query: detected.query, limit: 6 }],
                };
                const entry = toolMap[detected.type];
                if (entry) {
                  const result = await executeTool(entry[0], entry[1]);
                  toolResult = `Véhicule: ${JSON.stringify(p[0])}\n${result}`;
                  contextLabel = detected.type;
                }
              } else {
                toolResult = r;
                contextLabel = "résultats de recherche";
              }
            }

            if (toolResult) {
              // Send pre-routed data as a status event
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: "status", content: "Données trouvées, génération de la réponse..." })}\n\n`
              ));
              ollamaMessages.push({
                role: "assistant",
                content: `J'ai trouvé des ${contextLabel} dans la base FLM AUTO :\n${toolResult}`,
              });
              ollamaMessages.push({
                role: "user",
                content: `En te basant sur ces données, réponds à ma question initiale : ${lastUserMessage}`,
              });
            }
          } catch {
            // Pre-routing failed, continue without
          }
        }

        // Stream the final response
        for await (const chunk of ollamaChatStream(ollamaMessages)) {
          if (chunk.content) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "token", content: chunk.content })}\n\n`
            ));
          }
          if (chunk.done) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "done", provider: "ollama" })}\n\n`
            ));
          }
        }

        // Send dynamic suggestions after stream completes (v5)
        if (ctx) {
          const suggestions = generateDynamicSuggestions(ctx);
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: "suggestions", suggestions })}\n\n`
          ));
        }

        controller.close();
      } catch (err: any) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "error", content: err.message || "Erreur streaming" })}\n\n`
        ));
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Anthropic provider (cloud fallback)
// ---------------------------------------------------------------------------

async function handleAnthropic(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<{ message: string; turns_used: number; provider: string; preRouted: boolean }> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const windowedMessages = buildSlidingWindow(messages);
  const anthropicMessages: any[] = windowedMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let turns = 0;
  let finalText = "";

  while (turns < MAX_TURNS) {
    turns++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      tools: ALAIN_TOOLS,
      messages: anthropicMessages,
    });

    const toolUseBlocks = response.content.filter(
      (b: any) => b.type === "tool_use"
    );
    const textBlocks = response.content.filter(
      (b: any) => b.type === "text"
    );

    if (toolUseBlocks.length === 0) {
      finalText = textBlocks.map((b: any) => b.text).join("");
      break;
    }

    anthropicMessages.push({ role: "assistant", content: response.content });

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolUse: any) => {
        const result = await executeTool(toolUse.name, toolUse.input);
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: result,
        };
      })
    );

    anthropicMessages.push({ role: "user", content: toolResults });

    if (response.stop_reason === "end_turn" && textBlocks.length > 0) {
      finalText = textBlocks.map((b: any) => b.text).join("");
    }
  }

  return { message: finalText, turns_used: turns, provider: "anthropic", preRouted: false };
}

// ---------------------------------------------------------------------------
// Route handler — tries Ollama first, falls back to Anthropic
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = alainChatSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Données invalides" }, { status: 400 });
  }

  const messages: ChatMessage[] = parsed.data.messages;
  const vehicleContext: string | undefined = parsed.data.vehicleContext;
  const preferences: UserPreferences | undefined = parsed.data.preferences;
  const wantStream = parsed.data.stream === true;

  // Build structured context from conversation history (v5)
  const ctx = buildStructuredContext(messages);
  ctx.hasPreferences = !!preferences;

  // Build system prompt
  let systemPrompt = ALAIN_SYSTEM_PROMPT;
  if (vehicleContext) {
    systemPrompt += `\n\n## Contexte actuel\nL'utilisateur consulte actuellement : ${vehicleContext}. Utilise cette info pour contextualiser tes réponses.`;
  }
  // Inject conversation context (v5: active vehicle, comparison pair, intent)
  systemPrompt += buildContextPrompt(ctx);
  if (preferences) {
    systemPrompt += buildPreferencePrompt(preferences);
  }

  // Strategy:
  // 1. Try Ollama (local SLM) — $0/req, ~200ms latency
  // 2. If Ollama unavailable AND ANTHROPIC_API_KEY exists → fallback to Anthropic
  // 3. If nothing works → error message

  const isOllamaUp = await ollamaAvailable();

  if (isOllamaUp) {
    try {
      // SSE streaming mode
      if (wantStream) {
        const stream = handleOllamaStream(systemPrompt, messages, ctx);
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
      const result = await handleOllama(systemPrompt, messages, ctx);
      return Response.json({ ...result, suggestions: generateDynamicSuggestions(ctx) });
    } catch (err: any) {
      console.error("[ALAIN] Ollama error, attempting fallback:", err.message);
      // Fall through to Anthropic
    }
  }

  // Fallback: Anthropic cloud (no streaming — cloud fallback is rare)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const result = await handleAnthropic(systemPrompt, messages);
      return Response.json(result);
    } catch (err: any) {
      console.error("[ALAIN] Anthropic error:", err.message);
      return Response.json(
        { error: "ALAIN est temporairement indisponible" },
        { status: 503 }
      );
    }
  }

  // Nothing available
  return Response.json(
    {
      error: isOllamaUp
        ? "Erreur du modèle local"
        : "ALAIN est temporairement indisponible (serveur local arrêté)",
    },
    { status: 503 }
  );
}
