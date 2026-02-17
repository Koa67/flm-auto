/**
 * FLM AUTO — Interior Dimensions Extractor
 * Extracts interior dimension data from third_party_specs (343k rows, 100% coverage)
 * and populates the interior_dimensions table
 *
 * Target: 50 → 2,000 generations with interior dimensions
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/extract-interior-dimensions.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function paginateAll(table: string, select: string, filters?: Record<string, any>): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (filters) {
      for (const [key, val] of Object.entries(filters)) {
        query = query.eq(key, val);
      }
    }
    const { data } = await query;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

// Parse dimension value from spec string
function parseMm(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val);
  const clean = str.replace(/,/g, '').trim();

  // "1,432 mm" or "1432mm" or "1432"
  const mmMatch = clean.match(/(\d+)\s*mm/i);
  if (mmMatch) return parseInt(mmMatch[1]);

  // "56.4 in" → convert inches to mm
  const inMatch = clean.match(/([\d.]+)\s*in/i);
  if (inMatch) return Math.round(parseFloat(inMatch[1]) * 25.4);

  // "143.2 cm" → convert to mm
  const cmMatch = clean.match(/([\d.]+)\s*cm/i);
  if (cmMatch) return Math.round(parseFloat(cmMatch[1]) * 10);

  // Plain number (assume mm if > 100, assume inches if < 100)
  const numMatch = clean.match(/^([\d.]+)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    if (num > 100) return Math.round(num);
    if (num > 10) return Math.round(num * 25.4); // inches
  }

  return null;
}

// Parse liters value
function parseLiters(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val);
  const clean = str.replace(/,/g, '').trim();

  // "450 l" or "450 liters" or "450L"
  const lMatch = clean.match(/([\d.]+)\s*(?:l|liters?|litres?)/i);
  if (lMatch) return Math.round(parseFloat(lMatch[1]));

  // "15.9 cu.ft" → convert to liters
  const cuftMatch = clean.match(/([\d.]+)\s*(?:cu\.?\s*ft|cubic\s*feet)/i);
  if (cuftMatch) return Math.round(parseFloat(cuftMatch[1]) * 28.3168);

  // Plain number > 10 (assume liters)
  const numMatch = clean.match(/^([\d.]+)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    if (num > 10) return Math.round(num);
  }

  return null;
}

// Map spec_type names to our dimension fields
const SPEC_MAPPINGS: Record<string, string> = {
  // Headroom — exact matches from DB
  'headroom_front_mm': 'front_headroom_mm',
  'headroom_rear_mm': 'rear_headroom_mm',
  'front_headroom': 'front_headroom_mm',
  'front headroom': 'front_headroom_mm',
  'headroom_front': 'front_headroom_mm',
  'rear_headroom': 'rear_headroom_mm',
  'rear headroom': 'rear_headroom_mm',
  'headroom_rear': 'rear_headroom_mm',

  // Legroom — exact matches from DB
  'legroom_front_mm': 'front_legroom_mm',
  'legroom_rear_mm': 'rear_legroom_mm',
  'us_front_legroom': 'front_legroom_mm',
  'us_rear_seat_legroom': 'rear_legroom_mm',
  'us_third_row_legroom': 'rear_legroom_mm',
  'front_legroom': 'front_legroom_mm',
  'front legroom': 'front_legroom_mm',
  'legroom_front': 'front_legroom_mm',
  'rear_legroom': 'rear_legroom_mm',
  'rear legroom': 'rear_legroom_mm',
  'legroom_rear': 'rear_legroom_mm',

  // Shoulder room — exact matches from DB
  'shoulder_room_front_mm': 'front_shoulder_room_mm',
  'shoulder_room_rear_mm': 'rear_shoulder_room_mm',
  'us_front_shoulder_room': 'front_shoulder_room_mm',
  'us_rear_shoulder_room': 'rear_shoulder_room_mm',
  'us_third_row_shoulder_room': 'rear_shoulder_room_mm',
  'front_shoulder_room': 'front_shoulder_room_mm',
  'rear_shoulder_room': 'rear_shoulder_room_mm',
  'shoulder_room_front': 'front_shoulder_room_mm',
  'shoulder_room_rear': 'rear_shoulder_room_mm',

  // Hip room
  'front_hip_room': 'front_hip_room_mm',
  'rear_hip_room': 'rear_hip_room_mm',
  'hip_room_front': 'front_hip_room_mm',
  'hip_room_rear': 'rear_hip_room_mm',

  // Elbow room
  'front_elbow_room': 'front_elbow_room_mm',
  'rear_elbow_room': 'rear_elbow_room_mm',
  'elbow_room_front': 'front_elbow_room_mm',
  'elbow_room_rear': 'rear_elbow_room_mm',

  // Cargo — mapped to actual DB column names
  'cargo_volume_liters': 'trunk_volume_liters',
  'trunk_boot_space_minimum': 'trunk_volume_liters',
  'trunk_boot_space_maximum': 'trunk_volume_max_liters',
  'us_trunk_boot_capacity': 'trunk_volume_liters',
  'cargo_volume': 'trunk_volume_liters',
  'trunk_volume': 'trunk_volume_liters',
  'boot_volume': 'trunk_volume_liters',
  'luggage_capacity': 'trunk_volume_liters',
  'cargo_volume_max': 'trunk_volume_max_liters',
  'frunk_volume': 'frunk_volume_liters',
};

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Interior Dimensions Extractor');
  console.log('  Source: third_party_specs → interior_dimensions');
  console.log('  Target: 50 → 2,000 generations');
  console.log('═══════════════════════════════════════════════════════\n');

  // Check existing dimensions
  const { count: existingCount } = await supabase.from('interior_dimensions').select('*', { count: 'exact', head: true });
  console.log(`Existing interior_dimensions rows: ${existingCount || 0}\n`);

  // Get existing gen IDs in interior_dimensions
  const existing = await paginateAll('interior_dimensions', 'generation_id');
  const existingGenIds = new Set(existing.map(e => e.generation_id));

  // First, discover what spec types exist related to dimensions
  console.log('Discovering relevant spec types...');
  const dimensionKeywords = [
    'headroom', 'head room', 'legroom', 'leg room',
    'shoulder', 'hip room', 'elbow',
    'cargo', 'trunk', 'boot', 'luggage',
    'frunk', 'cabin',
  ];

  const relevantSpecTypes = new Set<string>();

  for (const keyword of dimensionKeywords) {
    const { data } = await supabase
      .from('third_party_specs')
      .select('spec_type')
      .ilike('spec_type', `%${keyword}%`)
      .limit(100);
    if (data) {
      data.forEach(d => relevantSpecTypes.add(d.spec_type));
    }
  }

  console.log(`Found ${relevantSpecTypes.size} relevant spec types:`);
  for (const st of [...relevantSpecTypes].sort()) {
    console.log(`  - ${st}`);
  }
  console.log();

  // Fetch all relevant specs
  console.log('Loading relevant specs...');
  const allSpecs: any[] = [];

  for (const specType of relevantSpecTypes) {
    let page = 0;
    while (true) {
      const { data } = await supabase
        .from('third_party_specs')
        .select('generation_id, spec_type, spec_value, source')
        .eq('spec_type', specType)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      allSpecs.push(...data);
      if (data.length < 1000) break;
      page++;
    }
  }

  console.log(`Loaded ${allSpecs.length} relevant spec rows\n`);

  // Group by generation_id
  const specsByGen = new Map<string, any[]>();
  for (const spec of allSpecs) {
    if (!spec.generation_id) continue;
    if (!specsByGen.has(spec.generation_id)) specsByGen.set(spec.generation_id, []);
    specsByGen.get(spec.generation_id)!.push(spec);
  }

  console.log(`Generations with dimension specs: ${specsByGen.size}\n`);

  // Process each generation
  let saved = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();
  const genEntries = [...specsByGen.entries()];

  for (let i = 0; i < genEntries.length; i++) {
    const [genId, specs] = genEntries[i];

    // Skip if already has dimensions
    if (existingGenIds.has(genId)) {
      skipped++;
      continue;
    }

    // Build dimension record from specs
    const dims: Record<string, any> = { generation_id: genId };
    let hasAnyDim = false;
    let source = '';

    for (const spec of specs) {
      const specTypeLower = spec.spec_type.toLowerCase().trim();
      const fieldName = SPEC_MAPPINGS[specTypeLower];

      if (fieldName) {
        let value: number | null;
        if (fieldName.includes('liters')) {
          value = parseLiters(spec.spec_value);
        } else {
          value = parseMm(spec.spec_value);
        }

        if (value !== null && value > 0) {
          // Sanity checks
          if (fieldName.includes('_mm') && (value < 50 || value > 3000)) continue;
          if (fieldName.includes('liters') && (value < 5 || value > 5000)) continue;

          dims[fieldName] = value;
          hasAnyDim = true;
          if (!source && spec.source) source = spec.source;
        }
      }
    }

    if (hasAnyDim) {
      const { error } = await supabase.from('interior_dimensions').upsert(dims, {
        onConflict: 'generation_id',
      });

      if (!error) {
        saved++;
        existingGenIds.add(genId);
      } else {
        errors++;
        if (errors <= 5) {
          console.log(`  ERROR: ${error.message} | dims: ${JSON.stringify(dims)}`);
        }
      }
    }

    // Progress
    if ((i + 1) % 500 === 0 || i === genEntries.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ` +
        `${i + 1}/${genEntries.length} | ` +
        `Saved: ${saved}, Skipped: ${skipped}, Errors: ${errors} | ` +
        `Duration: ${Math.floor(elapsed)}s`
      );
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const totalDims = (existingCount || 0) + saved;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  INTERIOR DIMENSIONS EXTRACTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Processed:      ${genEntries.length} generations`);
  console.log(`  New saved:      +${saved}`);
  console.log(`  Skipped:        ${skipped}`);
  console.log(`  Total dims:     ${totalDims}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Duration:       ${Math.floor(elapsed)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
