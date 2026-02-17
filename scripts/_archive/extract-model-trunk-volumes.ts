/**
 * FLM AUTO — Model-Specific Trunk Volume Extractor
 * Parses the how_much_trunk_boot_space_* spec_type names to extract model-specific data
 * These spec_types encode the model/year in the name and contain trunk volume tables
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/extract-model-trunk-volumes.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

function extractTrunkValues(val: any): { min: number | null; max: number | null } {
  if (val === null || val === undefined) return { min: null, max: null };
  const str = String(val).replace(/,/g, '').trim();

  const values: number[] = [];

  // Match "XXX l" patterns
  const lMatches = str.matchAll(/([\d.]+)\s*(?:l|liters?|litres?)/gi);
  for (const m of lMatches) {
    const v = parseFloat(m[1]);
    if (v > 10 && v < 5000) values.push(Math.round(v));
  }

  // Match "XXX cu.ft" patterns
  const cuftMatches = str.matchAll(/([\d.]+)\s*(?:cu\.?\s*ft|cubic\s*feet)/gi);
  for (const m of cuftMatches) {
    const v = parseFloat(m[1]) * 28.3168;
    if (v > 10 && v < 5000) values.push(Math.round(v));
  }

  // Match standalone numbers (assume liters if reasonable range)
  if (values.length === 0) {
    const nums = str.matchAll(/([\d.]+)/g);
    for (const m of nums) {
      const v = parseFloat(m[1]);
      if (v > 50 && v < 3000) values.push(Math.round(v));
    }
  }

  if (values.length === 0) return { min: null, max: null };

  values.sort((a, b) => a - b);
  return {
    min: values[0],
    max: values.length > 1 ? values[values.length - 1] : null,
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Model Trunk Volume Extractor');
  console.log('═══════════════════════════════════════════════════════\n');

  // Load all how_much_trunk_boot_space specs
  console.log('Loading model-specific trunk specs...');
  const allSpecs: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('third_party_specs')
      .select('generation_id, spec_type, spec_value')
      .ilike('spec_type', 'how_much_trunk_boot_space_%')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allSpecs.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`Model trunk specs: ${allSpecs.length}`);

  // Group by generation, extracting actual trunk values from spec_value
  const byGen = new Map<string, { min: number | null; max: number | null }>();

  for (const spec of allSpecs) {
    if (!spec.generation_id || !spec.spec_value) continue;

    const { min, max } = extractTrunkValues(spec.spec_value);
    if (!min && !max) continue;

    if (!byGen.has(spec.generation_id)) {
      byGen.set(spec.generation_id, { min: null, max: null });
    }

    const entry = byGen.get(spec.generation_id)!;
    if (min && (!entry.min || min < entry.min)) entry.min = min;
    if (max && (!entry.max || max > entry.max)) entry.max = max;
    if (!entry.max && entry.min && min && min !== entry.min) {
      // If we have two different min values, use the larger as max
      entry.max = Math.max(entry.min, min);
      entry.min = Math.min(entry.min, min);
    }
  }

  console.log(`Generations with model trunk data: ${byGen.size}`);

  // Get existing dimensions
  const existing = await paginateAll('interior_dimensions', 'generation_id, trunk_volume_liters, trunk_volume_max_liters');
  const existingMap = new Map(existing.map(e => [e.generation_id, e]));

  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let idx = 0;

  for (const [genId, volumes] of byGen) {
    const existingRow = existingMap.get(genId);

    if (existingRow) {
      const updates: Record<string, any> = {};
      if (volumes.min && !existingRow.trunk_volume_liters) updates.trunk_volume_liters = volumes.min;
      if (volumes.max && !existingRow.trunk_volume_max_liters) updates.trunk_volume_max_liters = volumes.max;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('interior_dimensions').update(updates).eq('generation_id', genId);
        if (!error) updated++; else errors++;
      } else {
        skipped++;
      }
    } else {
      const row: Record<string, any> = { generation_id: genId };
      if (volumes.min) row.trunk_volume_liters = volumes.min;
      if (volumes.max) row.trunk_volume_max_liters = volumes.max;

      const { error } = await supabase.from('interior_dimensions').insert(row);
      if (!error) inserted++;
      else { errors++; if (errors <= 3) console.log(`  ERROR: ${error.message}`); }
    }

    idx++;
    if (idx % 200 === 0 || idx === byGen.size) {
      console.log(`[${idx}/${byGen.size}] Updated: ${updated}, Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
    }
  }

  const totalRows = existing.length + inserted;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  MODEL TRUNK VOLUME EXTRACTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Updated:    ${updated}`);
  console.log(`  Inserted:   ${inserted}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Errors:     ${errors}`);
  console.log(`  Total rows: ~${totalRows}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
