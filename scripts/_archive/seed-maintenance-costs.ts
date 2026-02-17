/**
 * FLM AUTO - Seed Maintenance Costs
 *
 * Seeds realistic maintenance costs for top 50 popular models
 * into the maintenance_costs table.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-maintenance-costs.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Paginate helper ────────────────────────────────────────

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

// ─── Types ──────────────────────────────────────────────────

interface ServiceEntry {
  service_type: string;
  interval_km?: number;
  interval_months?: number;
  estimated_cost_eur_min?: number;
  estimated_cost_eur_max?: number;
  parts_cost_eur?: number;
  labor_hours?: number;
  notes?: string;
}

interface CategoryDef {
  models: string[];
  services: ServiceEntry[];
}

// ─── Maintenance data by category ───────────────────────────

const SMALL_CARS: CategoryDef = {
  models: [
    'Peugeot 208',
    'Renault Clio',
    'Volkswagen Polo',
    'Toyota Yaris',
    'Opel Corsa',
    'Fiat 500',
    'Hyundai i20',
    'Kia Picanto',
    'Skoda Fabia',
    'Seat Ibiza',
  ],
  services: [
    {
      service_type: 'oil_change',
      interval_km: 15000,
      interval_months: 12,
      estimated_cost_eur_min: 120,
      estimated_cost_eur_max: 180,
      parts_cost_eur: 40,
      labor_hours: 1.0,
    },
    {
      service_type: 'brake_pads_front',
      interval_km: 30000,
      estimated_cost_eur_min: 150,
      estimated_cost_eur_max: 250,
      parts_cost_eur: 60,
      labor_hours: 1.5,
    },
    {
      service_type: 'air_filter',
      interval_km: 30000,
      estimated_cost_eur_min: 30,
      estimated_cost_eur_max: 50,
      parts_cost_eur: 15,
      labor_hours: 0.5,
    },
    {
      service_type: 'minor_service',
      interval_km: 15000,
      interval_months: 12,
      estimated_cost_eur_min: 200,
      estimated_cost_eur_max: 300,
    },
    {
      service_type: 'major_service',
      interval_km: 60000,
      interval_months: 24,
      estimated_cost_eur_min: 400,
      estimated_cost_eur_max: 600,
    },
    {
      service_type: 'tires',
      interval_km: 40000,
      estimated_cost_eur_min: 300,
      estimated_cost_eur_max: 450,
      notes: 'Jeu de 4 pneus',
    },
  ],
};

const COMPACT_CARS: CategoryDef = {
  models: [
    'Peugeot 308',
    'Renault Megane',
    'Volkswagen Golf',
    'Toyota Corolla',
    'Mazda 3',
    'Hyundai i30',
    'Kia Ceed',
    'Skoda Octavia',
    'Ford Focus',
    'Honda Civic',
  ],
  services: [
    {
      service_type: 'oil_change',
      interval_km: 15000,
      interval_months: 12,
      estimated_cost_eur_min: 150,
      estimated_cost_eur_max: 220,
      parts_cost_eur: 50,
      labor_hours: 1.0,
    },
    {
      service_type: 'brake_pads_front',
      interval_km: 30000,
      estimated_cost_eur_min: 180,
      estimated_cost_eur_max: 280,
      parts_cost_eur: 70,
      labor_hours: 1.5,
    },
    {
      service_type: 'timing_belt',
      interval_km: 120000,
      interval_months: 84,
      estimated_cost_eur_min: 500,
      estimated_cost_eur_max: 800,
      parts_cost_eur: 200,
      labor_hours: 3.0,
      notes: 'Non applicable aux moteurs a chaine de distribution',
    },
    {
      service_type: 'minor_service',
      interval_km: 15000,
      interval_months: 12,
      estimated_cost_eur_min: 250,
      estimated_cost_eur_max: 350,
    },
    {
      service_type: 'major_service',
      interval_km: 60000,
      interval_months: 24,
      estimated_cost_eur_min: 500,
      estimated_cost_eur_max: 750,
    },
    {
      service_type: 'tires',
      interval_km: 40000,
      estimated_cost_eur_min: 400,
      estimated_cost_eur_max: 600,
      notes: 'Jeu de 4 pneus',
    },
  ],
};

const SUV_CROSSOVER: CategoryDef = {
  models: [
    'Peugeot 3008',
    'Peugeot 5008',
    'Renault Austral',
    'Volkswagen Tiguan',
    'Toyota RAV4',
    'Hyundai Tucson',
    'Kia Sportage',
    'Skoda Kodiaq',
    'BMW X1',
    'BMW X3',
    'Mercedes GLC',
    'Volvo XC60',
  ],
  services: [
    {
      service_type: 'oil_change',
      interval_km: 15000,
      interval_months: 12,
      estimated_cost_eur_min: 180,
      estimated_cost_eur_max: 280,
      parts_cost_eur: 60,
      labor_hours: 1.0,
    },
    {
      service_type: 'brake_pads_front',
      interval_km: 25000,
      estimated_cost_eur_min: 200,
      estimated_cost_eur_max: 350,
      parts_cost_eur: 90,
      labor_hours: 2.0,
    },
    {
      service_type: 'minor_service',
      interval_km: 15000,
      interval_months: 12,
      estimated_cost_eur_min: 300,
      estimated_cost_eur_max: 450,
    },
    {
      service_type: 'major_service',
      interval_km: 60000,
      interval_months: 24,
      estimated_cost_eur_min: 600,
      estimated_cost_eur_max: 900,
    },
    {
      service_type: 'tires',
      interval_km: 35000,
      estimated_cost_eur_min: 500,
      estimated_cost_eur_max: 800,
      notes: 'Jeu de 4 pneus',
    },
  ],
};

const PREMIUM: CategoryDef = {
  models: [
    'BMW Serie 3',
    'Mercedes Classe C',
    'Audi A3',
    'Audi A4',
    'Volvo S60',
  ],
  services: [
    {
      service_type: 'oil_change',
      interval_km: 15000,
      interval_months: 12,
      estimated_cost_eur_min: 200,
      estimated_cost_eur_max: 350,
      parts_cost_eur: 80,
      labor_hours: 1.0,
    },
    {
      service_type: 'brake_pads_front',
      interval_km: 25000,
      estimated_cost_eur_min: 250,
      estimated_cost_eur_max: 400,
      parts_cost_eur: 120,
      labor_hours: 2.0,
    },
    {
      service_type: 'minor_service',
      interval_km: 15000,
      interval_months: 12,
      estimated_cost_eur_min: 350,
      estimated_cost_eur_max: 500,
    },
    {
      service_type: 'major_service',
      interval_km: 60000,
      interval_months: 24,
      estimated_cost_eur_min: 700,
      estimated_cost_eur_max: 1200,
    },
    {
      service_type: 'tires',
      interval_km: 30000,
      estimated_cost_eur_min: 600,
      estimated_cost_eur_max: 1000,
      notes: 'Jeu de 4 pneus',
    },
  ],
};

const EV: CategoryDef = {
  models: [
    'Tesla Model 3',
    'Tesla Model Y',
    'Volkswagen ID.3',
    'Volkswagen ID.4',
    'Hyundai Ioniq 5',
    'Renault Megane E-Tech',
    'Kia EV6',
  ],
  services: [
    {
      service_type: 'brake_pads_front',
      interval_km: 80000,
      estimated_cost_eur_min: 200,
      estimated_cost_eur_max: 350,
      notes: 'Freinage regeneratif = usure reduite',
    },
    {
      service_type: 'cabin_filter',
      interval_km: 20000,
      estimated_cost_eur_min: 50,
      estimated_cost_eur_max: 80,
      parts_cost_eur: 25,
      labor_hours: 0.5,
    },
    {
      service_type: 'tires',
      interval_km: 30000,
      estimated_cost_eur_min: 500,
      estimated_cost_eur_max: 800,
      notes: 'Jeu de 4 pneus - usure plus rapide (poids vehicule)',
    },
    {
      service_type: 'minor_service',
      interval_km: 30000,
      interval_months: 24,
      estimated_cost_eur_min: 150,
      estimated_cost_eur_max: 250,
      notes: 'Entretien reduit par rapport aux thermiques',
    },
    {
      service_type: 'battery',
      interval_km: 200000,
      notes: 'Garantie constructeur 8 ans / 160,000 km',
    },
  ],
};

const ALL_CATEGORIES: CategoryDef[] = [SMALL_CARS, COMPACT_CARS, SUV_CROSSOVER, PREMIUM, EV];

// ─── Model name normalization helpers ───────────────────────

/**
 * Build alternative search names for a model, e.g.:
 * "BMW Serie 3" -> ["serie 3", "3 series", "3-series", "3er"]
 * "Mercedes Classe C" -> ["classe c", "c-class", "c class"]
 * "Volkswagen ID.3" -> ["id.3", "id3"]
 */
function getModelSearchNames(fullName: string): { brand: string; searchNames: string[] } {
  const parts = fullName.split(' ');
  const brand = parts[0];
  const model = parts.slice(1).join(' ');
  const modelLower = model.toLowerCase();

  const searchNames: string[] = [modelLower];

  // BMW "Serie X" -> also search "X Series", "X-Series"
  const serieMatch = modelLower.match(/^serie\s+(\d+)/);
  if (serieMatch) {
    searchNames.push(`${serieMatch[1]} series`);
    searchNames.push(`${serieMatch[1]}-series`);
    searchNames.push(`${serieMatch[1]}er`);
    searchNames.push(`serie ${serieMatch[1]}`);
  }

  // Mercedes "Classe X" -> also search "X-Class", "X Class"
  const classeMatch = modelLower.match(/^classe\s+(\w+)/);
  if (classeMatch) {
    searchNames.push(`${classeMatch[1]}-class`);
    searchNames.push(`${classeMatch[1]} class`);
    searchNames.push(`classe ${classeMatch[1]}`);
    searchNames.push(`${classeMatch[1]}-klasse`);
  }

  // Renault "Megane E-Tech" -> also search "megane e-tech", "megane"
  if (modelLower.includes('e-tech')) {
    searchNames.push(modelLower.replace(' e-tech', ''));
  }

  // VW "ID.3" -> also search "id3", "id 3"
  const idMatch = modelLower.match(/^id\.(\d+)/);
  if (idMatch) {
    searchNames.push(`id${idMatch[1]}`);
    searchNames.push(`id ${idMatch[1]}`);
    searchNames.push(`id.${idMatch[1]}`);
  }

  // Hyundai "Ioniq 5" -> also "ioniq5"
  if (modelLower.includes('ioniq')) {
    searchNames.push(modelLower.replace(' ', ''));
  }

  return { brand, searchNames };
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  FLM AUTO - Seed Maintenance Costs');
  console.log('════════════════════════════════════════════════════════\n');

  // 1. Load all generations with brand + model names
  console.log('Loading generations from database...');
  const generations = await paginateAll(
    'generations',
    'id, name, production_start, production_end, models!inner(id, name, brands!inner(id, name))'
  );
  console.log(`  Found ${generations.length} generations\n`);

  // 2. Build a map: for each model, find the most recent generation
  //    Key = "brand|model" lowercase, Value = generation_id
  interface GenInfo {
    id: string;
    brandName: string;
    modelName: string;
    productionStart: number | null;
  }

  const modelToGens = new Map<string, GenInfo[]>();

  for (const gen of generations) {
    const brandName: string = (gen.models as any).brands.name;
    const modelName: string = (gen.models as any).name;
    const key = `${brandName.toLowerCase()}|${modelName.toLowerCase()}`;

    if (!modelToGens.has(key)) {
      modelToGens.set(key, []);
    }
    modelToGens.get(key)!.push({
      id: gen.id,
      brandName,
      modelName,
      productionStart: gen.production_start,
    });
  }

  // Sort each model's generations by production_start descending (most recent first)
  for (const [, gens] of modelToGens) {
    gens.sort((a, b) => (b.productionStart ?? 0) - (a.productionStart ?? 0));
  }

  // 3. Match each model from our maintenance data to a generation
  const stats = {
    modelsMatched: 0,
    modelsUnmatched: 0,
    rowsUpserted: 0,
    rowsErrored: 0,
  };
  const unmatchedModels: string[] = [];

  for (const category of ALL_CATEGORIES) {
    for (const modelFullName of category.models) {
      const { brand, searchNames } = getModelSearchNames(modelFullName);
      const brandLower = brand.toLowerCase();

      // Try to find a matching generation
      let matchedGen: GenInfo | null = null;

      for (const [key, gens] of modelToGens) {
        const [dbBrand, dbModel] = key.split('|');

        // Brand must match (partial match to handle "Mercedes" vs "Mercedes-Benz", etc.)
        const brandMatch =
          dbBrand.includes(brandLower) || brandLower.includes(dbBrand);
        if (!brandMatch) continue;

        // Model must match one of the search names
        const modelMatch = searchNames.some(
          (sn) => dbModel.includes(sn) || sn.includes(dbModel)
        );
        if (!modelMatch) continue;

        // Take the most recent generation (already sorted)
        matchedGen = gens[0];
        break;
      }

      if (!matchedGen) {
        stats.modelsUnmatched++;
        unmatchedModels.push(modelFullName);
        console.log(`  [SKIP] ${modelFullName} - no matching generation found`);
        continue;
      }

      stats.modelsMatched++;
      console.log(
        `  [OK]   ${modelFullName} -> ${matchedGen.brandName} ${matchedGen.modelName} (gen ${matchedGen.id.slice(0, 8)}...)`
      );

      // 4. Upsert all service types for this generation
      for (const svc of category.services) {
        const row: Record<string, any> = {
          generation_id: matchedGen.id,
          service_type: svc.service_type,
          source: 'flm_estimates',
        };

        if (svc.interval_km !== undefined) row.interval_km = svc.interval_km;
        if (svc.interval_months !== undefined) row.interval_months = svc.interval_months;
        if (svc.estimated_cost_eur_min !== undefined) row.estimated_cost_eur_min = svc.estimated_cost_eur_min;
        if (svc.estimated_cost_eur_max !== undefined) row.estimated_cost_eur_max = svc.estimated_cost_eur_max;
        if (svc.parts_cost_eur !== undefined) row.parts_cost_eur = svc.parts_cost_eur;
        if (svc.labor_hours !== undefined) row.labor_hours = svc.labor_hours;
        if (svc.notes !== undefined) row.notes = svc.notes;

        const { error } = await supabase
          .from('maintenance_costs')
          .upsert(row, { onConflict: 'generation_id,service_type' });

        if (error) {
          console.error(`    [ERR] ${svc.service_type}: ${error.message}`);
          stats.rowsErrored++;
        } else {
          stats.rowsUpserted++;
        }
      }
    }
  }

  // 5. Summary
  console.log('\n' + '═'.repeat(56));
  console.log('  SUMMARY');
  console.log('═'.repeat(56));
  console.log(`  Models matched:   ${stats.modelsMatched}`);
  console.log(`  Models unmatched: ${stats.modelsUnmatched}`);
  console.log(`  Rows upserted:    ${stats.rowsUpserted}`);
  console.log(`  Rows errored:     ${stats.rowsErrored}`);

  if (unmatchedModels.length > 0) {
    console.log('\n  Unmatched models:');
    for (const m of unmatchedModels) {
      console.log(`    - ${m}`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
