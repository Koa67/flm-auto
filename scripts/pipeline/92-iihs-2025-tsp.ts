/**
 * 92-iihs-2025-tsp.ts — Insert IIHS 2025 Top Safety Pick data
 *
 * Hardcoded IIHS 2025 TSP/TSP+ awards matched against our DB brands/models.
 * TSP+ → 5 stars, TSP → 4 stars. Confidence A (official source).
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/92-iihs-2025-tsp.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/92-iihs-2025-tsp.ts --live
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = !process.argv.includes('--live');
const BATCH_SIZE = 50;
const SOURCE_URL = 'https://www.iihs.org/ratings/top-safety-picks';

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error(`  paginate error ${table}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

interface IIHSEntry { brand: string; model: string; award: 'TSP' | 'TSP+'; }

const IIHS_2025: IIHSEntry[] = [
  { brand: "Honda", model: "Civic", award: "TSP+" },
  { brand: "Hyundai", model: "Elantra", award: "TSP+" },
  { brand: "Kia", model: "K4", award: "TSP+" },
  { brand: "Mazda", model: "Mazda3", award: "TSP+" },
  { brand: "Toyota", model: "Prius", award: "TSP+" },
  { brand: "Honda", model: "Accord", award: "TSP+" },
  { brand: "Hyundai", model: "Ioniq 6", award: "TSP+" },
  { brand: "Hyundai", model: "Sonata", award: "TSP+" },
  { brand: "Toyota", model: "Camry", award: "TSP+" },
  { brand: "Audi", model: "A5", award: "TSP+" },
  { brand: "Mercedes-Benz", model: "C-Class", award: "TSP+" },
  { brand: "Tesla", model: "Model 3", award: "TSP" },
  { brand: "Audi", model: "A6", award: "TSP+" },
  { brand: "Honda", model: "HR-V", award: "TSP+" },
  { brand: "Hyundai", model: "Ioniq 5", award: "TSP+" },
  { brand: "Hyundai", model: "Kona", award: "TSP+" },
  { brand: "Hyundai", model: "Tucson", award: "TSP+" },
  { brand: "Kia", model: "Sportage", award: "TSP+" },
  { brand: "Mazda", model: "CX-30", award: "TSP+" },
  { brand: "Toyota", model: "bZ4X", award: "TSP+" },
  { brand: "Toyota", model: "Corolla", award: "TSP" },
  { brand: "Honda", model: "Passport", award: "TSP+" },
  { brand: "Hyundai", model: "Santa Fe", award: "TSP+" },
  { brand: "Kia", model: "EV9", award: "TSP+" },
  { brand: "Kia", model: "Sorento", award: "TSP+" },
  { brand: "Kia", model: "Telluride", award: "TSP+" },
  { brand: "Mazda", model: "CX-90", award: "TSP+" },
  { brand: "Nissan", model: "Murano", award: "TSP+" },
  { brand: "Nissan", model: "Pathfinder", award: "TSP+" },
  { brand: "Audi", model: "Q5", award: "TSP+" },
  { brand: "Audi", model: "Q6", award: "TSP+" },
  { brand: "Audi", model: "Q7", award: "TSP+" },
  { brand: "BMW", model: "X3", award: "TSP+" },
  { brand: "BMW", model: "X5", award: "TSP+" },
  { brand: "Mercedes-Benz", model: "GLC", award: "TSP+" },
  { brand: "Mercedes-Benz", model: "GLE", award: "TSP+" },
  { brand: "Tesla", model: "Model Y", award: "TSP+" },
  { brand: "Volvo", model: "XC90", award: "TSP+" },
  { brand: "Volvo", model: "EX90", award: "TSP+" },
  { brand: "Nissan", model: "Rogue", award: "TSP" },
];

// Model name aliases: IIHS name → possible DB names
const MODEL_ALIASES: Record<string, string[]> = {
  'C-Class': ['Classe C', 'C-Class'],
  'GLE': ['GLE', 'GLE-Class'],
  'GLC': ['GLC', 'GLC-Class'],
  'Mazda3': ['Mazda3', '3'],
  'Rogue': ['rogue', 'Rogue'],
  'Murano': ['murano', 'Murano'],
  'Pathfinder': ['pathfinder', 'Pathfinder'],
  'Elantra': ['elantra', 'Elantra'],
  'Sonata': ['sonata', 'Sonata'],
  'Kona': ['Kona', 'Kona Electric'],
  'Telluride': ['telluride', 'Telluride'],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function findModel(iihsModel: string, brandModels: { id: string; name: string }[]) {
  // 1. Exact
  for (const m of brandModels) if (m.name.toLowerCase() === iihsModel.toLowerCase()) return m;
  // 2. Aliases
  const aliases = MODEL_ALIASES[iihsModel];
  if (aliases) for (const a of aliases) for (const m of brandModels) if (m.name.toLowerCase() === a.toLowerCase()) return m;
  // 3. Normalized
  const norm = normalize(iihsModel);
  for (const m of brandModels) if (normalize(m.name) === norm) return m;
  // 4. Substring
  const subs = brandModels.filter(m => { const n = normalize(m.name); return n.length >= 2 && (norm.includes(n) || n.includes(norm)); })
    .sort((a, b) => normalize(b.name).length - normalize(a.name).length);
  if (subs.length > 0) return subs[0];
  return null;
}

function findGeneration(modelId: string, gens: any[]) {
  return gens
    .filter(g => g.model_id === modelId && g.production_start)
    .filter(g => {
      const start = new Date(g.production_start).getFullYear();
      if (start > 2025) return false;
      if (g.production_end && new Date(g.production_end).getFullYear() < 2024) return false;
      return true;
    })
    .sort((a, b) => new Date(b.production_start).getTime() - new Date(a.production_start).getTime())[0] || null;
}

async function main() {
  console.log(`\n  92 — IIHS 2025 TSP Import (${DRY_RUN ? 'DRY RUN' : 'LIVE'})\n`);

  const [brands, models, generations, ratings] = await Promise.all([
    paginateAll('brands', 'id, name'),
    paginateAll('models', 'id, name, brand_id'),
    paginateAll('generations', 'id, name, production_start, production_end, model_id'),
    paginateAll('safety_ratings', 'id, generation_id, stars, confidence'),
  ]);
  console.log(`  Loaded: ${brands.length} brands, ${models.length} models, ${generations.length} gens, ${ratings.length} ratings\n`);

  const brandByName = new Map(brands.map((b: any) => [b.name.toLowerCase(), b]));
  const modelsByBrand = new Map<string, any[]>();
  for (const m of models) {
    if (!modelsByBrand.has(m.brand_id)) modelsByBrand.set(m.brand_id, []);
    modelsByBrand.get(m.brand_id)!.push(m);
  }
  const ratingByGen = new Map(ratings.map((r: any) => [r.generation_id, r]));

  // Deduplicate
  const seen = new Set<string>();
  const deduped = IIHS_2025.filter(e => { const k = `${e.brand}|${e.model}`; if (seen.has(k)) return false; seen.add(k); return true; });

  const inserts: any[] = [];
  const updates: { id: string; data: any }[] = [];
  const skipped: string[] = [];
  const misses: string[] = [];

  for (const entry of deduped) {
    const label = `${entry.brand} ${entry.model} (${entry.award})`;
    const brand = brandByName.get(entry.brand.toLowerCase());
    if (!brand) { misses.push(`${label} → brand not found`); continue; }
    const bModels = modelsByBrand.get(brand.id) || [];
    const model = findModel(entry.model, bModels);
    if (!model) { misses.push(`${label} → model not found`); continue; }
    const gen = findGeneration(model.id, generations);
    if (!gen) { misses.push(`${label} → no 2024-2025 gen for "${model.name}"`); continue; }

    const stars = entry.award === 'TSP+' ? 5 : 4;
    const existing = ratingByGen.get(gen.id);

    if (existing?.confidence === 'A') {
      skipped.push(`${label} → "${model.name}" already A`);
      continue;
    }

    if (existing) {
      updates.push({ id: existing.id, data: { stars, confidence: 'A', source_url: SOURCE_URL, test_year: 2025 } });
      console.log(`  UPGRADE ${existing.confidence}→A: ${label} → "${model.name}" / "${gen.name}"`);
    } else {
      inserts.push({ generation_id: gen.id, stars, source_url: SOURCE_URL, confidence: 'A', test_year: 2025 });
      console.log(`  INSERT: ${label} → "${model.name}" / "${gen.name}"`);
    }
  }

  console.log(`\n  Summary: ${inserts.length} inserts, ${updates.length} upgrades, ${skipped.length} skipped, ${misses.length} missed`);
  if (misses.length) { console.log(`  Misses:`); misses.forEach(m => console.log(`    ${m}`)); }

  if (!DRY_RUN && (inserts.length || updates.length)) {
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      const { error } = await supabase.from('safety_ratings').insert(inserts.slice(i, i + BATCH_SIZE));
      if (error) console.error(`  INSERT error: ${error.message}`);
    }
    for (const u of updates) {
      const { error } = await supabase.from('safety_ratings').update(u.data).eq('id', u.id);
      if (error) console.error(`  UPDATE error ${u.id}: ${error.message}`);
    }
    console.log(`  Done writing.`);
  } else if (DRY_RUN) {
    console.log(`  DRY RUN — use --live to write.`);
  }

  fs.writeFileSync(path.resolve(__dirname, '../../data/phase19-iihs-report.json'),
    JSON.stringify({ inserts: inserts.length, updates: updates.length, skipped: skipped.length, misses, timestamp: new Date().toISOString() }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
