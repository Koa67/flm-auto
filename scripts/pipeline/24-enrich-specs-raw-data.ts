/**
 * 24-enrich-specs-raw-data.ts — Multi-strategy enrichment
 *
 * Phase 1: Mine raw_data JSONB from UltimateSpecs us_* entries to create
 *          properly-parsed interior_dimensions rows for gens that lack them.
 * Phase 2: Cross-brand safety propagation — re-run with new JNCAP seeds.
 * Phase 3: Platform-based dimension propagation (broader than same-model).
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/24-enrich-specs-raw-data.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/24-enrich-specs-raw-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');

async function paginateAll(table: string, select: string, filter?: (q: any) => any): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

// Parse UltimateSpecs raw_data values like "230 L / 8.1 cu-ft" or "421.5 cm / 165.94 inches"
function parseUSValue(rawValue: string, unit: string): number | null {
  if (!rawValue) return null;
  const parts = rawValue.split('/');
  const metricPart = parts[0]?.trim();
  if (!metricPart) return null;

  const numMatch = metricPart.match(/([\d.]+)\s*/);
  if (!numMatch) return null;
  const val = parseFloat(numMatch[1]);
  if (isNaN(val) || val <= 0) return null;

  if (unit === 'cm_to_mm') return Math.round(val * 10); // cm → mm
  if (unit === 'liters') return Math.round(val);
  if (unit === 'kg') return Math.round(val);
  if (unit === 'mm') return Math.round(val);
  return val;
}

// Platform groups for cross-platform safety propagation
const PLATFORM_GROUPS: Record<string, string[][]> = {
  'MQB': [['Volkswagen', 'Golf'], ['Volkswagen', 'Tiguan'], ['Skoda', 'Octavia'], ['Skoda', 'Karoq'], ['SEAT', 'Leon'], ['Audi', 'A3']],
  'TNGA-C': [['Toyota', 'Corolla'], ['Toyota', 'C-HR'], ['Lexus', 'UX']],
  'TNGA-K': [['Toyota', 'RAV4'], ['Toyota', 'Camry'], ['Lexus', 'ES'], ['Lexus', 'NX']],
  'CLAR': [['BMW', '3 Series'], ['BMW', '5 Series'], ['BMW', 'X3'], ['BMW', 'X5'], ['BMW', '4 Series']],
  'SPA': [['Volvo', 'XC90'], ['Volvo', 'XC60'], ['Volvo', 'V90'], ['Volvo', 'S90']],
  'CMA': [['Volvo', 'XC40'], ['Lynk & Co', '01']],
  'EMP2': [['Peugeot', '3008'], ['Peugeot', '5008'], ['Citroen', 'C5 Aircross'], ['Opel', 'Grandland']],
  'CMP': [['Peugeot', '208'], ['Peugeot', '2008'], ['Opel', 'Corsa'], ['Citroen', 'C3'], ['DS', 'DS3']],
  'MRA2': [['Mercedes-Benz', 'C-Class'], ['Mercedes-Benz', 'E-Class'], ['Mercedes-Benz', 'GLC']],
  'N3': [['Hyundai', 'Tucson'], ['Kia', 'Sportage'], ['Hyundai', 'Sonata'], ['Kia', 'K5']],
  'K3': [['Hyundai', 'i20'], ['Kia', 'Rio'], ['Hyundai', 'Bayon']],
  'CMF-CD': [['Renault', 'Megane'], ['Renault', 'Kadjar'], ['Nissan', 'Qashqai']],
};

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  24-ENRICH-SPECS-RAW-DATA');
  console.log('  Multi-strategy enrichment (raw_data + safety + dims)');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  const stats = {
    phase1DimsCreated: 0,
    phase1FieldsFilled: 0,
    phase2SafetyPropagated: 0,
    phase3DimsPropagated: 0,
  };

  // ═══════════════════════════════════════════════════════
  // Phase 1: Mine raw_data for interior dimensions
  // ═══════════════════════════════════════════════════════
  console.log('\n  ── Phase 1: Mine raw_data for interior dimensions ──');

  const existingDims = await paginateAll('interior_dimensions', 'generation_id');
  const dimGenIds = new Set(existingDims.map((d: any) => d.generation_id));
  console.log(`  Existing interior_dims: ${dimGenIds.size}`);

  // Get UltimateSpecs us_* with raw_data for gens without dims
  const usSpecs = await paginateAll(
    'third_party_specs',
    'generation_id, spec_type, spec_value, raw_data',
    (q: any) => q.or('spec_type.ilike.us_%').not('raw_data', 'is', null)
  );
  console.log(`  UltimateSpecs us_* specs with raw_data: ${usSpecs.length}`);

  // Group by generation
  const usSpecsByGen = new Map<string, any[]>();
  for (const s of usSpecs) {
    if (!usSpecsByGen.has(s.generation_id)) usSpecsByGen.set(s.generation_id, []);
    usSpecsByGen.get(s.generation_id)!.push(s);
  }

  // Mapping: us_spec_type → { dim_column, unit }
  const US_DIM_MAP: Record<string, { column: string; unit: string }> = {
    'us_trunk_boot_capacity': { column: 'trunk_volume_liters', unit: 'liters' },
    'us_num_of_seats': { column: 'seating_capacity', unit: 'mm' }, // passthrough int
  };

  const dimsToUpsert: any[] = [];

  for (const [genId, genSpecs] of Array.from(usSpecsByGen.entries())) {
    if (dimGenIds.has(genId)) continue; // Already has dims

    const row: any = { generation_id: genId };
    let fields = 0;

    for (const spec of genSpecs) {
      const mapping = US_DIM_MAP[spec.spec_type];
      if (!mapping) continue;

      const rawValue = spec.raw_data?.value;
      if (!rawValue) continue;

      const parsed = parseUSValue(rawValue, mapping.unit);
      if (parsed === null) continue;

      // Sanity checks
      if (mapping.column === 'trunk_volume_liters' && (parsed < 10 || parsed > 3000)) continue;
      if (mapping.column === 'curb_weight_kg' && (parsed < 500 || parsed > 5000)) continue;
      if (mapping.column === 'seating_capacity' && (parsed < 1 || parsed > 12)) continue;

      row[mapping.column] = parsed;
      fields++;
    }

    if (fields > 0) {
      dimsToUpsert.push(row);
      dimGenIds.add(genId);
      stats.phase1DimsCreated++;
      stats.phase1FieldsFilled += fields;
    }
  }

  // Also check Auto-Data.net for gens missing dims: extract trunk_boot_space_minimum/maximum
  const adnTrunkSpecs = await paginateAll(
    'third_party_specs',
    'generation_id, spec_type, spec_value',
    (q: any) => q.in('spec_type', ['trunk_boot_space_minimum', 'trunk_boot_space_maximum', 'fuel_tank_capacity', 'seats'])
  );

  const adnByGen = new Map<string, any[]>();
  for (const s of adnTrunkSpecs) {
    if (!adnByGen.has(s.generation_id)) adnByGen.set(s.generation_id, []);
    adnByGen.get(s.generation_id)!.push(s);
  }

  for (const [genId, genSpecs] of Array.from(adnByGen.entries())) {
    if (dimGenIds.has(genId)) continue;

    const row: any = { generation_id: genId };
    let fields = 0;

    for (const spec of genSpecs) {
      const val = parseFloat(spec.spec_value);
      if (isNaN(val) || val <= 0) continue;

      if (spec.spec_type === 'trunk_boot_space_minimum' && val >= 10 && val <= 3000) {
        row.trunk_volume_liters = Math.round(val);
        fields++;
      }
      if (spec.spec_type === 'trunk_boot_space_maximum' && val >= 10 && val <= 3000) {
        row.trunk_volume_max_liters = Math.round(val);
        fields++;
      }
      if (spec.spec_type === 'fuel_tank_capacity' && val >= 5 && val <= 200) {
        row.fuel_tank_liters = Math.round(val);
        fields++;
      }
      if (spec.spec_type === 'seats' && val >= 1 && val <= 12) {
        row.seating_capacity = Math.round(val);
        fields++;
      }
    }

    if (fields > 0) {
      dimsToUpsert.push(row);
      dimGenIds.add(genId);
      stats.phase1DimsCreated++;
      stats.phase1FieldsFilled += fields;
    }
  }

  console.log(`  New dims to create: ${stats.phase1DimsCreated} (${stats.phase1FieldsFilled} fields)`);

  if (!DRY_RUN && dimsToUpsert.length > 0) {
    let upserted = 0;
    for (let i = 0; i < dimsToUpsert.length; i += BATCH_SIZE) {
      const batch = dimsToUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('interior_dimensions').upsert(batch, { onConflict: 'generation_id' });
      if (error) console.error(`  Dims batch error at ${i}: ${error.message}`);
      else upserted += batch.length;
    }
    console.log(`  Upserted: ${upserted}`);
  }

  // ═══════════════════════════════════════════════════════
  // Phase 2: Safety re-propagation with new JNCAP seeds
  // ═══════════════════════════════════════════════════════
  console.log('\n  ── Phase 2: Safety re-propagation with JNCAP seeds ──');

  const gens = await paginateAll('generations', 'id, name, body_type, production_start, model_id');
  const allSafety = await paginateAll('safety_ratings', 'generation_id, stars, source_url');
  const safetyByGenId = new Map<string, any>();
  for (const s of allSafety) safetyByGenId.set(s.generation_id, s);
  console.log(`  Safety: ${allSafety.length} / ${gens.length} gens (${(allSafety.length / gens.length * 100).toFixed(1)}%)`);

  // Group by model
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!g.model_id) continue;
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Propagate within same model
  const safetyToInsert: any[] = [];
  const processedSafety = new Set<string>();

  for (const [, modelGens] of Array.from(gensByModel.entries())) {
    const withSafety = modelGens.filter((g: any) => safetyByGenId.has(g.id));
    const withoutSafety = modelGens.filter((g: any) => !safetyByGenId.has(g.id));
    if (withSafety.length === 0 || withoutSafety.length === 0) continue;

    for (const uGen of withoutSafety) {
      if (processedSafety.has(uGen.id)) continue;
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
      if (!uStart) continue;

      let bestSource: any = null;
      let bestDist = Infinity;

      for (const rGen of withSafety) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        if (!rStart) continue;
        const dist = Math.abs(uStart - rStart);
        if (dist <= 7 && dist < bestDist) { bestDist = dist; bestSource = rGen; }
      }

      if (!bestSource) continue;
      const sourceSafety = safetyByGenId.get(bestSource.id);
      if (!sourceSafety) continue;

      safetyToInsert.push({
        generation_id: uGen.id,
        stars: sourceSafety.stars,
        source_url: `propagated_from:${bestSource.id}`,
      });
      processedSafety.add(uGen.id);
      safetyByGenId.set(uGen.id, sourceSafety);
      stats.phase2SafetyPropagated++;
    }
  }

  console.log(`  Safety propagated (same model): ${stats.phase2SafetyPropagated}`);

  // Deduplicate against existing
  const newSafety = safetyToInsert.filter(s => !allSafety.some((e: any) => e.generation_id === s.generation_id));
  console.log(`  New (deduplicated): ${newSafety.length}`);

  if (!DRY_RUN && newSafety.length > 0) {
    let inserted = 0;
    for (let i = 0; i < newSafety.length; i += BATCH_SIZE) {
      const batch = newSafety.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').insert(batch);
      if (error) console.error(`  Safety batch error at ${i}: ${error.message}`);
      else inserted += batch.length;
    }
    console.log(`  Inserted: ${inserted}`);
  }

  // ═══════════════════════════════════════════════════════
  // Phase 3: Cross-brand dimension propagation via platforms
  // ═══════════════════════════════════════════════════════
  console.log('\n  ── Phase 3: Platform-based dimension propagation ──');

  const models = await paginateAll('models', 'id, name, brand:brands(name)');
  const modelMap = new Map<string, any>();
  for (const m of models) modelMap.set(m.id, m);

  const updatedDims = await paginateAll('interior_dimensions', 'generation_id, trunk_volume_liters, fuel_tank_liters, seating_capacity');
  const updatedDimGenIds = new Map<string, any>();
  for (const d of updatedDims) updatedDimGenIds.set(d.generation_id, d);

  const dimsPropagated: any[] = [];

  for (const [, platformModels] of Object.entries(PLATFORM_GROUPS)) {
    // Find gen IDs for each brand+model combo
    const platformGens: any[] = [];
    for (const [brandName, modelName] of platformModels) {
      for (const g of gens) {
        const m = modelMap.get(g.model_id);
        if (!m?.brand) continue;
        if (m.brand.name.toLowerCase() === brandName.toLowerCase() &&
            m.name.toLowerCase() === modelName.toLowerCase()) {
          platformGens.push(g);
        }
      }
    }

    const withDims = platformGens.filter(g => updatedDimGenIds.has(g.id));
    const withoutDims = platformGens.filter(g => !updatedDimGenIds.has(g.id));
    if (withDims.length === 0 || withoutDims.length === 0) continue;

    for (const uGen of withoutDims) {
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;
      if (!uStart) continue;

      let bestSource: any = null;
      let bestDist = Infinity;

      for (const rGen of withDims) {
        const rStart = rGen.production_start ? new Date(rGen.production_start).getFullYear() : null;
        if (!rStart) continue;
        const dist = Math.abs(uStart - rStart);
        if (dist <= 5 && dist < bestDist) { bestDist = dist; bestSource = rGen; }
      }

      if (!bestSource) continue;
      const sourceDim = updatedDimGenIds.get(bestSource.id);
      if (!sourceDim) continue;

      // Only propagate a few safe columns cross-brand
      const row: any = { generation_id: uGen.id };
      let fields = 0;
      if (sourceDim.trunk_volume_liters) { row.trunk_volume_liters = sourceDim.trunk_volume_liters; fields++; }
      if (sourceDim.fuel_tank_liters) { row.fuel_tank_liters = sourceDim.fuel_tank_liters; fields++; }
      if (sourceDim.seating_capacity) { row.seating_capacity = sourceDim.seating_capacity; fields++; }

      if (fields > 0) {
        dimsPropagated.push(row);
        updatedDimGenIds.set(uGen.id, row);
        stats.phase3DimsPropagated++;
      }
    }
  }

  console.log(`  Platform dims propagated: ${stats.phase3DimsPropagated}`);

  if (!DRY_RUN && dimsPropagated.length > 0) {
    let upserted = 0;
    for (let i = 0; i < dimsPropagated.length; i += BATCH_SIZE) {
      const batch = dimsPropagated.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('interior_dimensions').upsert(batch, { onConflict: 'generation_id' });
      if (error) console.error(`  Platform dims batch error at ${i}: ${error.message}`);
      else upserted += batch.length;
    }
    console.log(`  Upserted: ${upserted}`);
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('  ENRICH RESULTS');
  console.log('='.repeat(60));
  console.log(`  Phase 1 (raw_data dims):      ${stats.phase1DimsCreated} rows, ${stats.phase1FieldsFilled} fields`);
  console.log(`  Phase 2 (safety re-propagate): ${stats.phase2SafetyPropagated} → ${newSafety.length} new`);
  console.log(`  Phase 3 (platform dims):       ${stats.phase3DimsPropagated}`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'enrich-raw-data-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
