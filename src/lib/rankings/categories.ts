// src/lib/rankings/categories.ts
// Centralized ranking categories for /meilleur/ pages

export interface RankingCategory {
  slug: string;
  title: string;
  h1: string;
  description: string;
  icon: string; // lucide icon name
  group: string;
  query: (db: any) => Promise<{ generation_id: string; [k: string]: any }[]>;
}

export const RANKING_GROUPS = [
  { key: "famille", label: "Famille" },
  { key: "securite", label: "Sécurité" },
  { key: "performance", label: "Performance" },
  { key: "coffre", label: "Coffre & Espace" },
  { key: "segment", label: "Par segment" },
  { key: "divers", label: "Classements spéciaux" },
] as const;

/** Dedup rows by generation_id, keeping the one with the highest value for `field` */
function dedupMax(rows: any[], field: string): any[] {
  const map = new Map<string, any>();
  for (const r of rows) {
    const ex = map.get(r.generation_id);
    if (!ex || (r[field] != null && (ex[field] == null || r[field] > ex[field]))) {
      map.set(r.generation_id, r);
    }
  }
  return Array.from(map.values());
}

/** Dedup rows by generation_id, keeping the one with the lowest value for `field` */
function dedupMin(rows: any[], field: string): any[] {
  const map = new Map<string, any>();
  for (const r of rows) {
    const ex = map.get(r.generation_id);
    if (!ex || (r[field] != null && (ex[field] == null || r[field] < ex[field]))) {
      map.set(r.generation_id, r);
    }
  }
  return Array.from(map.values());
}

/** Dedup rows by generation_id, keeping the first occurrence */
function dedupFirst(rows: any[]): any[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.generation_id)) return false;
    seen.add(r.generation_id);
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════

export const RANKING_CATEGORIES: RankingCategory[] = [
  // ── FAMILLE (7) ──────────────────────────────────────────────────
  {
    slug: "meilleur-suv-familial-2025",
    title: "Meilleur SUV familial 2025",
    h1: "Les meilleurs SUV familiaux en 2025",
    description:
      "Classement des meilleurs SUV familiaux basé sur notre score Family Fit, le nombre de points ISOFIX et la sécurité Euro NCAP.",
    icon: "Baby",
    group: "famille",
    query: async (db) => {
      const { data } = await db
        .from("family_fit_compatibility")
        .select(
          "generation_id, family_fit_score, isofix_points, three_across_possible"
        )
        .gte("isofix_points", 2)
        .order("family_fit_score", { ascending: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "meilleur-break-familial-2025",
    title: "Meilleur break familial 2025",
    h1: "Les meilleurs breaks familiaux en 2025",
    description:
      "Top des véhicules avec le plus grand coffre pour les familles. Classement par volume de coffre.",
    icon: "Package",
    group: "famille",
    query: async (db) => {
      const { data } = await db
        .from("interior_dimensions")
        .select("generation_id, trunk_volume_liters, trunk_volume_max_liters")
        .gt("trunk_volume_liters", 500)
        .order("trunk_volume_liters", { ascending: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "meilleure-voiture-3-sieges-auto-2025",
    title: "Meilleures voitures pour 3 sièges auto 2025",
    h1: "Les meilleures voitures pour 3 sièges auto",
    description:
      "Quelles voitures permettent d'installer 3 sièges auto côte à côte ? Classement par largeur de banquette et compatibilité ISOFIX.",
    icon: "Baby",
    group: "famille",
    query: async (db) => {
      const { data } = await db
        .from("family_fit_compatibility")
        .select(
          "generation_id, family_fit_score, three_across_possible, isofix_points, rear_bench_width_usable_mm"
        )
        .eq("three_across_possible", true)
        .order("family_fit_score", { ascending: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "meilleur-monospace-2025",
    title: "Meilleur monospace 2025",
    h1: "Les meilleurs monospaces en 2025",
    description:
      "Classement des véhicules 6 places et plus : monospaces, vans et grands SUV familiaux triés par volume de coffre.",
    icon: "Users",
    group: "famille",
    query: async (db) => {
      const { data } = await db
        .from("interior_dimensions")
        .select(
          "generation_id, seating_capacity, trunk_volume_liters, trunk_volume_max_liters"
        )
        .gte("seating_capacity", 6)
        .order("trunk_volume_liters", { ascending: false, nullsFirst: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "meilleure-voiture-7-places-2025",
    title: "Meilleure voiture 7 places 2025",
    h1: "Les meilleures voitures 7 places en 2025",
    description:
      "Top des véhicules offrant 7 places ou plus : SUV, monospaces et vans triés par volume de coffre.",
    icon: "Users",
    group: "famille",
    query: async (db) => {
      const { data } = await db
        .from("interior_dimensions")
        .select(
          "generation_id, seating_capacity, trunk_volume_liters, trunk_volume_max_liters"
        )
        .gte("seating_capacity", 7)
        .order("trunk_volume_liters", { ascending: false, nullsFirst: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "meilleur-coffre-familial-2025",
    title: "Meilleur coffre familial 2025",
    h1: "Les voitures avec le plus grand coffre pour les familles",
    description:
      "Classement des véhicules avec plus de 400 litres de coffre, idéals pour les familles avec poussettes et bagages.",
    icon: "Package",
    group: "famille",
    query: async (db) => {
      const { data } = await db
        .from("interior_dimensions")
        .select("generation_id, trunk_volume_liters, trunk_volume_max_liters")
        .gt("trunk_volume_liters", 400)
        .order("trunk_volume_liters", { ascending: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "meilleure-voiture-isofix-3-points-2025",
    title: "Voitures avec 3 points ISOFIX 2025",
    h1: "Les voitures avec 3 points d'ancrage ISOFIX",
    description:
      "Liste des véhicules disposant de 3 points ISOFIX ou plus, essentiels pour les familles avec plusieurs enfants en bas âge.",
    icon: "Anchor",
    group: "famille",
    query: async (db) => {
      const { data } = await db
        .from("family_fit_compatibility")
        .select(
          "generation_id, isofix_points, family_fit_score, three_across_possible"
        )
        .gte("isofix_points", 3)
        .order("family_fit_score", { ascending: false })
        .limit(30);
      return data || [];
    },
  },

  // ── SÉCURITÉ (5) ─────────────────────────────────────────────────
  {
    slug: "voiture-5-etoiles-euroncap-2025",
    title: "Voitures 5 étoiles Euro NCAP 2025",
    h1: "Toutes les voitures 5 étoiles Euro NCAP",
    description:
      "Liste complète des véhicules ayant obtenu la note maximale de 5 étoiles aux crash-tests Euro NCAP. Données vérifiées uniquement.",
    icon: "Shield",
    group: "securite",
    query: async (db) => {
      const { data } = await db
        .from("safety_ratings")
        .select(
          "generation_id, stars, adult_occupant_pct, child_occupant_pct, test_year, confidence"
        )
        .eq("stars", 5)
        .in("confidence", ["A", "B"])
        .order("test_year", { ascending: false })
        .limit(30);
      return dedupFirst(data || []);
    },
  },
  {
    slug: "voiture-5-etoiles-euroncap-2024",
    title: "Voitures 5 étoiles Euro NCAP 2024",
    h1: "Les voitures 5 étoiles Euro NCAP testées avant 2025",
    description:
      "Tous les véhicules 5 étoiles Euro NCAP avec tests réalisés jusqu'en 2024. Résultats vérifiés.",
    icon: "Shield",
    group: "securite",
    query: async (db) => {
      const { data } = await db
        .from("safety_ratings")
        .select(
          "generation_id, stars, adult_occupant_pct, child_occupant_pct, test_year, confidence"
        )
        .eq("stars", 5)
        .lte("test_year", 2024)
        .in("confidence", ["A", "B"])
        .order("test_year", { ascending: false })
        .limit(30);
      return dedupFirst(data || []);
    },
  },
  {
    slug: "meilleure-securite-enfant-2025",
    title: "Meilleure sécurité enfant 2025",
    h1: "Les voitures les plus sûres pour les enfants",
    description:
      "Classement des véhicules par score de protection des enfants Euro NCAP. Données vérifiées (crash-tests officiels).",
    icon: "Baby",
    group: "securite",
    query: async (db) => {
      const { data } = await db
        .from("safety_ratings")
        .select(
          "generation_id, stars, child_occupant_pct, test_year, confidence"
        )
        .in("confidence", ["A", "B"])
        .gt("child_occupant_pct", 0)
        .order("child_occupant_pct", { ascending: false })
        .limit(30);
      return dedupFirst(data || []);
    },
  },
  {
    slug: "meilleure-aide-conduite-2025",
    title: "Meilleure aide à la conduite 2025",
    h1: "Les voitures avec la meilleure aide à la conduite",
    description:
      "Top des véhicules par score d'aide à la conduite Euro NCAP : freinage d'urgence, alerte de franchissement, régulateur adaptatif.",
    icon: "Cpu",
    group: "securite",
    query: async (db) => {
      const { data } = await db
        .from("safety_ratings")
        .select(
          "generation_id, stars, safety_assist_pct, test_year, confidence"
        )
        .in("confidence", ["A", "B"])
        .gt("safety_assist_pct", 0)
        .order("safety_assist_pct", { ascending: false })
        .limit(30);
      return dedupFirst(data || []);
    },
  },
  {
    slug: "meilleure-securite-pieton-2025",
    title: "Meilleure sécurité piéton 2025",
    h1: "Les voitures les plus sûres pour les piétons",
    description:
      "Classement des véhicules par score de protection des piétons et cyclistes Euro NCAP.",
    icon: "PersonStanding",
    group: "securite",
    query: async (db) => {
      const { data } = await db
        .from("safety_ratings")
        .select(
          "generation_id, stars, pedestrian_pct, test_year, confidence"
        )
        .in("confidence", ["A", "B"])
        .gt("pedestrian_pct", 0)
        .order("pedestrian_pct", { ascending: false })
        .limit(30);
      return dedupFirst(data || []);
    },
  },

  // ── PERFORMANCE (6) ──────────────────────────────────────────────
  {
    slug: "voiture-plus-rapide-0-100-2025",
    title: "Voiture la plus rapide 0-100 km/h 2025",
    h1: "Les voitures les plus rapides de 0 à 100 km/h",
    description:
      "Classement des véhicules par temps d'accélération de 0 à 100 km/h. Du plus rapide au plus lent.",
    icon: "Timer",
    group: "performance",
    query: async (db) => {
      const { data } = await db
        .from("engine_variants")
        .select(
          "generation_id, performance_specs!inner(acceleration_0_100_kmh)"
        )
        .gt("performance_specs.acceleration_0_100_kmh", 0)
        .order("performance_specs(acceleration_0_100_kmh)", {
          ascending: true,
        })
        .limit(100);
      const flat = (data || []).map((d: any) => ({
        generation_id: d.generation_id,
        acceleration: d.performance_specs?.acceleration_0_100_kmh,
      }));
      return dedupMin(flat, "acceleration").slice(0, 30);
    },
  },
  {
    slug: "berline-sportive-2025",
    title: "Meilleure berline sportive 2025",
    h1: "Les meilleures berlines sportives en 2025",
    description:
      "Top des berlines sportives avec plus de 300 chevaux : puissance, performances et tenue de route.",
    icon: "Gauge",
    group: "performance",
    query: async (db) => {
      const { data } = await db
        .from("engine_variants")
        .select("generation_id, powertrain_specs!inner(power_hp)")
        .gte("powertrain_specs.power_hp", 300)
        .order("powertrain_specs(power_hp)", { ascending: false })
        .limit(100);
      const flat = (data || []).map((d: any) => ({
        generation_id: d.generation_id,
        power_hp: d.powertrain_specs?.power_hp,
      }));
      return dedupMax(flat, "power_hp").slice(0, 30);
    },
  },
  {
    slug: "suv-sportif-2025",
    title: "Meilleur SUV sportif 2025",
    h1: "Les meilleurs SUV sportifs en 2025",
    description:
      "Les SUV les plus puissants avec au moins 250 chevaux sous le capot. Performance et polyvalence.",
    icon: "Gauge",
    group: "performance",
    query: async (db) => {
      // 2-step: get SUV gen IDs, then filter by power
      const { data: suvGens } = await db
        .from("generations")
        .select("id")
        .ilike("body_style", "%suv%");
      if (!suvGens || suvGens.length === 0) {
        // Fallback: return all high-power vehicles
        const { data } = await db
          .from("engine_variants")
          .select("generation_id, powertrain_specs!inner(power_hp)")
          .gte("powertrain_specs.power_hp", 300)
          .order("powertrain_specs(power_hp)", { ascending: false })
          .limit(60);
        const flat = (data || []).map((d: any) => ({
          generation_id: d.generation_id,
          power_hp: d.powertrain_specs?.power_hp,
        }));
        return dedupMax(flat, "power_hp").slice(0, 30);
      }
      const genIds = suvGens.map((g: any) => g.id);
      const { data } = await db
        .from("engine_variants")
        .select("generation_id, powertrain_specs!inner(power_hp)")
        .in("generation_id", genIds)
        .gte("powertrain_specs.power_hp", 250)
        .order("powertrain_specs(power_hp)", { ascending: false })
        .limit(60);
      const flat = (data || []).map((d: any) => ({
        generation_id: d.generation_id,
        power_hp: d.powertrain_specs?.power_hp,
      }));
      return dedupMax(flat, "power_hp").slice(0, 30);
    },
  },
  {
    slug: "voiture-plus-puissante-2025",
    title: "Voiture la plus puissante 2025",
    h1: "Les voitures les plus puissantes en 2025",
    description:
      "Classement des véhicules par puissance maximale en chevaux. Les monstres de puissance du marché.",
    icon: "Zap",
    group: "performance",
    query: async (db) => {
      const { data } = await db
        .from("engine_variants")
        .select("generation_id, powertrain_specs!inner(power_hp)")
        .gt("powertrain_specs.power_hp", 0)
        .order("powertrain_specs(power_hp)", { ascending: false })
        .limit(100);
      const flat = (data || []).map((d: any) => ({
        generation_id: d.generation_id,
        power_hp: d.powertrain_specs?.power_hp,
      }));
      return dedupMax(flat, "power_hp").slice(0, 30);
    },
  },
  {
    slug: "voiture-plus-couple-2025",
    title: "Voiture avec le plus de couple 2025",
    h1: "Les voitures avec le plus de couple moteur",
    description:
      "Classement par couple maximal en Nm. Le couple détermine les reprises et la sensation de poussée au démarrage.",
    icon: "RotateCcw",
    group: "performance",
    query: async (db) => {
      const { data } = await db
        .from("engine_variants")
        .select("generation_id, powertrain_specs!inner(torque_nm)")
        .gt("powertrain_specs.torque_nm", 0)
        .order("powertrain_specs(torque_nm)", { ascending: false })
        .limit(100);
      const flat = (data || []).map((d: any) => ({
        generation_id: d.generation_id,
        torque_nm: d.powertrain_specs?.torque_nm,
      }));
      return dedupMax(flat, "torque_nm").slice(0, 30);
    },
  },
  {
    slug: "voiture-plus-rapide-vitesse-max-2025",
    title: "Voiture avec la plus haute vitesse max 2025",
    h1: "Les voitures avec la plus haute vitesse maximale",
    description:
      "Classement par vitesse de pointe en km/h. Des supercars aux berlines autobahn-ready.",
    icon: "Gauge",
    group: "performance",
    query: async (db) => {
      const { data } = await db
        .from("engine_variants")
        .select(
          "generation_id, performance_specs!inner(top_speed_kmh)"
        )
        .gt("performance_specs.top_speed_kmh", 0)
        .order("performance_specs(top_speed_kmh)", { ascending: false })
        .limit(100);
      const flat = (data || []).map((d: any) => ({
        generation_id: d.generation_id,
        top_speed: d.performance_specs?.top_speed_kmh,
      }));
      return dedupMax(flat, "top_speed").slice(0, 30);
    },
  },

  // ── COFFRE & ESPACE (4) ──────────────────────────────────────────
  {
    slug: "voiture-plus-grand-coffre-2025",
    title: "Voiture avec le plus grand coffre 2025",
    h1: "Les voitures avec le plus grand coffre",
    description:
      "Classement par volume de coffre en litres. Du plus grand au plus petit.",
    icon: "Package",
    group: "coffre",
    query: async (db) => {
      const { data } = await db
        .from("interior_dimensions")
        .select("generation_id, trunk_volume_liters, trunk_volume_max_liters")
        .gt("trunk_volume_liters", 0)
        .order("trunk_volume_liters", { ascending: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "voiture-coffre-500-litres-2025",
    title: "Voitures avec un coffre de 500 litres ou plus 2025",
    h1: "Les voitures avec au moins 500 litres de coffre",
    description:
      "Toutes les voitures offrant 500 litres de coffre ou plus. Idéal pour les longs trajets et les familles.",
    icon: "Package",
    group: "coffre",
    query: async (db) => {
      const { data } = await db
        .from("interior_dimensions")
        .select("generation_id, trunk_volume_liters, trunk_volume_max_liters")
        .gte("trunk_volume_liters", 500)
        .order("trunk_volume_liters", { ascending: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "voiture-plus-grand-coffre-rabattu-2025",
    title: "Plus grand coffre sièges rabattus 2025",
    h1: "Les voitures avec le plus grand coffre sièges rabattus",
    description:
      "Classement par volume de coffre maximal (sièges arrière rabattus). Pour les déménagements et le transport de gros objets.",
    icon: "Maximize",
    group: "coffre",
    query: async (db) => {
      const { data } = await db
        .from("interior_dimensions")
        .select("generation_id, trunk_volume_liters, trunk_volume_max_liters")
        .gt("trunk_volume_max_liters", 0)
        .order("trunk_volume_max_liters", { ascending: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "voiture-grand-coffre-5-places-2025",
    title: "Voiture 5 places avec grand coffre 2025",
    h1: "Les meilleures voitures 5 places avec un grand coffre",
    description:
      "Classement des voitures 5 places par volume de coffre. Le compromis idéal entre habitabilité et chargement.",
    icon: "Package",
    group: "coffre",
    query: async (db) => {
      const { data } = await db
        .from("interior_dimensions")
        .select(
          "generation_id, trunk_volume_liters, seating_capacity, trunk_volume_max_liters"
        )
        .lte("seating_capacity", 5)
        .gt("trunk_volume_liters", 0)
        .order("trunk_volume_liters", { ascending: false })
        .limit(30);
      return data || [];
    },
  },

  // ── PAR SEGMENT (5) ──────────────────────────────────────────────
  {
    slug: "meilleur-suv-2025",
    title: "Meilleur SUV 2025",
    h1: "Les meilleurs SUV en 2025",
    description:
      "Classement des SUV par note de sécurité Euro NCAP. Les SUV les plus sûrs du marché.",
    icon: "Car",
    group: "segment",
    query: async (db) => {
      const { data } = await db
        .from("generations")
        .select("id, body_style")
        .ilike("body_style", "%suv%")
        .order("production_start", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(30);
      return (data || []).map((g: any) => ({ generation_id: g.id }));
    },
  },
  {
    slug: "meilleure-berline-2025",
    title: "Meilleure berline 2025",
    h1: "Les meilleures berlines en 2025",
    description:
      "Classement des berlines (sedans) les plus récentes. Confort, espace et technologie.",
    icon: "Car",
    group: "segment",
    query: async (db) => {
      const { data } = await db
        .from("generations")
        .select("id, body_style")
        .ilike("body_style", "%sedan%")
        .order("production_start", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(30);
      return (data || []).map((g: any) => ({ generation_id: g.id }));
    },
  },
  {
    slug: "meilleure-citadine-2025",
    title: "Meilleure citadine 2025",
    h1: "Les meilleures citadines en 2025",
    description:
      "Classement des citadines (hatchbacks) : compactes, maniables et économiques pour la ville.",
    icon: "Car",
    group: "segment",
    query: async (db) => {
      const { data } = await db
        .from("generations")
        .select("id, body_style")
        .ilike("body_style", "%hatchback%")
        .order("production_start", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(30);
      return (data || []).map((g: any) => ({ generation_id: g.id }));
    },
  },
  {
    slug: "meilleur-coupe-2025",
    title: "Meilleur coupé 2025",
    h1: "Les meilleurs coupés en 2025",
    description:
      "Classement des coupés les plus récents : design, sportivité et élégance.",
    icon: "Car",
    group: "segment",
    query: async (db) => {
      const { data } = await db
        .from("generations")
        .select("id, body_style")
        .ilike("body_style", "%coupe%")
        .order("production_start", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(30);
      return (data || []).map((g: any) => ({ generation_id: g.id }));
    },
  },
  {
    slug: "meilleur-break-2025",
    title: "Meilleur break 2025",
    h1: "Les meilleurs breaks en 2025",
    description:
      "Classement des breaks (wagons, Touring, Avant, SW) : espace de chargement et polyvalence familiale.",
    icon: "Car",
    group: "segment",
    query: async (db) => {
      const { data } = await db
        .from("generations")
        .select("id, body_style")
        .or(
          "body_style.ilike.%wagon%,body_style.ilike.%estate%,body_style.ilike.%touring%,body_style.ilike.%break%"
        )
        .order("production_start", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(30);
      // Fallback: if no results from body_style, use large-trunk vehicles
      if (!data || data.length === 0) {
        const { data: fallback } = await db
          .from("interior_dimensions")
          .select("generation_id, trunk_volume_liters")
          .gt("trunk_volume_liters", 550)
          .order("trunk_volume_liters", { ascending: false })
          .limit(30);
        return (fallback || []).map((d: any) => ({
          generation_id: d.generation_id,
          trunk_volume_liters: d.trunk_volume_liters,
        }));
      }
      return data.map((g: any) => ({ generation_id: g.id }));
    },
  },

  // ── CLASSEMENTS SPÉCIAUX (5) ─────────────────────────────────────
  {
    slug: "voiture-4-etoiles-euroncap-2025",
    title: "Voitures 4 étoiles Euro NCAP 2025",
    h1: "Les voitures 4 étoiles Euro NCAP",
    description:
      "Liste des véhicules ayant obtenu 4 étoiles aux crash-tests Euro NCAP. Un excellent niveau de sécurité.",
    icon: "Shield",
    group: "divers",
    query: async (db) => {
      const { data } = await db
        .from("safety_ratings")
        .select(
          "generation_id, stars, adult_occupant_pct, test_year, confidence"
        )
        .eq("stars", 4)
        .in("confidence", ["A", "B"])
        .order("test_year", { ascending: false })
        .limit(30);
      return dedupFirst(data || []);
    },
  },
  {
    slug: "meilleure-protection-adulte-2025",
    title: "Meilleure protection adulte Euro NCAP 2025",
    h1: "Les voitures avec la meilleure protection des adultes",
    description:
      "Classement par score de protection des adultes Euro NCAP. Les véhicules qui protègent le mieux conducteur et passagers.",
    icon: "UserCheck",
    group: "divers",
    query: async (db) => {
      const { data } = await db
        .from("safety_ratings")
        .select(
          "generation_id, stars, adult_occupant_pct, test_year, confidence"
        )
        .in("confidence", ["A", "B"])
        .gt("adult_occupant_pct", 0)
        .order("adult_occupant_pct", { ascending: false })
        .limit(30);
      return dedupFirst(data || []);
    },
  },
  {
    slug: "voiture-acceleration-sous-5-secondes-2025",
    title: "Voitures de 0 à 100 en moins de 5 secondes 2025",
    h1: "Les voitures qui passent de 0 à 100 km/h en moins de 5 secondes",
    description:
      "Club des fusées : toutes les voitures capables d'atteindre 100 km/h en moins de 5 secondes.",
    icon: "Rocket",
    group: "divers",
    query: async (db) => {
      const { data } = await db
        .from("engine_variants")
        .select(
          "generation_id, performance_specs!inner(acceleration_0_100_kmh)"
        )
        .gt("performance_specs.acceleration_0_100_kmh", 0)
        .lt("performance_specs.acceleration_0_100_kmh", 5)
        .order("performance_specs(acceleration_0_100_kmh)", {
          ascending: true,
        })
        .limit(100);
      const flat = (data || []).map((d: any) => ({
        generation_id: d.generation_id,
        acceleration: d.performance_specs?.acceleration_0_100_kmh,
      }));
      return dedupMin(flat, "acceleration").slice(0, 30);
    },
  },
  {
    slug: "meilleure-voiture-familiale-2025",
    title: "Meilleure voiture familiale 2025",
    h1: "Les meilleures voitures familiales en 2025",
    description:
      "Classement global des voitures familiales par score Family Fit : ISOFIX, largeur banquette, sécurité enfants.",
    icon: "Heart",
    group: "divers",
    query: async (db) => {
      const { data } = await db
        .from("family_fit_compatibility")
        .select(
          "generation_id, family_fit_score, isofix_points, three_across_possible"
        )
        .order("family_fit_score", { ascending: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "voiture-sportive-accessible-2025",
    title: "Voiture sportive accessible 2025",
    h1: "Les voitures sportives les plus accessibles en 2025",
    description:
      "Les modèles offrant au moins 200 chevaux : la sportivité sans se ruiner. Classement par puissance.",
    icon: "Flame",
    group: "divers",
    query: async (db) => {
      const { data } = await db
        .from("engine_variants")
        .select("generation_id, powertrain_specs!inner(power_hp)")
        .gte("powertrain_specs.power_hp", 200)
        .lte("powertrain_specs.power_hp", 350)
        .order("powertrain_specs(power_hp)", { ascending: false })
        .limit(100);
      const flat = (data || []).map((d: any) => ({
        generation_id: d.generation_id,
        power_hp: d.powertrain_specs?.power_hp,
      }));
      return dedupMax(flat, "power_hp").slice(0, 30);
    },
  },
];
