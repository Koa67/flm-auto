/**
 * 19-safety-propagation-v2.ts — Extended safety propagation with shared platforms
 *
 * Builds on 12-safety-propagation.ts by also propagating across DIFFERENT models
 * that share the same platform/architecture.
 *
 * Platform groups (same crash structure → similar safety):
 *   - VW MQB: Golf, Tiguan, Octavia, Leon, A3, Tarraco, Ateca, T-Roc, Karoq
 *   - VW MQB-A0: Polo, Ibiza, Arona, Fabia, Kamiq, T-Cross
 *   - Toyota TNGA-C: Corolla, C-HR, Prius
 *   - Toyota TNGA-K: Camry, RAV4, Highlander
 *   - BMW CLAR: 3 Series, 4 Series, 5 Series, 7 Series, X3, X4, X5, X7
 *   - Volvo SPA: XC60, XC90, S60, S90, V60, V90
 *   - Volvo CMA: XC40, C40
 *   - Hyundai-Kia N3: Tucson, Sportage
 *   - PSA EMP2: 3008, 5008, C5 Aircross, Grandland
 *   - Renault CMF-CD: Megane, Kadjar, Koleos
 *
 * Rules:
 *   - Same platform group
 *   - Overlapping production years (±3 years)
 *   - Only propagate to generations WITHOUT ratings
 *   - Source: 'propagated_platform:{source_gen_id}'
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/19-safety-propagation-v2.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/19-safety-propagation-v2.ts
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
const YEAR_TOLERANCE = 3;
const DATA_DIR = path.resolve(__dirname, '../../data');

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

// Platform groups: brand|model pairs that share crash structure
// Format: { platform: string, members: { brand: string, model: string }[] }
const PLATFORM_GROUPS = [
  {
    platform: 'VW_MQB',
    members: [
      { brand: 'volkswagen', model: 'golf' },
      { brand: 'volkswagen', model: 'tiguan' },
      { brand: 'volkswagen', model: 'passat' },
      { brand: 'volkswagen', model: 't-roc' },
      { brand: 'volkswagen', model: 'touran' },
      { brand: 'skoda', model: 'octavia' },
      { brand: 'skoda', model: 'karoq' },
      { brand: 'skoda', model: 'superb' },
      { brand: 'seat', model: 'leon' },
      { brand: 'seat', model: 'ateca' },
      { brand: 'seat', model: 'tarraco' },
      { brand: 'audi', model: 'a3' },
      { brand: 'audi', model: 'q3' },
    ],
  },
  {
    platform: 'VW_MQB_A0',
    members: [
      { brand: 'volkswagen', model: 'polo' },
      { brand: 'volkswagen', model: 't-cross' },
      { brand: 'seat', model: 'ibiza' },
      { brand: 'seat', model: 'arona' },
      { brand: 'skoda', model: 'fabia' },
      { brand: 'skoda', model: 'kamiq' },
      { brand: 'skoda', model: 'scala' },
      { brand: 'audi', model: 'a1' },
    ],
  },
  {
    platform: 'TOYOTA_TNGA_C',
    members: [
      { brand: 'toyota', model: 'corolla' },
      { brand: 'toyota', model: 'c-hr' },
      { brand: 'toyota', model: 'prius' },
      { brand: 'lexus', model: 'ux' },
    ],
  },
  {
    platform: 'TOYOTA_TNGA_K',
    members: [
      { brand: 'toyota', model: 'camry' },
      { brand: 'toyota', model: 'rav4' },
      { brand: 'toyota', model: 'highlander' },
      { brand: 'lexus', model: 'es' },
      { brand: 'lexus', model: 'rx' },
    ],
  },
  {
    platform: 'BMW_CLAR',
    members: [
      { brand: 'bmw', model: '3 series' },
      { brand: 'bmw', model: '4 series' },
      { brand: 'bmw', model: '5 series' },
      { brand: 'bmw', model: '7 series' },
      { brand: 'bmw', model: 'x3' },
      { brand: 'bmw', model: 'x4' },
      { brand: 'bmw', model: 'x5' },
      { brand: 'bmw', model: 'x7' },
    ],
  },
  {
    platform: 'VOLVO_SPA',
    members: [
      { brand: 'volvo', model: 'xc60' },
      { brand: 'volvo', model: 'xc90' },
      { brand: 'volvo', model: 's60' },
      { brand: 'volvo', model: 's90' },
      { brand: 'volvo', model: 'v60' },
      { brand: 'volvo', model: 'v90' },
    ],
  },
  {
    platform: 'VOLVO_CMA',
    members: [
      { brand: 'volvo', model: 'xc40' },
      { brand: 'volvo', model: 'c40' },
    ],
  },
  {
    platform: 'HYUNDAI_N3',
    members: [
      { brand: 'hyundai', model: 'tucson' },
      { brand: 'kia', model: 'sportage' },
    ],
  },
  {
    platform: 'HYUNDAI_K3',
    members: [
      { brand: 'hyundai', model: 'i30' },
      { brand: 'kia', model: 'ceed' },
      { brand: 'kia', model: "cee'd" },
    ],
  },
  {
    platform: 'HYUNDAI_M3',
    members: [
      { brand: 'hyundai', model: 'santa fe' },
      { brand: 'kia', model: 'sorento' },
    ],
  },
  {
    platform: 'PSA_EMP2',
    members: [
      { brand: 'peugeot', model: '3008' },
      { brand: 'peugeot', model: '5008' },
      { brand: 'citroen', model: 'c5 aircross' },
      { brand: 'opel', model: 'grandland' },
      { brand: 'opel', model: 'grandland x' },
    ],
  },
  {
    platform: 'PSA_CMP',
    members: [
      { brand: 'peugeot', model: '208' },
      { brand: 'peugeot', model: '2008' },
      { brand: 'citroen', model: 'c3' },
      { brand: 'citroen', model: 'c4' },
      { brand: 'opel', model: 'corsa' },
      { brand: 'opel', model: 'mokka' },
    ],
  },
  {
    platform: 'RENAULT_CMF_CD',
    members: [
      { brand: 'renault', model: 'megane' },
      { brand: 'renault', model: 'kadjar' },
      { brand: 'renault', model: 'koleos' },
      { brand: 'nissan', model: 'qashqai' },
      { brand: 'nissan', model: 'x-trail' },
    ],
  },
  {
    platform: 'RENAULT_CMF_B',
    members: [
      { brand: 'renault', model: 'clio' },
      { brand: 'renault', model: 'captur' },
      { brand: 'nissan', model: 'juke' },
      { brand: 'nissan', model: 'micra' },
    ],
  },
  {
    platform: 'MB_MRA2',
    members: [
      { brand: 'mercedes-benz', model: 'c-class' },
      { brand: 'mercedes-benz', model: 'e-class' },
      { brand: 'mercedes-benz', model: 's-class' },
      { brand: 'mercedes-benz', model: 'glc' },
      { brand: 'mercedes-benz', model: 'gle' },
    ],
  },
  {
    platform: 'MB_MFA2',
    members: [
      { brand: 'mercedes-benz', model: 'a-class' },
      { brand: 'mercedes-benz', model: 'b-class' },
      { brand: 'mercedes-benz', model: 'cla' },
      { brand: 'mercedes-benz', model: 'gla' },
      { brand: 'mercedes-benz', model: 'glb' },
    ],
  },
  {
    platform: 'HONDA_GLOBAL_COMPACT',
    members: [
      { brand: 'honda', model: 'civic' },
      { brand: 'honda', model: 'hr-v' },
    ],
  },
  {
    platform: 'MAZDA_SKYACTIV',
    members: [
      { brand: 'mazda', model: '3' },
      { brand: 'mazda', model: 'cx-30' },
      { brand: 'mazda', model: 'cx-5' },
    ],
  },
];

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  19-SAFETY-PROPAGATION-V2 — Platform-based propagation');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  const ratings = await paginateAll(
    'safety_ratings',
    'id, generation_id, stars, adult_occupant_pct, child_occupant_pct, pedestrian_pct, safety_assist_pct, test_year, source_url'
  );
  const ratingsByGenId = new Map<string, any>();
  for (const r of ratings) ratingsByGenId.set(r.generation_id, r);
  console.log(`  Existing safety_ratings: ${ratings.length}`);

  // Build generation lookup by brand|model
  const gensByBrandModel = new Map<string, { gen: any; startYear: number; endYear: number }[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const key = `${model.brand.name.toLowerCase()}|${model.name.toLowerCase()}`;
    const startYear = gen.production_start ? new Date(gen.production_start).getFullYear() : 1900;
    const endYear = gen.production_end ? new Date(gen.production_end).getFullYear() : 2030;
    if (!gensByBrandModel.has(key)) gensByBrandModel.set(key, []);
    gensByBrandModel.get(key)!.push({ gen, startYear, endYear });
  }

  // ── PHASE 1: Same-model propagation (like script 12 but runs again for new ratings) ──
  console.log('\n  ── Phase 1: Same-model propagation ──');
  const phase1Stats = { propagated: 0, tooFarApart: 0 };
  const toInsert: any[] = [];

  // Group by brand|model
  for (const [, modelGens] of Array.from(gensByBrandModel.entries())) {
    const rated = modelGens.filter(g => ratingsByGenId.has(g.gen.id));
    const unrated = modelGens.filter(g => !ratingsByGenId.has(g.gen.id));
    if (rated.length === 0 || unrated.length === 0) continue;

    for (const uEntry of unrated) {
      let bestRated: any = null;
      let bestDist = Infinity;

      for (const rEntry of rated) {
        if (!uEntry.startYear || !rEntry.startYear) continue;
        const rEndYear = rEntry.endYear || 2030;
        const uEndYear = uEntry.endYear || 2030;
        const overlaps = uEntry.startYear <= rEndYear + YEAR_TOLERANCE && uEndYear >= rEntry.startYear - YEAR_TOLERANCE;
        if (!overlaps) continue;
        const dist = Math.abs(uEntry.startYear - rEntry.startYear);
        if (dist < bestDist) { bestDist = dist; bestRated = rEntry; }
      }

      if (!bestRated || bestDist > YEAR_TOLERANCE * 2) { phase1Stats.tooFarApart++; continue; }

      const source = ratingsByGenId.get(bestRated.gen.id);
      if (!source) continue;

      toInsert.push({
        generation_id: uEntry.gen.id,
        stars: source.stars,
        adult_occupant_pct: source.adult_occupant_pct,
        child_occupant_pct: source.child_occupant_pct,
        pedestrian_pct: source.pedestrian_pct,
        safety_assist_pct: source.safety_assist_pct,
        test_year: source.test_year,
        source_url: `propagated_from:${bestRated.gen.id}`,
      });
      ratingsByGenId.set(uEntry.gen.id, source);
      phase1Stats.propagated++;
    }
  }
  console.log(`  Phase 1: ${phase1Stats.propagated} propagated, ${phase1Stats.tooFarApart} too far`);

  // ── PHASE 2: Cross-platform propagation ──
  console.log('\n  ── Phase 2: Cross-platform propagation ──');
  const phase2Stats = { platformsChecked: 0, propagated: 0, noRatedInGroup: 0, tooFarApart: 0 };

  for (const group of PLATFORM_GROUPS) {
    phase2Stats.platformsChecked++;

    // Collect all generations in this platform group
    const groupGens: { gen: any; startYear: number; endYear: number; brandModel: string }[] = [];
    for (const member of group.members) {
      const key = `${member.brand}|${member.model}`;
      const entries = gensByBrandModel.get(key) || [];
      for (const e of entries) {
        groupGens.push({ ...e, brandModel: key });
      }
      // Also try fuzzy match (e.g., "3 series" might be stored as "3-series")
      for (const [k, entries2] of Array.from(gensByBrandModel.entries())) {
        const [bk, mk] = k.split('|');
        if (bk !== member.brand) continue;
        if (mk === member.model) continue; // already added
        // Fuzzy: normalize and check containment
        const mkNorm = mk.replace(/[-\s]/g, '');
        const memNorm = member.model.replace(/[-\s]/g, '');
        if (mkNorm === memNorm || mk.includes(member.model) || member.model.includes(mk)) {
          for (const e of entries2) {
            if (!groupGens.find(g => g.gen.id === e.gen.id)) {
              groupGens.push({ ...e, brandModel: k });
            }
          }
        }
      }
    }

    // Split into rated and unrated
    const rated = groupGens.filter(g => ratingsByGenId.has(g.gen.id));
    const unrated = groupGens.filter(g => !ratingsByGenId.has(g.gen.id));

    if (rated.length === 0) { phase2Stats.noRatedInGroup++; continue; }
    if (unrated.length === 0) continue;

    // For each unrated gen, find closest rated gen in the platform group
    for (const uEntry of unrated) {
      let bestRated: any = null;
      let bestDist = Infinity;

      for (const rEntry of rated) {
        if (!uEntry.startYear || !rEntry.startYear) continue;
        const rEndYear = rEntry.endYear || 2030;
        const uEndYear = uEntry.endYear || 2030;
        const overlaps = uEntry.startYear <= rEndYear + YEAR_TOLERANCE && uEndYear >= rEntry.startYear - YEAR_TOLERANCE;
        if (!overlaps) continue;
        const dist = Math.abs(uEntry.startYear - rEntry.startYear);
        if (dist < bestDist) { bestDist = dist; bestRated = rEntry; }
      }

      if (!bestRated || bestDist > YEAR_TOLERANCE * 2) { phase2Stats.tooFarApart++; continue; }

      const source = ratingsByGenId.get(bestRated.gen.id);
      if (!source) continue;

      toInsert.push({
        generation_id: uEntry.gen.id,
        stars: source.stars,
        adult_occupant_pct: source.adult_occupant_pct,
        child_occupant_pct: source.child_occupant_pct,
        pedestrian_pct: source.pedestrian_pct,
        safety_assist_pct: source.safety_assist_pct,
        test_year: source.test_year,
        source_url: `propagated_platform:${bestRated.gen.id}`,
      });
      ratingsByGenId.set(uEntry.gen.id, source);
      phase2Stats.propagated++;
    }
  }

  console.log(`  Phase 2: ${phase2Stats.propagated} propagated from ${phase2Stats.platformsChecked} platforms`);
  console.log(`  No rated in group: ${phase2Stats.noRatedInGroup}, too far: ${phase2Stats.tooFarApart}`);

  // Deduplicate (same gen_id might appear from both phases)
  const deduped = new Map<string, any>();
  for (const item of toInsert) {
    if (!deduped.has(item.generation_id)) {
      deduped.set(item.generation_id, item);
    }
  }
  const finalInsert = Array.from(deduped.values());

  // Insert
  if (!DRY_RUN && finalInsert.length > 0) {
    console.log(`\n  Inserting ${finalInsert.length} propagated ratings...`);
    let inserted = 0;
    for (let i = 0; i < finalInsert.length; i += BATCH_SIZE) {
      const batch = finalInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').upsert(batch, {
        onConflict: 'generation_id'
      });
      if (error) console.error(`  Batch error: ${error.message}`);
      else inserted += batch.length;
    }
    console.log(`  Inserted: ${inserted}`);
  }

  // Results
  const totalNew = phase1Stats.propagated + phase2Stats.propagated;
  const newTotal = ratings.length + finalInsert.length;
  console.log('\n' + '='.repeat(60));
  console.log('  SAFETY PROPAGATION V2 RESULTS');
  console.log('='.repeat(60));
  console.log(`  Phase 1 (same-model):    ${phase1Stats.propagated}`);
  console.log(`  Phase 2 (platform):      ${phase2Stats.propagated}`);
  console.log(`  Total propagated:        ${totalNew}`);
  console.log(`  Deduped inserts:         ${finalInsert.length}`);
  console.log(`  Safety coverage:         ${ratings.length} → ${newTotal} / ${gens.length} (${(newTotal / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'safety-propagation-v2-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    phase1: phase1Stats,
    phase2: phase2Stats,
    totalNew,
    dedupedInserts: finalInsert.length,
    before: ratings.length,
    after: newTotal,
  }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
