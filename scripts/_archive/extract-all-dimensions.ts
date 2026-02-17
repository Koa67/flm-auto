/**
 * FLM AUTO — All Dimensions Extractor (catch-all)
 * Searches for ANY spec that might contain dimension data
 * Fills remaining gaps to push towards 2,000 rows
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/extract-all-dimensions.ts
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

// More dimension keywords to search for
const DIMENSION_KEYWORDS = [
  'headroom', 'legroom', 'shoulder', 'hip_room', 'elbow',
  'cabin_width', 'cabin_length', 'cabin_height',
  'interior_width', 'interior_length', 'interior_height',
  'passenger_volume', 'interior_volume',
  'front_row', 'rear_row', 'second_row', 'third_row',
  'seat_height', 'seating_capacity', 'seats',
  'fuel_tank', 'tank_capacity',
  'load_area', 'load_length', 'load_width', 'load_height',
  'wheelbase', 'ground_clearance',
];

function parseMm(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/,/g, '').trim();
  const mmMatch = str.match(/([\d.]+)\s*mm/i);
  if (mmMatch) return Math.round(parseFloat(mmMatch[1]));
  const inMatch = str.match(/([\d.]+)\s*(?:in|inches?|")/i);
  if (inMatch) return Math.round(parseFloat(inMatch[1]) * 25.4);
  const cmMatch = str.match(/([\d.]+)\s*cm/i);
  if (cmMatch) return Math.round(parseFloat(cmMatch[1]) * 10);
  const numMatch = str.match(/^([\d.]+)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    if (num > 100 && num < 3000) return Math.round(num);
    if (num > 20 && num <= 100) return Math.round(num * 25.4);
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
    if (num >= 20 && num < 5000) return Math.round(num);
  }
  return null;
}

function parseInt2(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — All Dimensions Catch-All Extractor');
  console.log('═══════════════════════════════════════════════════════\n');

  // Check current count
  const { count: currentCount } = await supabase.from('interior_dimensions').select('*', { count: 'exact', head: true });
  console.log(`Current interior_dimensions rows: ${currentCount}\n`);

  // Get existing gen IDs
  const existing = await paginateAll('interior_dimensions', 'generation_id, trunk_volume_liters, fuel_tank_liters, seating_capacity');
  const existingMap = new Map(existing.map(e => [e.generation_id, e]));

  // Find all dimension-related spec types
  console.log('Searching for additional dimension specs...');
  const additionalSpecs: any[] = [];

  for (const keyword of DIMENSION_KEYWORDS) {
    const { data } = await supabase
      .from('third_party_specs')
      .select('spec_type')
      .ilike('spec_type', `%${keyword}%`)
      .limit(50);

    if (data) {
      for (const d of data) {
        const st = d.spec_type.toLowerCase();
        // Skip the how_much/how_fast/what_is prefixed ones
        if (st.startsWith('how_') || st.startsWith('what_')) continue;
        additionalSpecs.push(d.spec_type);
      }
    }
  }

  const uniqueSpecTypes = [...new Set(additionalSpecs)];
  console.log(`Found ${uniqueSpecTypes.length} additional spec types\n`);

  // Load data for these spec types
  const specData: any[] = [];
  for (const specType of uniqueSpecTypes) {
    let page = 0;
    while (true) {
      const { data } = await supabase
        .from('third_party_specs')
        .select('generation_id, spec_type, spec_value')
        .eq('spec_type', specType)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      specData.push(...data);
      if (data.length < 1000) break;
      page++;
    }
  }

  console.log(`Loaded ${specData.length} spec rows\n`);

  // Map spec types to interior_dimensions fields
  const typeToField: Record<string, { field: string; parser: 'mm' | 'liters' | 'int' }> = {};

  for (const st of uniqueSpecTypes) {
    const lower = st.toLowerCase();
    if (lower.includes('fuel_tank') || lower.includes('tank_capacity')) {
      typeToField[st] = { field: 'fuel_tank_liters', parser: 'liters' };
    } else if (lower.includes('seating_capacity') || lower.includes('seats') || lower.includes('number_of_seats')) {
      typeToField[st] = { field: 'seating_capacity', parser: 'int' };
    } else if (lower.includes('passenger_volume') || lower.includes('interior_volume')) {
      typeToField[st] = { field: 'trunk_volume_liters', parser: 'liters' };
    }
    // headroom/legroom etc already handled by previous extractors
  }

  console.log(`Mappable spec types: ${Object.keys(typeToField).length}`);
  for (const [st, { field }] of Object.entries(typeToField)) {
    console.log(`  ${st} → ${field}`);
  }
  console.log();

  // Group by generation
  const byGen = new Map<string, Record<string, any>>();

  for (const spec of specData) {
    if (!spec.generation_id) continue;
    const mapping = typeToField[spec.spec_type];
    if (!mapping) continue;

    let val: number | null;
    if (mapping.parser === 'mm') val = parseMm(spec.spec_value);
    else if (mapping.parser === 'liters') val = parseLiters(spec.spec_value);
    else val = parseInt2(spec.spec_value);

    if (!val || val <= 0) continue;

    // Sanity checks
    if (mapping.field === 'fuel_tank_liters' && (val < 10 || val > 200)) continue;
    if (mapping.field === 'seating_capacity' && (val < 1 || val > 15)) continue;

    if (!byGen.has(spec.generation_id)) byGen.set(spec.generation_id, {});
    byGen.get(spec.generation_id)![mapping.field] = val;
  }

  console.log(`Generations with additional data: ${byGen.size}\n`);

  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let idx = 0;

  for (const [genId, dims] of byGen) {
    const existingRow = existingMap.get(genId);

    if (existingRow) {
      const updates: Record<string, any> = {};
      for (const [field, value] of Object.entries(dims)) {
        if (!existingRow[field]) updates[field] = value;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('interior_dimensions').update(updates).eq('generation_id', genId);
        if (!error) updated++; else errors++;
      } else {
        skipped++;
      }
    } else {
      const row: Record<string, any> = { generation_id: genId, ...dims };
      const { error } = await supabase.from('interior_dimensions').insert(row);
      if (!error) inserted++;
      else { errors++; if (errors <= 3) console.log(`  ERROR: ${error.message}`); }
    }

    idx++;
    if (idx % 200 === 0 || idx === byGen.size) {
      console.log(`[${idx}/${byGen.size}] Updated: ${updated}, Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
    }
  }

  const totalRows = (currentCount || 0) + inserted;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ALL DIMENSIONS EXTRACTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Updated:    ${updated}`);
  console.log(`  Inserted:   ${inserted}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Errors:     ${errors}`);
  console.log(`  Total rows: ~${totalRows}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
