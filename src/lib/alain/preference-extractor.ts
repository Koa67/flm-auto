/**
 * Client-side regex preference extraction from user messages.
 * No LLM call — instant and deterministic.
 */

export interface UserPreferences {
  budget?: { min: number; max: number };
  fuelTypes?: string[];
  childSeats?: number;
  priorities?: string[];
  usage?: string[];
}

const BUDGET_PATTERNS = [
  /budget\s*(?:de\s*)?(\d[\d\s]*)\s*(?:€|euros?|k)/i,
  /moins\s*de\s*(\d[\d\s]*)\s*(?:€|euros?|k)/i,
  /entre\s*(\d[\d\s]*)\s*(?:€|euros?|k)?\s*et\s*(\d[\d\s]*)\s*(?:€|euros?|k)/i,
  /(\d[\d\s]*)\s*(?:€|euros?)\s*(?:max|maximum)/i,
  /pas\s*(?:plus|au-dessus)\s*(?:de\s*)?(\d[\d\s]*)\s*(?:€|euros?|k)/i,
  /(\d[\d\s]*)\s*-\s*(\d[\d\s]*)\s*(?:€|euros?|k)/i,
];

const FUEL_PATTERNS: [RegExp, string][] = [
  [/\b(diesel)\b/i, "diesel"],
  [/\b(essence)\b/i, "essence"],
  [/\b([ée]lectrique|ev|bev)\b/i, "electrique"],
  [/\b(hybride\s*rechargeable|phev)\b/i, "hybride_rechargeable"],
  [/\b(hybride|hev)\b/i, "hybride"],
];

const CHILD_PATTERNS = [
  /(\d+)\s*(?:enfants?|gosses?|gamins?)/i,
  /(\d+)\s*(?:si[èe]ges?\s*(?:enfants?|auto|b[ée]b[ée]))/i,
  /(\d+)\s*(?:b[ée]b[ée]s?)/i,
  /si[èe]ges?\s*(?:enfants?|auto)\s*(\d+)/i,
];

const USAGE_PATTERNS: [RegExp, string][] = [
  [/\b(ville|urbain)\b/i, "ville"],
  [/\b(autoroute|route|long\s*trajet|grands?\s*trajets?)\b/i, "autoroute"],
  [/\b(montagne|col)\b/i, "montagne"],
  [/\b(remorqu|tractage|attelage|caravane)\b/i, "remorquage"],
  [/\b(quotidien|tous?\s*les?\s*jours?|trajet\s*(?:domicile|maison))\b/i, "quotidien"],
];

const PRIORITY_PATTERNS: [RegExp, string][] = [
  [/\b(confort(?:able)?)\b/i, "confort"],
  [/\b(sportif|sportive|performan)/i, "sportif"],
  [/\b([ée]conomique|[ée]conomie|sobre)\b/i, "economique"],
  [/\b(familial|famille)\b/i, "familial"],
  [/\b(fiabilit[ée]|fiable)\b/i, "fiabilite"],
  [/\b(s[ée]curit[ée]|s[ûu]r)\b/i, "securite"],
  [/\b(coffre|volume|espace)\b/i, "espace"],
];

function parseNumber(raw: string): number {
  const cleaned = raw.replace(/\s/g, "");
  const n = parseInt(cleaned, 10);
  if (isNaN(n)) return 0;
  // "25k" or "25" where user clearly means thousands
  if (n < 500 && /k/i.test(raw)) return n * 1000;
  if (n < 500) return n * 1000; // "25" → 25,000€
  return n;
}

/**
 * Extract preferences from a single user message.
 * Returns only the fields that were detected.
 */
export function extractPreferences(text: string): Partial<UserPreferences> {
  const prefs: Partial<UserPreferences> = {};

  // Budget
  for (const pattern of BUDGET_PATTERNS) {
    const m = pattern.exec(text);
    if (m) {
      if (m[2]) {
        // Range: "entre X et Y"
        prefs.budget = { min: parseNumber(m[1]), max: parseNumber(m[2]) };
      } else if (/moins|pas.*plus|max/i.test(text)) {
        prefs.budget = { min: 0, max: parseNumber(m[1]) };
      } else {
        const val = parseNumber(m[1]);
        prefs.budget = { min: Math.round(val * 0.8), max: val };
      }
      break;
    }
  }

  // Fuel types
  const fuels: string[] = [];
  for (const [pat, fuel] of FUEL_PATTERNS) {
    if (pat.test(text) && !fuels.includes(fuel)) fuels.push(fuel);
  }
  if (fuels.length > 0) prefs.fuelTypes = fuels;

  // Child seats
  for (const pattern of CHILD_PATTERNS) {
    const m = pattern.exec(text);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 5) prefs.childSeats = n;
      break;
    }
  }

  // Usage
  const usages: string[] = [];
  for (const [pat, usage] of USAGE_PATTERNS) {
    if (pat.test(text) && !usages.includes(usage)) usages.push(usage);
  }
  if (usages.length > 0) prefs.usage = usages;

  // Priorities
  const priorities: string[] = [];
  for (const [pat, prio] of PRIORITY_PATTERNS) {
    if (pat.test(text) && !priorities.includes(prio)) priorities.push(prio);
  }
  if (priorities.length > 0) prefs.priorities = priorities;

  return prefs;
}

/**
 * Merge extracted preferences into existing ones.
 * New values override old, arrays are unioned.
 */
export function mergePreferences(
  existing: UserPreferences,
  update: Partial<UserPreferences>
): UserPreferences {
  const merged = { ...existing };

  if (update.budget) merged.budget = update.budget;
  if (update.childSeats !== undefined) merged.childSeats = update.childSeats;

  if (update.fuelTypes) {
    const set = new Set([...(existing.fuelTypes || []), ...update.fuelTypes]);
    merged.fuelTypes = [...set];
  }
  if (update.priorities) {
    const set = new Set([...(existing.priorities || []), ...update.priorities]);
    merged.priorities = [...set];
  }
  if (update.usage) {
    const set = new Set([...(existing.usage || []), ...update.usage]);
    merged.usage = [...set];
  }

  return merged;
}
