import { z } from "zod";

// ==============================
// LEGACY HELPERS (backward compat)
// ==============================

/** Email validation - RFC 5322 simplified */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** UUID v4 validation */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

/** Clamp string length to prevent DoS */
export function sanitizeQuery(query: string, maxLength = 200): string {
  return query.slice(0, maxLength).trim();
}

/** Safe error response - never leak internal details */
export function safeError(message = "Erreur serveur") {
  return { error: message };
}

// ==============================
// ZOD SCHEMAS
// ==============================

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const emailSchema = z.string().email().max(254).toLowerCase().trim();

export const newsletterSchema = z.object({
  email: emailSchema,
  source: z.string().max(100).default("unknown"),
});

export const wishlistAddSchema = z.object({
  generation_id: uuidSchema,
  notes: z.string().max(500).optional(),
});

export const saveComparisonSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  generation_ids: z.array(uuidSchema).min(2).max(5),
});

export const saveSearchSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  query: z.string().max(200),
  filters: z.record(z.string(), z.unknown()).default({}),
  result_count: z.coerce.number().int().min(0).default(0),
});

export const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).trim().optional(),
  preferences: z
    .object({
      budget_min: z.number().int().min(0).max(500000).optional(),
      budget_max: z.number().int().min(0).max(500000).optional(),
      fuel_types: z.array(z.string()).max(10).optional(),
      child_seats: z.number().int().min(0).max(5).optional(),
    })
    .optional(),
});

export const priceAlertSchema = z.object({
  generation_id: uuidSchema,
  max_price: z.number().int().min(1000).max(500000),
  km_max: z.number().int().min(0).max(500000).optional(),
  year_min: z.number().int().min(1990).max(2030).optional(),
});

export const priceAlertCreateSchema = z.object({
  generation_id: uuidSchema,
  target_price_eur: z.number().int().min(0).max(1000000).optional(),
  alert_type: z
    .enum(["price_drop", "new_listing", "auction"])
    .default("price_drop"),
});

export const wishlistBodySchema = z.object({
  generation_id: uuidSchema,
  notes: z.string().max(500).optional(),
  priority: z.coerce.number().int().min(0).max(10).default(0),
});

export const alainChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(5000),
      })
    )
    .min(1)
    .max(50),
  vehicleContext: z.string().max(500).optional(),
  stream: z.boolean().optional(),
  preferences: z
    .object({
      budget: z.object({ min: z.number(), max: z.number() }).optional(),
      fuelTypes: z.array(z.string()).max(5).optional(),
      childSeats: z.number().int().min(0).max(5).optional(),
      priorities: z.array(z.string()).max(10).optional(),
      usage: z.array(z.string()).max(5).optional(),
    })
    .optional(),
});

// ==============================
// VALIDATION HELPER
// ==============================

/** Parse request body with a Zod schema. Returns { ok, data } or { ok, error } */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: e.issues.map((i) => i.message).join(", ") };
    }
    return { ok: false, error: "Invalid request body" };
  }
}
