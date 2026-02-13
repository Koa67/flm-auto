import { createServerClient } from "@/lib/supabase-server";
import { ENGINE_RED_FLAGS } from "@/types/vehicle";

type ToolInput = Record<string, unknown>;

const CONFIDENCE_LABELS: Record<string, string> = {
  A: "vérifié",
  B: "fiable",
  C: "estimé",
  D: "inféré",
  E: "non fiable",
};

export async function executeTool(
  name: string,
  input: ToolInput
): Promise<string> {
  const db = createServerClient();

  try {
    switch (name) {
      case "search_vehicles": {
        const query = (input.query as string).trim();
        const limit = (input.limit as number) || 5;

        // Search generations by internal_code or chassis_code first
        const { data: directGens } = await db
          .from("generations")
          .select(
            "id, name, slug, internal_code, chassis_code, production_start, production_end, body_style, models!inner(name, slug, brands!inner(name, slug))"
          )
          .or(
            `internal_code.ilike.%${query}%,chassis_code.ilike.%${query}%,name.ilike.%${query}%`
          )
          .limit(limit);

        if (directGens && directGens.length > 0) {
          return JSON.stringify(
            directGens.map((g: any) => ({
              generation_id: g.id,
              brand: g.models?.brands?.name,
              model: g.models?.name,
              generation: g.internal_code || g.name,
              chassis_code: g.chassis_code,
              years: `${g.production_start ? new Date(g.production_start).getFullYear() : "?"}-${g.production_end ? new Date(g.production_end).getFullYear() : "..."}`,
              body_style: g.body_style,
              url: `/marques/${g.models?.brands?.slug}/${g.models?.slug}/${g.slug}`,
            }))
          );
        }

        // Fallback: search brands then models
        const { data: brands } = await db
          .from("brands")
          .select("id, name, slug")
          .ilike("name", `%${query}%`)
          .limit(3);

        if (brands && brands.length > 0) {
          const brandIds = brands.map((b: any) => b.id);
          const { data: models } = await db
            .from("models")
            .select(
              "id, name, slug, brand_id, brands!inner(name, slug), generations(id, name, slug, internal_code, production_start)"
            )
            .in("brand_id", brandIds)
            .limit(limit);

          if (models && models.length > 0) {
            return JSON.stringify(
              models.map((m: any) => ({
                brand: m.brands?.name,
                model: m.name,
                generations: (m.generations || []).map((g: any) => ({
                  id: g.id,
                  name: g.internal_code || g.name,
                  year: g.production_start
                    ? new Date(g.production_start).getFullYear()
                    : null,
                })),
                url: `/marques/${m.brands?.slug}/${m.slug}`,
              }))
            );
          }
        }

        // Last fallback: search models by name
        const { data: modelsByName } = await db
          .from("models")
          .select(
            "id, name, slug, brands!inner(name, slug), generations(id, name, slug, internal_code, production_start)"
          )
          .ilike("name", `%${query}%`)
          .limit(limit);

        if (modelsByName && modelsByName.length > 0) {
          return JSON.stringify(
            modelsByName.map((m: any) => ({
              brand: m.brands?.name,
              model: m.name,
              generations: (m.generations || []).map((g: any) => ({
                id: g.id,
                name: g.internal_code || g.name,
                year: g.production_start
                  ? new Date(g.production_start).getFullYear()
                  : null,
              })),
              url: `/marques/${m.brands?.slug}/${m.slug}`,
            }))
          );
        }

        return JSON.stringify({ results: [], message: "Aucun véhicule trouvé" });
      }

      case "get_vehicle_details": {
        const genId = input.generation_id as string;

        const [
          { data: gen },
          { data: variants },
          { data: safety },
          { data: pricing },
          { data: dims },
        ] = await Promise.all([
          db
            .from("generations")
            .select(
              "*, models!inner(name, slug, brands!inner(name, slug))"
            )
            .eq("id", genId)
            .single(),
          db
            .from("engine_variants")
            .select("*, powertrain_specs(*), performance_specs(*)")
            .eq("generation_id", genId)
            .limit(20),
          db
            .from("safety_ratings")
            .select("*")
            .eq("generation_id", genId)
            .limit(1),
          db
            .from("vehicle_pricing")
            .select("*")
            .eq("generation_id", genId)
            .limit(1),
          db
            .from("interior_dimensions")
            .select("*")
            .eq("generation_id", genId)
            .limit(1),
        ]);

        if (!gen) return JSON.stringify({ error: "Génération non trouvée" });

        const formattedVariants = (variants || []).map((v: any) => {
          const pt = Array.isArray(v.powertrain_specs)
            ? v.powertrain_specs[0]
            : v.powertrain_specs;
          const perf = Array.isArray(v.performance_specs)
            ? v.performance_specs[0]
            : v.performance_specs;
          return {
            name: v.name?.replace(/Specs$/, "").trim() || v.badge,
            fuel_type: v.fuel_type,
            engine_code: v.engine_code,
            power_hp: pt?.power_hp,
            torque_nm: pt?.torque_nm,
            acceleration_0_100: perf?.acceleration_0_100_kmh,
            top_speed_kmh: perf?.top_speed_kmh,
            transmission: pt?.transmission_type,
            drivetrain: pt?.drivetrain,
          };
        });

        const safetyData = safety?.[0];
        const dimsData = dims?.[0];

        return JSON.stringify({
          brand: gen.models?.brands?.name,
          model: gen.models?.name,
          generation: gen.internal_code || gen.name,
          years: `${gen.production_start ? new Date(gen.production_start).getFullYear() : "?"}-${gen.production_end ? new Date(gen.production_end).getFullYear() : "..."}`,
          body_style: gen.body_style,
          motorisations: formattedVariants,
          safety: safetyData
            ? {
                stars: safetyData.stars,
                confidence: CONFIDENCE_LABELS[safetyData.confidence] || safetyData.confidence,
                year: safetyData.test_year,
                adult_pct: safetyData.adult_occupant_pct,
                child_pct: safetyData.child_occupant_pct,
                pedestrian_pct: safetyData.pedestrian_pct,
                assist_pct: safetyData.safety_assist_pct,
              }
            : null,
          pricing: pricing?.[0]
            ? {
                co2_gkm: pricing[0].co2_gkm,
                malus_2025: pricing[0].malus_2025_eur,
              }
            : null,
          dimensions: dimsData
            ? {
                trunk_liters: dimsData.trunk_volume_liters,
                trunk_max_liters: dimsData.trunk_volume_max_liters,
                seating_capacity: dimsData.seating_capacity,
                confidence: CONFIDENCE_LABELS[dimsData.confidence] || dimsData.confidence,
              }
            : null,
          url: `/marques/${gen.models?.brands?.slug}/${gen.models?.slug}/${gen.slug}`,
        });
      }

      case "check_engine_warnings": {
        const code = (input.engine_code as string).toUpperCase().trim();

        const matched: Array<{
          engine: string;
          severity: string;
          title: string;
          description: string;
          symptoms: string[];
          years: string;
          repair_cost: string;
        }> = [];

        for (const [, flag] of Object.entries(ENGINE_RED_FLAGS)) {
          if (flag.patterns.some((p) => code.includes(p.toUpperCase()))) {
            matched.push({
              engine: `${flag.brand} — ${flag.engine_family}`,
              severity: flag.severity,
              title: flag.title_fr,
              description: flag.description_fr,
              symptoms: flag.symptoms_fr,
              years: flag.affected_years || "Non précisé",
              repair_cost: flag.repair_cost_range || "Non précisé",
            });
          }
        }

        if (matched.length === 0) {
          return JSON.stringify({
            engine_code: code,
            warnings: [],
            message: "Aucun problème connu pour ce moteur dans notre base.",
          });
        }

        return JSON.stringify({
          engine_code: code,
          warnings: matched,
        });
      }

      case "compare_vehicles": {
        const idA = input.generation_id_a as string;
        const idB = input.generation_id_b as string;

        const fetchVehicle = async (genId: string) => {
          const [{ data: gen }, { data: variants }, { data: safety }, { data: dims }] =
            await Promise.all([
              db
                .from("generations")
                .select("*, models!inner(name, brands!inner(name))")
                .eq("id", genId)
                .single(),
              db
                .from("engine_variants")
                .select("*, powertrain_specs(*), performance_specs(*)")
                .eq("generation_id", genId)
                .limit(10),
              db
                .from("safety_ratings")
                .select("stars, adult_occupant_pct, child_occupant_pct, confidence")
                .eq("generation_id", genId)
                .limit(1),
              db
                .from("interior_dimensions")
                .select("trunk_volume_liters, trunk_volume_max_liters, seating_capacity, confidence")
                .eq("generation_id", genId)
                .limit(1),
            ]);

          if (!gen) return null;

          const topVariant = (variants || [])
            .map((v: any) => {
              const pt = Array.isArray(v.powertrain_specs)
                ? v.powertrain_specs[0]
                : v.powertrain_specs;
              const perf = Array.isArray(v.performance_specs)
                ? v.performance_specs[0]
                : v.performance_specs;
              return {
                name: v.name?.replace(/Specs$/, "").trim(),
                power_hp: pt?.power_hp,
                torque_nm: pt?.torque_nm,
                acceleration_0_100: perf?.acceleration_0_100_kmh,
                top_speed_kmh: perf?.top_speed_kmh,
              };
            })
            .sort((a: any, b: any) => (b.power_hp || 0) - (a.power_hp || 0))[0];

          return {
            name: `${gen.models?.brands?.name} ${gen.models?.name} ${gen.internal_code || gen.name}`,
            body_style: gen.body_style,
            motorisations_count: (variants || []).length,
            top_variant: topVariant || null,
            safety_stars: safety?.[0]?.stars ?? null,
            safety_confidence: CONFIDENCE_LABELS[safety?.[0]?.confidence] || null,
            trunk_liters: dims?.[0]?.trunk_volume_liters ?? null,
            trunk_max_liters: dims?.[0]?.trunk_volume_max_liters ?? null,
            seating: dims?.[0]?.seating_capacity ?? null,
          };
        };

        const [a, b] = await Promise.all([fetchVehicle(idA), fetchVehicle(idB)]);

        if (!a || !b) {
          return JSON.stringify({
            error: "Un ou les deux véhicules n'ont pas été trouvés",
          });
        }

        return JSON.stringify({ vehicle_a: a, vehicle_b: b });
      }

      case "check_family_fit": {
        const genId = input.generation_id as string;

        const [{ data: familyFit }, { data: seatCompat }] = await Promise.all([
          db
            .from("family_fit_compatibility")
            .select("*")
            .eq("generation_id", genId)
            .limit(1),
          db
            .from("child_seat_vehicle_compatibility")
            .select("*, child_seats(*)")
            .eq("generation_id", genId)
            .limit(20),
        ]);

        const fit = familyFit?.[0];
        return JSON.stringify({
          family_fit: fit
            ? {
                isofix_points: fit.isofix_points,
                three_across_possible: fit.three_across_possible,
                rear_bench_width_mm: fit.rear_bench_width_usable_mm,
                family_fit_score: fit.family_fit_score,
                confidence: CONFIDENCE_LABELS[fit.confidence] || fit.confidence,
              }
            : null,
          compatible_seats_count: (seatCompat || []).length,
          sample_seats: (seatCompat || []).slice(0, 5).map((s: any) => ({
            seat: `${s.child_seats?.brand} ${s.child_seats?.model}`,
            position: s.position,
            compatible: s.is_compatible,
          })),
        });
      }

      case "get_cargo_info": {
        const genId = input.generation_id as string;

        const { data: dims } = await db
          .from("interior_dimensions")
          .select("*")
          .eq("generation_id", genId)
          .limit(1);

        if (!dims || dims.length === 0) {
          return JSON.stringify({ error: "Pas de données coffre pour ce véhicule" });
        }

        const d = dims[0];
        return JSON.stringify({
          trunk_volume_liters: d.trunk_volume_liters,
          trunk_volume_max_liters: d.trunk_volume_max_liters,
          frunk_volume_liters: d.frunk_volume_liters,
          fuel_tank_liters: d.fuel_tank_liters,
          seating_capacity: d.seating_capacity,
        });
      }

      case "get_recalls": {
        const genId = input.generation_id as string;

        const { data } = await db
          .from("vehicle_recalls")
          .select("*")
          .eq("generation_id", genId)
          .order("recall_date", { ascending: false })
          .limit(10);

        return JSON.stringify({
          count: data?.length || 0,
          recalls: (data || []).map((r: any) => ({
            date: r.recall_date,
            component: r.component,
            summary: r.issue_summary,
            remedy: r.remedy,
            risk: r.risk_level,
            source: r.source_url,
          })),
        });
      }

      case "get_photos": {
        const genId = input.generation_id as string;
        const photoLimit = (input.limit as number) || 5;

        const { data } = await db
          .from("vehicle_images")
          .select("url, image_type, source, width, confidence")
          .eq("generation_id", genId)
          .neq("confidence", "E")
          .order("width", { ascending: false, nullsFirst: false })
          .limit(photoLimit);

        return JSON.stringify({
          count: data?.length || 0,
          photos: (data || []).map((p: any) => ({
            url: p.url,
            type: p.image_type,
            width: p.width,
          })),
        });
      }

      case "search_and_detail": {
        // Combo: search → pick first result → get full details
        const searchQuery = (input.query as string).trim();
        const searchResult = await executeTool("search_vehicles", { query: searchQuery, limit: 1 });
        const parsed = JSON.parse(searchResult);

        // Find the generation_id from the search result
        let genId: string | null = null;
        if (Array.isArray(parsed) && parsed.length > 0) {
          genId = parsed[0].generation_id || null;
          // If search returned models with generations array
          if (!genId && parsed[0].generations?.length > 0) {
            genId = parsed[0].generations[0].id;
          }
        }

        if (!genId) {
          return JSON.stringify({ search_query: searchQuery, results: [], message: "Aucun véhicule trouvé" });
        }

        const details = await executeTool("get_vehicle_details", { generation_id: genId });
        return details;
      }

      case "rag_search": {
        const query = (input.query as string).trim();
        const ragLimit = Math.min((input.limit as number) || 5, 10);

        const voyageKey = process.env.VOYAGE_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;

        if (!voyageKey && !openaiKey) {
          // Silent fallback to search_vehicles
          return executeTool("search_vehicles", { query, limit: ragLimit });
        }

        try {
          let embedding: number[];

          if (voyageKey) {
            const res = await fetch("https://api.voyageai.com/v1/embeddings", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${voyageKey}`,
              },
              body: JSON.stringify({
                model: "voyage-3-lite",
                input: [query],
                input_type: "query",
              }),
            });
            if (!res.ok) throw new Error(`Voyage API ${res.status}`);
            const data = await res.json();
            embedding = data.data[0].embedding;
          } else {
            const res = await fetch("https://api.openai.com/v1/embeddings", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: "text-embedding-3-small",
                input: [query],
                dimensions: 1024,
              }),
            });
            if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
            const data = await res.json();
            embedding = data.data[0].embedding;
          }

          const { data: results, error } = await db.rpc("match_rag_documents", {
            query_embedding: JSON.stringify(embedding),
            match_threshold: 0.5,
            match_count: ragLimit,
          });

          if (error) {
            return JSON.stringify({ error: `Erreur recherche RAG: ${error.message}` });
          }

          if (!results || results.length === 0) {
            return JSON.stringify({
              query,
              results: [],
              message: "Aucun résultat trouvé pour cette recherche sémantique.",
            });
          }

          return JSON.stringify({
            query,
            results: results.map((r: any) => ({
              content: r.content,
              similarity: Math.round(r.similarity * 100) / 100,
              generation_id: r.generation_id,
              type: r.content_type,
            })),
          });
        } catch {
          // Silent fallback to search_vehicles on any error
          return executeTool("search_vehicles", { query, limit: ragLimit });
        }
      }

      default:
        return JSON.stringify({ error: `Outil inconnu: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `Erreur outil ${name}: ${err.message}` });
  }
}
