/**
 * FLM AUTO — Trunk Volume Extractor
 * Extracts trunk/boot volume data from how_much_trunk_boot_space_* specs
 * These have the values we need but have model-specific spec_type names
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/extract-trunk-volumes.ts
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

function parseLiters(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/,/g, '').trim();

  // "450 l" or "450 liters"
  const lMatch = str.match(/([\d.]+)\s*(?:l|liters?|litres?)/i);
  if (lMatch) return Math.round(parseFloat(lMatch[1]));

  // "15.9 cu.ft" → convert to liters
  const cuftMatch = str.match(/([\d.]+)\s*(?:cu\.?\s*ft|cubic\s*feet)/i);
  if (cuftMatch) return Math.round(parseFloat(cuftMatch[1]) * 28.3168);

  // Plain number (assume liters if > 10)
  const numMatch = str.match(/^([\d.]+)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    if (num > 10 && num < 5000) return Math.round(num);
  }

  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Trunk Volume Extractor');
  console.log('  Source: how_much_trunk_boot_space_* specs');
  console.log('═══════════════════════════════════════════════════════\n');

  // Get all trunk_boot_space specs
  console.log('Loading trunk_boot_space specs...');
  const trunkSpecs: any[] = [];

  // Get trunk_boot_space_minimum and maximum
  for (const specType of ['trunk_boot_space_minimum', 'trunk_boot_space_maximum']) {
    let page = 0;
    while (true) {
      const { data } = await supabase
        .from('third_party_specs')
        .select('generation_id, spec_type, spec_value')
        .eq('spec_type', specType)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      trunkSpecs.push(...data);
      if (data.length < 1000) break;
      page++;
    }
  }

  // Also get us_trunk_boot_capacity and us_trunk_boot_first_row
  for (const specType of ['us_trunk_boot_capacity', 'us_trunk_boot_first_row']) {
    let page = 0;
    while (true) {
      const { data } = await supabase
        .from('third_party_specs')
        .select('generation_id, spec_type, spec_value')
        .eq('spec_type', specType)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      trunkSpecs.push(...data);
      if (data.length < 1000) break;
      page++;
    }
  }

  // Also get cargo_volume_liters
  {
    let page = 0;
    while (true) {
      const { data } = await supabase
        .from('third_party_specs')
        .select('generation_id, spec_type, spec_value')
        .eq('spec_type', 'cargo_volume_liters')
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      trunkSpecs.push(...data);
      if (data.length < 1000) break;
      page++;
    }
  }

  // Get all how_much_trunk_boot_space_* specs
  console.log('Loading how_much_trunk_boot_space specs...');
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('third_party_specs')
      .select('generation_id, spec_type, spec_value')
      .ilike('spec_type', 'how_much_trunk_boot_space_%')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    trunkSpecs.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`Total trunk specs found: ${trunkSpecs.length}`);

  // Group by generation
  const byGen = new Map<string, { min: number | null; max: number | null }>();

  for (const spec of trunkSpecs) {
    if (!spec.generation_id) continue;

    const val = parseLiters(spec.spec_value);
    if (!val) continue;

    if (!byGen.has(spec.generation_id)) {
      byGen.set(spec.generation_id, { min: null, max: null });
    }

    const entry = byGen.get(spec.generation_id)!;
    const st = spec.spec_type.toLowerCase();

    if (st.includes('maximum') || st.includes('max') || st === 'us_trunk_boot_first_row') {
      if (!entry.max || val > entry.max) entry.max = val;
    } else {
      if (!entry.min || val < entry.min) entry.min = val;
      // Also update max if min > max
      if (entry.max && entry.min && entry.min > entry.max) {
        const tmp = entry.max;
        entry.max = entry.min;
        entry.min = tmp;
      }
    }
  }

  console.log(`Generations with trunk data: ${byGen.size}\n`);

  // Get existing dimensions to know which to update vs insert
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
      // Only update if we have new data
      const updates: Record<string, any> = {};
      if (volumes.min && !existingRow.trunk_volume_liters) {
        updates.trunk_volume_liters = volumes.min;
      }
      if (volumes.max && !existingRow.trunk_volume_max_liters) {
        updates.trunk_volume_max_liters = volumes.max;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('interior_dimensions')
          .update(updates)
          .eq('generation_id', genId);

        if (!error) updated++;
        else errors++;
      } else {
        skipped++;
      }
    } else {
      // Insert new row
      const row: Record<string, any> = { generation_id: genId };
      if (volumes.min) row.trunk_volume_liters = volumes.min;
      if (volumes.max) row.trunk_volume_max_liters = volumes.max;

      const { error } = await supabase
        .from('interior_dimensions')
        .insert(row);

      if (!error) inserted++;
      else {
        errors++;
        if (errors <= 3) console.log(`  ERROR: ${error.message}`);
      }
    }

    idx++;
    if (idx % 500 === 0 || idx === byGen.size) {
      console.log(`[${idx}/${byGen.size}] Updated: ${updated}, Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
    }
  }

  const totalRows = existing.length + inserted;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TRUNK VOLUME EXTRACTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Updated:   ${updated}`);
  console.log(`  Inserted:  ${inserted}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Total rows: ~${totalRows}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
