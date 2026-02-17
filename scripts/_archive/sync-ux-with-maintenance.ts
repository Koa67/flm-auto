/**
 * Sync UX ratings with maintenance cost models.
 * For models that have maintenance_costs but no ux_ratings,
 * insert estimated UX ratings based on brand heuristics.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/sync-ux-with-maintenance.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Brand-based UX heuristics ──────────────────────────

interface UXEstimate {
  physical_buttons_climate: number;
  physical_buttons_volume: number;
  screen_responsiveness: number;
  materials_quality: number;
  noise_level_highway_db: number | null;
  wireless_carplay: boolean;
  wireless_android_auto: boolean;
}

const BRAND_DEFAULTS: Record<string, UXEstimate> = {
  'Tesla':        { physical_buttons_climate: 1, physical_buttons_volume: 1, screen_responsiveness: 9, materials_quality: 7, noise_level_highway_db: 67, wireless_carplay: false, wireless_android_auto: false },
  'BMW':          { physical_buttons_climate: 7, physical_buttons_volume: 8, screen_responsiveness: 8, materials_quality: 9, noise_level_highway_db: 65, wireless_carplay: true, wireless_android_auto: true },
  'Mercedes-Benz':{ physical_buttons_climate: 5, physical_buttons_volume: 6, screen_responsiveness: 8, materials_quality: 9, noise_level_highway_db: 64, wireless_carplay: true, wireless_android_auto: true },
  'Audi':         { physical_buttons_climate: 4, physical_buttons_volume: 5, screen_responsiveness: 8, materials_quality: 9, noise_level_highway_db: 65, wireless_carplay: true, wireless_android_auto: true },
  'Volkswagen':   { physical_buttons_climate: 3, physical_buttons_volume: 4, screen_responsiveness: 6, materials_quality: 8, noise_level_highway_db: 68, wireless_carplay: true, wireless_android_auto: true },
  'Peugeot':      { physical_buttons_climate: 4, physical_buttons_volume: 5, screen_responsiveness: 7, materials_quality: 7, noise_level_highway_db: 69, wireless_carplay: true, wireless_android_auto: true },
  'Renault':      { physical_buttons_climate: 6, physical_buttons_volume: 7, screen_responsiveness: 7, materials_quality: 7, noise_level_highway_db: 69, wireless_carplay: true, wireless_android_auto: true },
  'Toyota':       { physical_buttons_climate: 8, physical_buttons_volume: 8, screen_responsiveness: 6, materials_quality: 7, noise_level_highway_db: 70, wireless_carplay: true, wireless_android_auto: true },
  'Hyundai':      { physical_buttons_climate: 6, physical_buttons_volume: 7, screen_responsiveness: 8, materials_quality: 7, noise_level_highway_db: 68, wireless_carplay: true, wireless_android_auto: true },
  'Kia':          { physical_buttons_climate: 6, physical_buttons_volume: 7, screen_responsiveness: 8, materials_quality: 7, noise_level_highway_db: 68, wireless_carplay: true, wireless_android_auto: true },
  'Skoda':        { physical_buttons_climate: 5, physical_buttons_volume: 6, screen_responsiveness: 7, materials_quality: 7, noise_level_highway_db: 69, wireless_carplay: true, wireless_android_auto: true },
  'Seat':         { physical_buttons_climate: 5, physical_buttons_volume: 6, screen_responsiveness: 7, materials_quality: 7, noise_level_highway_db: 69, wireless_carplay: true, wireless_android_auto: true },
  'Mazda':        { physical_buttons_climate: 9, physical_buttons_volume: 9, screen_responsiveness: 7, materials_quality: 8, noise_level_highway_db: 68, wireless_carplay: true, wireless_android_auto: true },
  'Volvo':        { physical_buttons_climate: 5, physical_buttons_volume: 6, screen_responsiveness: 8, materials_quality: 8, noise_level_highway_db: 65, wireless_carplay: true, wireless_android_auto: true },
  'Ford':         { physical_buttons_climate: 6, physical_buttons_volume: 7, screen_responsiveness: 7, materials_quality: 6, noise_level_highway_db: 70, wireless_carplay: true, wireless_android_auto: true },
  'Opel':         { physical_buttons_climate: 5, physical_buttons_volume: 6, screen_responsiveness: 7, materials_quality: 7, noise_level_highway_db: 69, wireless_carplay: true, wireless_android_auto: true },
  'Honda':        { physical_buttons_climate: 7, physical_buttons_volume: 8, screen_responsiveness: 7, materials_quality: 7, noise_level_highway_db: 69, wireless_carplay: true, wireless_android_auto: true },
  'Fiat':         { physical_buttons_climate: 6, physical_buttons_volume: 7, screen_responsiveness: 6, materials_quality: 6, noise_level_highway_db: 71, wireless_carplay: true, wireless_android_auto: true },
};

const DEFAULT_UX: UXEstimate = {
  physical_buttons_climate: 6,
  physical_buttons_volume: 7,
  screen_responsiveness: 7,
  materials_quality: 7,
  noise_level_highway_db: 69,
  wireless_carplay: true,
  wireless_android_auto: true,
};

function computeOverallScore(ux: UXEstimate): number {
  const buttonScore = ((ux.physical_buttons_climate + ux.physical_buttons_volume) / 2) * 2;
  const screenScore = ux.screen_responsiveness * 1.5;
  const materialsScore = ux.materials_quality * 0.5;
  const noiseScore = ux.noise_level_highway_db
    ? Math.max(0, 10 - (ux.noise_level_highway_db - 60) / 3)
    : 5;
  const connectivityBonus = (ux.wireless_carplay ? 2.5 : 0) + (ux.wireless_android_auto ? 2.5 : 0);
  return Math.round(buttonScore + screenScore + materialsScore + noiseScore + connectivityBonus);
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('=== Sync UX Ratings with Maintenance Models ===\n');

  // Get all generation_ids with maintenance costs
  const { data: maintenance } = await supabase
    .from('maintenance_costs')
    .select('generation_id');
  const maintenanceGenIds = [...new Set((maintenance || []).map(m => m.generation_id))];
  console.log(`  Generations with maintenance costs: ${maintenanceGenIds.length}`);

  // Get existing UX ratings
  const { data: existingUx } = await supabase
    .from('ux_ratings')
    .select('generation_id');
  const existingIds = new Set((existingUx || []).map(u => u.generation_id));
  console.log(`  Existing UX ratings: ${existingIds.size}`);

  // Find missing
  const missing = maintenanceGenIds.filter(id => !existingIds.has(id));
  console.log(`  Missing UX ratings: ${missing.length}`);

  if (missing.length === 0) {
    console.log('\n  Nothing to do.');
    return;
  }

  // Load generation + model + brand for name resolution
  const { data: gens } = await supabase
    .from('generations')
    .select('id, model_id')
    .in('id', missing);
  const modelIds = [...new Set((gens || []).map(g => g.model_id))];
  const { data: models } = await supabase
    .from('models')
    .select('id, name, brand_id')
    .in('id', modelIds);
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name');

  const brandById = new Map((brands || []).map(b => [b.id, b.name]));
  const modelBrandMap = new Map<string, string>();
  for (const m of models || []) {
    modelBrandMap.set(m.id, brandById.get(m.brand_id) || '');
  }
  const genBrandMap = new Map<string, string>();
  for (const g of gens || []) {
    genBrandMap.set(g.id, modelBrandMap.get(g.model_id) || '');
  }

  let added = 0;
  let errors = 0;

  for (const genId of missing) {
    const brandName = genBrandMap.get(genId) || '';
    const ux = BRAND_DEFAULTS[brandName] || DEFAULT_UX;
    const score = computeOverallScore(ux);

    const { error } = await supabase.from('ux_ratings').insert({
      generation_id: genId,
      ...ux,
      overall_ux_score: score,
      source: 'estimated_from_brand',
    });

    if (error) {
      errors++;
      if (errors <= 3) console.error(`  Error for ${genId}: ${error.message}`);
    } else {
      added++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`  UX ratings added: ${added}`);
  console.log(`  Errors: ${errors}`);
}

main().catch(console.error);
