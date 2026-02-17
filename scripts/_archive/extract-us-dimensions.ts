/**
 * FLM AUTO — US Dimensions Extractor
 * Extracts us_front_legroom, us_front_shoulder_room etc. from third_party_specs
 * These have values in inches that need conversion to mm
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/extract-us-dimensions.ts
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

function parseMm(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/,/g, '').trim();

  // "1,432 mm" or "1432mm"
  const mmMatch = str.match(/([\d.]+)\s*mm/i);
  if (mmMatch) return Math.round(parseFloat(mmMatch[1]));

  // "56.4 in" → mm
  const inMatch = str.match(/([\d.]+)\s*(?:in|inches?|")/i);
  if (inMatch) return Math.round(parseFloat(inMatch[1]) * 25.4);

  // "143.2 cm" → mm
  const cmMatch = str.match(/([\d.]+)\s*cm/i);
  if (cmMatch) return Math.round(parseFloat(cmMatch[1]) * 10);

  // Plain number — context-dependent
  const numMatch = str.match(/^([\d.]+)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    if (num > 100 && num < 3000) return Math.round(num); // mm
    if (num > 20 && num <= 100) return Math.round(num * 25.4); // inches
  }

  return null;
}

function parseLiters(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/,/g, '').trim();

  const lMatch = str.match(/([\d.]+)\s*(?:l|liters?|litres?)/i);
  if (lMatch) return Math.round(parseFloat(lMatch[1]));

  const cuftMatch = str.match(/([\d.]+)\s*(?:cu\.?\s*ft|cubic\s*feet)/i);
  if (cuftMatch) return Math.round(parseFloat(cuftMatch[1]) * 28.3168);

  const numMatch = str.match(/^([\d.]+)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    if (num > 5 && num < 100) return Math.round(num * 28.3168); // cu ft → liters
    if (num >= 100 && num < 5000) return Math.round(num);
  }

  return null;
}

const US_MAPPINGS: Record<string, { field: string; parser: 'mm' | 'liters' }> = {
  'us_front_legroom': { field: 'front_legroom_mm', parser: 'mm' },
  'us_rear_seat_legroom': { field: 'rear_legroom_mm', parser: 'mm' },
  'us_third_row_legroom': { field: 'rear_legroom_mm', parser: 'mm' },
  'us_front_shoulder_room': { field: 'front_shoulder_room_mm', parser: 'mm' },
  'us_rear_shoulder_room': { field: 'rear_shoulder_room_mm', parser: 'mm' },
  'us_third_row_shoulder_room': { field: 'rear_shoulder_room_mm', parser: 'mm' },
  'us_trunk_boot_capacity': { field: 'trunk_volume_liters', parser: 'liters' },
  'us_trunk_boot_first_row': { field: 'trunk_volume_max_liters', parser: 'liters' },
  'us_cargo_box_inside_height': { field: 'rear_hip_room_mm', parser: 'mm' }, // approximate
  'us_cargo_width': { field: 'rear_shoulder_room_mm', parser: 'mm' },
};

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — US Dimensions Extractor');
  console.log('═══════════════════════════════════════════════════════\n');

  // Load US specs
  console.log('Loading US dimension specs...');
  const allSpecs: any[] = [];

  for (const specType of Object.keys(US_MAPPINGS)) {
    let page = 0;
    while (true) {
      const { data } = await supabase
        .from('third_party_specs')
        .select('generation_id, spec_type, spec_value')
        .eq('spec_type', specType)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      allSpecs.push(...data);
      if (data.length < 1000) break;
      page++;
    }
  }

  console.log(`US dimension specs: ${allSpecs.length}`);

  // Group by generation
  const byGen = new Map<string, Record<string, any>>();

  for (const spec of allSpecs) {
    if (!spec.generation_id) continue;

    const mapping = US_MAPPINGS[spec.spec_type];
    if (!mapping) continue;

    const val = mapping.parser === 'mm' ? parseMm(spec.spec_value) : parseLiters(spec.spec_value);
    if (!val) continue;

    // Sanity check
    if (mapping.parser === 'mm' && (val < 200 || val > 3000)) continue;
    if (mapping.parser === 'liters' && (val < 5 || val > 5000)) continue;

    if (!byGen.has(spec.generation_id)) byGen.set(spec.generation_id, {});
    byGen.get(spec.generation_id)![mapping.field] = val;
  }

  console.log(`Generations with US data: ${byGen.size}\n`);

  // Get existing dimensions
  const existing = await paginateAll('interior_dimensions',
    'generation_id, front_legroom_mm, rear_legroom_mm, front_shoulder_room_mm, rear_shoulder_room_mm, trunk_volume_liters, trunk_volume_max_liters, rear_hip_room_mm');
  const existingMap = new Map(existing.map(e => [e.generation_id, e]));

  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let idx = 0;

  for (const [genId, dims] of byGen) {
    const existingRow = existingMap.get(genId);

    if (existingRow) {
      // Only update fields that are null
      const updates: Record<string, any> = {};
      for (const [field, value] of Object.entries(dims)) {
        if (existingRow[field] === null || existingRow[field] === undefined) {
          updates[field] = value;
        }
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
      const row: Record<string, any> = { generation_id: genId, ...dims };

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
    if (idx % 200 === 0 || idx === byGen.size) {
      console.log(`[${idx}/${byGen.size}] Updated: ${updated}, Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
    }
  }

  const totalRows = existing.length + inserted;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  US DIMENSIONS EXTRACTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Updated:    ${updated}`);
  console.log(`  Inserted:   ${inserted}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Errors:     ${errors}`);
  console.log(`  Total rows: ~${totalRows}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
