import { createServerClient } from "@/lib/supabase-server";

export async function getGenerationBySlug(
  brandSlug: string,
  modelSlug: string,
  genSlug: string
) {
  const db = createServerClient();

  const { data: brand } = await db
    .from("brands")
    .select("id, name, slug")
    .eq("slug", brandSlug)
    .single();
  if (!brand) return null;

  const { data: models } = await db
    .from("models")
    .select("id, name, slug, segment")
    .eq("brand_id", brand.id)
    .eq("slug", modelSlug);
  const model = models?.[0];
  if (!model) return null;

  const { data: gens } = await db
    .from("generations")
    .select("*")
    .eq("model_id", model.id)
    .eq("slug", genSlug);
  const generation = gens?.[0];
  if (!generation) return null;

  return { brand, model, generation };
}

export function getYear(d: string | null) {
  return d ? new Date(d).getFullYear() : null;
}

export function genLabel(generation: any) {
  return generation.internal_code || generation.name;
}
