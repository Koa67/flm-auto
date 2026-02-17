/**
 * FLM AUTO — Malus Écologique Calculator
 * Calculates French ecological tax (malus) from CO2 emissions in third_party_specs
 * Target: ≥2,000 generations with malus
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/calculate-malus.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function paginateAll(table: string, select: string, filters?: { column: string; op: string; value: any }[]): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (filters) {
      for (const f of filters) {
        if (f.op === 'ilike') query = query.ilike(f.column, f.value);
        if (f.op === 'eq') query = query.eq(f.column, f.value);
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

// French malus 2024 barème (CO2 g/km → EUR)
// Source: https://www.service-public.fr/particuliers/vosdroits/F35947
function calculateMalus2024(co2: number): number {
  if (co2 < 118) return 0;
  // Simplified progressive scale
  const BAREME: [number, number][] = [
    [118, 50], [119, 75], [120, 100], [121, 125], [122, 150],
    [123, 170], [124, 190], [125, 210], [126, 230], [127, 240],
    [128, 260], [129, 280], [130, 310], [131, 330], [132, 360],
    [133, 400], [134, 450], [135, 540], [136, 650], [137, 740],
    [138, 818], [139, 898], [140, 983], [141, 1074], [142, 1172],
    [143, 1276], [144, 1386], [145, 1504], [146, 1629], [147, 1761],
    [148, 1901], [149, 2049], [150, 2205], [151, 2370], [152, 2544],
    [153, 2726], [154, 2918], [155, 3119], [156, 3331], [157, 3552],
    [158, 3784], [159, 4026], [160, 4279], [161, 4543], [162, 4818],
    [163, 5105], [164, 5404], [165, 5715], [166, 6039], [167, 6375],
    [168, 6724], [169, 7086], [170, 7462], [171, 7851], [172, 8254],
    [173, 8671], [174, 9103], [175, 9550], [176, 10011], [177, 10488],
    [178, 10980], [179, 11488], [180, 12012], [181, 12552], [182, 13109],
    [183, 13682], [184, 14273], [185, 14881], [186, 15506], [187, 16149],
    [188, 16810], [189, 17490], [190, 18188], [191, 18905], [192, 19641],
    [193, 20396], [194, 21171], [195, 21966], [196, 22781], [197, 23616],
    [198, 24472], [199, 25349], [200, 26247], [201, 27166], [202, 28107],
    [203, 29070], [204, 30056], [205, 31063], [206, 32093], [207, 33147],
    [208, 34224], [209, 35324], [210, 36447], [211, 37595], [212, 38767],
    [213, 39964], [214, 41185], [215, 42431], [216, 43703], [217, 45000],
    [218, 46323], [219, 47672], [220, 49047], [221, 50449], [222, 51878],
    [223, 53334], [224, 54817],
  ];
  for (const [threshold, malus] of BAREME) {
    if (co2 <= threshold) return malus;
  }
  return 60000; // Plafond 2024
}

// 2025 barème: seuil abaissé de 5 g/km
function calculateMalus2025(co2: number): number {
  if (co2 < 113) return 0;
  // Shift threshold by -5
  return calculateMalus2024(co2 + 5);
}

function parseCO2(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/,/g, '').trim();
  // "123 g/km" or "123g/km" or "123"
  const match = str.match(/([\d.]+)\s*(?:g\/km|g|gkm)?/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (num > 0 && num < 1000) return Math.round(num);
  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Malus Écologique Calculator');
  console.log('  Target: ≥2,000 generations with malus');
  console.log('═══════════════════════════════════════════════════════\n');

  // Find CO2 spec types
  console.log('Searching for CO2-related spec types...');
  const co2Types: string[] = [];
  const keywords = ['co2', 'emission', 'co₂'];

  for (const kw of keywords) {
    const { data } = await supabase
      .from('third_party_specs')
      .select('spec_type')
      .ilike('spec_type', `%${kw}%`)
      .limit(100);
    if (data) {
      for (const d of data) {
        const st = d.spec_type.toLowerCase();
        if (st.startsWith('how_') || st.startsWith('what_')) continue;
        co2Types.push(d.spec_type);
      }
    }
  }

  const uniqueTypes = [...new Set(co2Types)];
  console.log(`Found ${uniqueTypes.length} CO2 spec types:`);
  for (const t of uniqueTypes) console.log(`  - ${t}`);
  console.log();

  // Load all CO2 data
  console.log('Loading CO2 data...');
  const co2Data: { generation_id: string; spec_type: string; spec_value: string }[] = [];

  for (const specType of uniqueTypes) {
    let page = 0;
    while (true) {
      const { data } = await supabase
        .from('third_party_specs')
        .select('generation_id, spec_type, spec_value')
        .eq('spec_type', specType)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data || data.length === 0) break;
      co2Data.push(...data);
      if (data.length < 1000) break;
      page++;
    }
  }

  console.log(`Loaded ${co2Data.length} CO2 spec rows\n`);

  // Group by generation, pick best CO2 value
  const co2ByGen = new Map<string, number>();
  for (const spec of co2Data) {
    const val = parseCO2(spec.spec_value);
    if (!val || val <= 0) continue;

    const existing = co2ByGen.get(spec.generation_id);
    if (!existing || val < existing) {
      // Use lowest CO2 (most favorable for the vehicle)
      co2ByGen.set(spec.generation_id, val);
    }
  }

  console.log(`Generations with valid CO2: ${co2ByGen.size}\n`);

  // Calculate and insert malus
  console.log('Calculating malus...\n');

  let inserted = 0;
  let updated = 0;
  let zeroMalus = 0;
  let errors = 0;
  let idx = 0;

  for (const [genId, co2] of co2ByGen) {
    const malus2024 = calculateMalus2024(co2);
    const malus2025 = calculateMalus2025(co2);

    if (malus2024 === 0 && malus2025 === 0) {
      zeroMalus++;
    }

    // Upsert into vehicle_pricing
    const { error } = await supabase.from('vehicle_pricing').upsert({
      generation_id: genId,
      engine_variant_id: null,
      co2_gkm: co2,
      malus_2024_eur: malus2024,
      malus_2025_eur: malus2025,
    }, {
      onConflict: 'generation_id,engine_variant_id',
    });

    if (!error) {
      inserted++;
    } else {
      errors++;
      if (errors <= 5) console.log(`  ERROR: ${error.message}`);
    }

    idx++;
    if (idx % 500 === 0 || idx === co2ByGen.size) {
      console.log(`  [${idx}/${co2ByGen.size}] Inserted: ${inserted}, Zero malus: ${zeroMalus}, Errors: ${errors}`);
    }
  }

  // Final count
  const { count: finalCount } = await supabase.from('vehicle_pricing').select('*', { count: 'exact', head: true });
  const { count: withMalus } = await supabase
    .from('vehicle_pricing')
    .select('*', { count: 'exact', head: true })
    .gt('malus_2024_eur', 0);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  MALUS CALCULATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  CO2 specs found:        ${co2Data.length}`);
  console.log(`  Generations with CO2:   ${co2ByGen.size}`);
  console.log(`  Pricing rows created:   ${inserted}`);
  console.log(`  With malus > 0:         ${withMalus}`);
  console.log(`  Zero malus (low CO2):   ${zeroMalus}`);
  console.log(`  Errors:                 ${errors}`);
  console.log(`  Total vehicle_pricing:  ${finalCount}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
