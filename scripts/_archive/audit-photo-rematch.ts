/**
 * FLM AUTO — Photo Rematch Audit
 * 
 * The photos-all-merged.json has 13,952 photos across 91 brands.
 * The DB now has 1,080 models and 4,053 generations after v3.
 * How many of those photos can now be matched to DB generations?
 * 
 * Read-only — no DB writes.
 * Usage: npx ts-node audit-photo-rematch.ts
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

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

// Extract likely model name from verbose variant string
// e.g. "Hyundai Atos 1.1i" → "atos", "Toyota bZ4X AWD 218HP" → "bz4x"
function extractModel(brand: string, fullModel: string): string[] {
  const brandNorm = norm(brand);
  let clean = fullModel.toLowerCase().trim();
  
  // Remove brand prefix if present
  if (clean.startsWith(brand.toLowerCase())) {
    clean = clean.slice(brand.length).trim();
  }
  
  // Split by spaces, take first 1-2 tokens as candidate model names
  const tokens = clean.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return [];
  
  const candidates: string[] = [];
  // First token (most likely model name)
  candidates.push(norm(tokens[0]));
  // First two tokens (e.g. "land cruiser", "grand cherokee")
  if (tokens.length >= 2) {
    candidates.push(norm(tokens[0] + tokens[1]));
    candidates.push(norm(tokens[1])); // sometimes first token is submodel
  }
  // Full model name normalized
  candidates.push(norm(fullModel));
  
  // Keep brand-as-model as last resort (generic photos)
  const filtered = [...new Set(candidates)].filter(c => c.length > 0 && c !== brandNorm);
  return filtered.length > 0 ? filtered : ['__generic__'];
}

async function main() {
  console.log('📷 FLM AUTO — Photo Rematch Audit\n');

  // Load photos
  const photosPath = '/Users/koa/Dev/flm-auto/data/photos-all-merged.json';
  if (!fs.existsSync(photosPath)) {
    console.log('❌ photos-all-merged.json not found');
    return;
  }
  const photos = JSON.parse(fs.readFileSync(photosPath, 'utf-8'));
  console.log(`📁 ${photos.length} photos loaded`);

  // Load DB
  const brands = await paginate('brands', 'id, name');
  const models = await paginate('models', 'id, name, brand_id');
  const gens = await paginate('generations', 'id, name, model_id');

  console.log(`📊 DB: ${brands.length} brands, ${models.length} models, ${gens.length} gens\n`);

  // Build lookup
  const brandMap = new Map(brands.map((b: any) => [b.id, b.name]));
  const brandByNorm = new Map(brands.map((b: any) => [norm(b.name), b.id]));
  
  // model lookup: "brandnorm|modelnorm" -> model_id
  const modelLookup = new Map<string, string>();
  for (const m of models) {
    const brand = brandMap.get(m.brand_id);
    if (!brand) continue;
    modelLookup.set(`${norm(brand)}|${norm(m.name)}`, m.id);
  }

  // gen lookup: "model_id|gennorm" -> gen_id
  const genLookup = new Map<string, string>();
  const gensByModelId = new Map<string, any[]>();
  for (const g of gens) {
    genLookup.set(`${g.model_id}|${norm(g.name)}`, g.id);
    if (!gensByModelId.has(g.model_id)) gensByModelId.set(g.model_id, []);
    gensByModelId.get(g.model_id)!.push(g);
  }

  // Existing photos in DB
  const existingPhotos = await paginate('third_party_specs', 'generation_id');
  const gensWithPhotos = new Set(existingPhotos.filter(s => s.generation_id).map(s => s.generation_id));

  // Match photos
  let matched = 0, unmatched = 0, alreadyInDb = 0, newMatchable = 0;
  let brandOkModelFail = 0, brandFail = 0, genericSkipped = 0;
  const unmatchedBrands: Record<string, number> = {};
  const matchedBrands: Record<string, number> = {};
  const newMatchBrands: Record<string, number> = {};
  const modelFailSamples: Record<string, string[]> = {};

  // Build reverse model lookup: for each brand, map norm(modelName) → model_id
  const modelsByBrandId = new Map<string, Map<string, string>>();
  for (const m of models) {
    if (!modelsByBrandId.has(m.brand_id)) modelsByBrandId.set(m.brand_id, new Map());
    modelsByBrandId.get(m.brand_id)!.set(norm(m.name), m.id);
  }

  for (const photo of photos) {
    const photoBrand = norm(photo.brand || '');
    const photoGen = norm(photo.generation || '');

    // Try brand match
    const brandId = brandByNorm.get(photoBrand);
    if (!brandId) {
      unmatched++;
      unmatchedBrands[photo.brand] = (unmatchedBrands[photo.brand] || 0) + 1;
      continue;
    }

    const brandModels = modelsByBrandId.get(brandId);
    if (!brandModels) {
      unmatched++;
      unmatchedBrands[photo.brand] = (unmatchedBrands[photo.brand] || 0) + 1;
      continue;
    }

    // Extract candidate model names
    // When model=brand, the real model info is in the generation field (Wikimedia format)
    let modelSource = photo.model || '';
    const isGeneric = norm(modelSource) === norm(photo.brand || '') || modelSource.trim() === '';
    
    if (isGeneric) {
      if (!photo.generation) {
        genericSkipped++;
        unmatched++;
        continue;
      }
      // Use generation as model source: "A3-8L" → model "A3", "1300-Coupe" → model "1300"
      modelSource = photo.generation.split('-')[0].trim();
    }
    
    const candidates = extractModel(photo.brand, modelSource);
    
    let finalModelId: string | undefined;
    for (const candidate of candidates) {
      const mid = brandModels.get(candidate);
      if (mid) { finalModelId = mid; break; }
    }

    // Fallback: partial match — check if any DB model name is contained in photo model
    if (!finalModelId) {
      const photoModelNorm = norm(photo.model || '');
      for (const [dbModel, mid] of brandModels) {
        if (dbModel.length >= 2 && photoModelNorm.includes(dbModel)) {
          finalModelId = mid;
          break;
        }
      }
    }

    if (!finalModelId) {
      brandOkModelFail++;
      unmatched++;
      // Track samples
      if (!modelFailSamples[photo.brand]) modelFailSamples[photo.brand] = [];
      if (modelFailSamples[photo.brand].length < 3) modelFailSamples[photo.brand].push(photo.model);
      unmatchedBrands[photo.brand] = (unmatchedBrands[photo.brand] || 0) + 1;
      continue;
    }

    // Try gen match — exact or first available
    let genId = genLookup.get(`${finalModelId}|${photoGen}`);
    if (!genId) {
      const modelGens = gensByModelId.get(finalModelId);
      if (modelGens && modelGens.length > 0) {
        genId = modelGens[0].id;
      }
    }

    if (!genId) {
      unmatched++;
      unmatchedBrands[photo.brand] = (unmatchedBrands[photo.brand] || 0) + 1;
      continue;
    }

    matched++;
    matchedBrands[photo.brand] = (matchedBrands[photo.brand] || 0) + 1;

    if (!gensWithPhotos.has(genId)) {
      newMatchable++;
      newMatchBrands[photo.brand] = (newMatchBrands[photo.brand] || 0) + 1;
    } else {
      alreadyInDb++;
    }
  }

  // Report
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  REMATCH RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total photos:       ${photos.length}`);
  console.log(`  Matched to DB:      ${matched} (${Math.round(matched/photos.length*100)}%)`);
  console.log(`    Already in DB:    ${alreadyInDb}`);
  console.log(`    NEW matchable:    ${newMatchable} ← can be imported`);
  console.log(`  Unmatched:          ${unmatched} (${Math.round(unmatched/photos.length*100)}%)`);
  console.log(`    Brand not in DB:  ${unmatched - brandOkModelFail - genericSkipped}`);
  console.log(`    Generic (model=brand): ${genericSkipped}`);
  console.log(`    Brand OK, model fail:  ${brandOkModelFail}`);

  console.log('\n  Top brand-OK-but-model-fail (with samples):');
  Object.entries(modelFailSamples)
    .sort((a, b) => (unmatchedBrands[b[0]]||0) - (unmatchedBrands[a[0]]||0))
    .slice(0, 12)
    .forEach(([b, samples]) => {
      console.log(`    ${b} (${unmatchedBrands[b]}): ${samples.map(s => '"'+s+'"').join(', ')}`);
    });

  console.log('\n  Top NEW matchable brands (can import now):');
  Object.entries(newMatchBrands)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([b, c]) => console.log(`    ${b}: ${c}`));

  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
