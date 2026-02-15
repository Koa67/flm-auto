import { NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";

export const revalidate = 300; // 5 minutes

interface RecommendQuery {
  budget_min?: number;
  budget_max?: number;
  usage?: string;
  family_size?: number;
  child_seats_needed?: number;
  fuel_preference?: string;
  priorities?: string[];
}

export async function POST(request: Request) {
  try {
    const body: RecommendQuery = await request.json();
    const db = createStaticClient();

    // Build query for generations with related data
    const query = db
      .from("generations")
      .select(
        `id, name, internal_code, slug, body_style, production_start, production_end,
         models!inner(name, slug, brands!inner(name, slug)),
         engine_variants(name, fuel_type, powertrain_specs(power_hp)),
         safety_ratings(stars, adult_occupant_pct),
         interior_dimensions(trunk_volume_liters, trunk_volume_max_liters, seating_capacity),
         family_fit_compatibility(isofix_points, three_across_possible),
         vehicle_images(url)`
      )
      .not("production_start", "is", null)
      .order("production_start", { ascending: false })
      .limit(200);

    // Filter by fuel type
    if (body.fuel_preference && body.fuel_preference !== "any") {
      const fuelMap: Record<string, string[]> = {
        essence: ["petrol", "gasoline", "essence"],
        diesel: ["diesel"],
        electrique: ["electric", "bev"],
        hybride: ["hybrid", "phev", "hev", "mild-hybrid"],
      };
      // We'll filter in post-processing since fuel_type is on engine_variants
    }

    const { data: generations, error } = await query;

    if (error) {
      console.error("Recommend query error:", error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    if (!generations || generations.length === 0) {
      return NextResponse.json({ recommendations: [], total: 0 });
    }

    // Score and rank each generation
    const scored = generations
      .map((gen: any) => {
        let score = 50; // Base score
        const reasons: string[] = [];

        const brand = gen.models?.brands?.name || "";
        const model = gen.models?.name || "";
        const genName = gen.internal_code || gen.name || "";

        // Fuel filter
        if (body.fuel_preference && body.fuel_preference !== "any") {
          const variants = gen.engine_variants || [];
          const fuelMap: Record<string, string[]> = {
            essence: ["petrol", "gasoline", "essence"],
            diesel: ["diesel"],
            electrique: ["electric", "bev"],
            hybride: ["hybrid", "phev", "hev", "mild-hybrid"],
          };
          const targetFuels = fuelMap[body.fuel_preference] || [];
          const hasFuel = variants.some((v: any) =>
            targetFuels.some(
              (f) =>
                v.fuel_type?.toLowerCase().includes(f)
            )
          );
          if (!hasFuel) return null; // Exclude
          score += 10;
        }

        // Safety priority
        if (body.priorities?.includes("safety")) {
          const safety = gen.safety_ratings?.[0];
          if (safety?.stars >= 5) {
            score += 25;
            reasons.push("5 étoiles Euro NCAP");
          } else if (safety?.stars >= 4) {
            score += 15;
            reasons.push(`${safety.stars} étoiles NCAP`);
          }
        }

        // Space priority
        if (body.priorities?.includes("space")) {
          const dims = gen.interior_dimensions?.[0];
          if (dims?.trunk_volume_liters > 500) {
            score += 20;
            reasons.push(`Grand coffre (${dims.trunk_volume_liters}L)`);
          } else if (dims?.trunk_volume_liters > 400) {
            score += 10;
          }
          if (dims?.seating_capacity >= 7) {
            score += 15;
            reasons.push("7 places");
          }
        }

        // Family needs
        if (body.child_seats_needed && body.child_seats_needed > 0) {
          const ff = gen.family_fit_compatibility?.[0];
          if (ff?.isofix_points >= body.child_seats_needed * 2) {
            score += 15;
            reasons.push(`${ff.isofix_points} points ISOFIX`);
          }
          if (body.child_seats_needed >= 3 && ff?.three_across_possible) {
            score += 20;
            reasons.push("3 sièges auto possible");
          }
        }

        // Family size → seating
        if (body.family_size && body.family_size > 4) {
          const seats =
            gen.interior_dimensions?.[0]?.seating_capacity || 5;
          if (seats >= body.family_size + 1) {
            score += 10;
            reasons.push(`${seats} places`);
          }
        }

        // Reliability priority
        if (body.priorities?.includes("reliability")) {
          const reliableBrands = [
            "Toyota",
            "Lexus",
            "Mazda",
            "Honda",
            "Suzuki",
          ];
          if (reliableBrands.some((b) => brand.includes(b))) {
            score += 20;
            reasons.push("Marque réputée fiable");
          }
        }

        // Performance priority
        if (body.priorities?.includes("performance")) {
          const topPower = Math.max(
            ...(gen.engine_variants || []).map(
              (v: any) => v.powertrain_specs?.[0]?.power_hp || 0
            ),
            0
          );
          if (topPower > 200) {
            score += 15;
            reasons.push(`Jusqu'à ${topPower} ch`);
          }
        }

        // Recency bonus (newer = better)
        if (gen.production_start) {
          const year = new Date(gen.production_start).getFullYear();
          if (year >= 2023) score += 10;
          else if (year >= 2020) score += 5;
        }

        const image =
          gen.vehicle_images?.[0]?.url || null;

        return {
          generation_id: gen.id,
          brand,
          model,
          generation: genName,
          body_style: gen.body_style,
          slug: `/marques/${gen.models?.brands?.slug}/${gen.models?.slug}/${gen.slug}`,
          image,
          score,
          reasons,
          stars: gen.safety_ratings?.[0]?.stars || null,
          trunk_liters:
            gen.interior_dimensions?.[0]?.trunk_volume_liters || null,
          seats:
            gen.interior_dimensions?.[0]?.seating_capacity || null,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 10);

    return NextResponse.json({
      recommendations: scored,
      total: scored.length,
      profile_summary: {
        budget: `${body.budget_min?.toLocaleString()}-${body.budget_max?.toLocaleString()} €`,
        fuel: body.fuel_preference,
        priorities: body.priorities,
      },
    });
  } catch (err) {
    console.error("Recommend POST error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
