/**
 * FLM AUTO — Generate YouTube search list from DB
 * 
 * Instead of a hardcoded 35-model list, pulls the most important models
 * from the DB and generates the VEHICLES_TO_SEARCH array.
 * 
 * Criteria for priority:
 * 1. Has specs (active/real model)
 * 2. Recent production (2018+)
 * 3. Flagship/popular models per brand
 * 
 * Usage: npx ts-node generate-youtube-list.ts
 *        → outputs to ../data/youtube-search-list.json
 *        → also prints a TypeScript snippet to paste into scrape-youtube-videos.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function paginate(table: string, select: string): Promise<any[]> {
  let all: any[] = [];
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

// Brand name aliases for YouTube search
const BRAND_SEARCH_NAMES: Record<string, string> = {
  'Mercedes-Benz': 'Mercedes',
  'Volkswagen': 'VW',
  'Alfa Romeo': 'Alfa Romeo',
  'Land Rover': 'Land Rover',
  'Rolls-Royce': 'Rolls Royce',
  'Aston Martin': 'Aston Martin',
};

// Models to skip (not interesting for video reviews)
const SKIP_MODELS = new Set([
  'default', 'unknown', 'other',
]);

async function main() {
  console.log('📺 FLM AUTO — Generate YouTube Search List\n');

  const brands = await paginate('brands', 'id, name');
  const models = await paginate('models', 'id, name, brand_id');
  const gens = await paginate('generations', 'id, model_id, production_start');
  const specs = await paginate('third_party_specs', 'generation_id');

  const brandMap = new Map(brands.map((b: any) => [b.id, b.name]));
  const specCount = new Map<string, number>();
  for (const s of specs) specCount.set(s.generation_id, (specCount.get(s.generation_id) || 0) + 1);

  // Gen → latest production year
  const genYear = new Map<string, number>();
  for (const g of gens) {
    if (g.production_start) {
      const year = parseInt(String(g.production_start).slice(0, 4));
      if (!isNaN(year)) genYear.set(g.id, year);
    }
  }

  // Gen → model
  const genModel = new Map(gens.map((g: any) => [g.id, g.model_id]));

  // Score each model
  interface ModelScore {
    brand: string;
    model: string;
    brandId: string;
    modelId: string;
    genCount: number;
    specTotal: number;
    latestYear: number;
    score: number;
  }

  const modelScores: ModelScore[] = [];

  for (const model of models) {
    const brand = brandMap.get(model.brand_id);
    if (!brand) continue;
    if (SKIP_MODELS.has(model.name.toLowerCase())) continue;

    const modelGens = gens.filter((g: any) => g.model_id === model.id);
    if (modelGens.length === 0) continue;

    let specTotal = 0;
    let latestYear = 0;

    for (const g of modelGens) {
      specTotal += specCount.get(g.id) || 0;
      const year = genYear.get(g.id) || 0;
      if (year > latestYear) latestYear = year;
    }

    // Score: prioritize recent models with lots of specs
    const recencyBonus = latestYear >= 2020 ? 100 : latestYear >= 2015 ? 50 : 0;
    const specBonus = Math.min(specTotal, 500); // cap
    const genBonus = Math.min(modelGens.length * 10, 50);
    const score = recencyBonus + specBonus + genBonus;

    modelScores.push({
      brand, model: model.name, brandId: model.brand_id, modelId: model.id,
      genCount: modelGens.length, specTotal, latestYear, score,
    });
  }

  // Sort by score, pick top N per brand
  const MAX_PER_BRAND = 8;
  const MAX_TOTAL = 100;

  modelScores.sort((a, b) => b.score - a.score);

  const brandCounts = new Map<string, number>();
  const selected: ModelScore[] = [];

  for (const ms of modelScores) {
    if (selected.length >= MAX_TOTAL) break;
    const count = brandCounts.get(ms.brand) || 0;
    if (count >= MAX_PER_BRAND) continue;
    selected.push(ms);
    brandCounts.set(ms.brand, count + 1);
  }

  // Generate output
  interface VehicleSearch {
    brand: string;
    model: string;
    searchTerms: string[];
  }

  const vehicles: VehicleSearch[] = selected.map(ms => {
    const searchBrand = BRAND_SEARCH_NAMES[ms.brand] || ms.brand;
    return {
      brand: ms.brand,
      model: ms.model,
      searchTerms: [
        `${searchBrand} ${ms.model}`,
        `${ms.brand} ${ms.model} review`,
      ],
    };
  });

  // Existing videos check
  const existingPath = '/Users/koa/Dev/flm-auto/data/youtube_videos.json';
  let existingModels = new Set<string>();
  if (fs.existsSync(existingPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
      for (const v of (existing.vehicles || [])) {
        if (v.videos?.length > 0) {
          existingModels.add(`${v.brand}|${v.model}`);
        }
      }
    } catch {}
  }

  // Report
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  YOUTUBE SEARCH LIST: ${vehicles.length} models`);
  console.log('═══════════════════════════════════════════════════════════════');

  const byBrand = new Map<string, VehicleSearch[]>();
  for (const v of vehicles) {
    if (!byBrand.has(v.brand)) byBrand.set(v.brand, []);
    byBrand.get(v.brand)!.push(v);
  }

  for (const [brand, vs] of [...byBrand.entries()].sort()) {
    const models = vs.map(v => {
      const hasVideos = existingModels.has(`${v.brand}|${v.model}`);
      return `${v.model}${hasVideos ? ' ✅' : ' 🆕'}`;
    });
    console.log(`  ${brand.padEnd(18)} ${models.join(', ')}`);
  }

  const newModels = vehicles.filter(v => !existingModels.has(`${v.brand}|${v.model}`));
  console.log(`\n  Already have videos: ${vehicles.length - newModels.length}`);
  console.log(`  NEW (need scraping): ${newModels.length}`);

  // Save
  const outputFile = '/Users/koa/Dev/flm-auto/data/youtube-search-list.json';
  fs.writeFileSync(outputFile, JSON.stringify(vehicles, null, 2));
  console.log(`\n  📁 Saved: ${outputFile}`);

  // Estimate quota
  const estimatedQuota = vehicles.length * 2 * 100 + vehicles.length * 20; // 2 search terms × 100 units + details
  console.log(`  📊 Estimated quota: ~${estimatedQuota} units (limit: 10,000/day)`);
  if (estimatedQuota > 10000) {
    const batches = Math.ceil(estimatedQuota / 9000);
    console.log(`  ⚠️  Needs ${batches} days of quota to complete`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
