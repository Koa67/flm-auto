/**
 * FLM AUTO — Multi-Category Image Scraper (Wikimedia Commons)
 * 
 * Scrapes 4 image categories per vehicle:
 *   1. exterior  — car photos, press shots
 *   2. interior  — dashboard, cabin, seats, trunk
 *   3. blueprint — technical drawings, dimensions, schematics
 *   4. detail    — engine, wheels, badges, design details
 * 
 * Source: Wikimedia Commons API (free, no key, generous rate limits)
 * Safe to run alongside v3 auto-data (writes to third_party_specs but different spec_types)
 * 
 * Usage: npx ts-node scrape-images-multi.ts
 *        npx ts-node scrape-images-multi.ts --only "BMW,Audi"
 *        npx ts-node scrape-images-multi.ts --category interior
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Image categories with search strategies ───

type ImageCategory = 'exterior' | 'interior' | 'blueprint' | 'detail';

const CATEGORY_QUERIES: Record<ImageCategory, (brand: string, model: string, gen?: string) => string[]> = {
  exterior: (brand, model, gen) => [
    `${brand} ${model} ${gen || ''} car`.trim(),
    `${brand} ${model} automobile`,
  ],
  interior: (brand, model, gen) => [
    `${brand} ${model} interior`,
    `${brand} ${model} dashboard`,
    `${brand} ${model} cabin`,
    `${brand} ${model} seats`,
    `${brand} ${model} trunk boot`,
    `${brand} ${model} cockpit`,
  ],
  blueprint: (brand, model, gen) => [
    `${brand} ${model} blueprint`,
    `${brand} ${model} technical drawing`,
    `${brand} ${model} dimensions diagram`,
    `${brand} ${model} schema`,
    `${brand} ${model} outline drawing`,
    `${brand} ${model} vector drawing`,
  ],
  detail: (brand, model, gen) => [
    `${brand} ${model} engine`,
    `${brand} ${model} wheel`,
    `${brand} ${model} badge emblem`,
    `${brand} ${model} detail close`,
  ],
};

// Minimum image dimensions to filter out thumbnails/icons
const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;
const MAX_RESULTS_PER_QUERY = 10;
const MAX_IMAGES_PER_CATEGORY = 5;

// ─── Wikimedia Commons API ───

interface WikimediaImage {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  title: string;
  descriptionUrl: string;
  license: string;
  author: string;
}

async function searchWikimedia(query: string, limit: number = MAX_RESULTS_PER_QUERY): Promise<WikimediaImage[]> {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=${limit}&format=json&origin=*`;

  try {
    const res = await fetch(searchUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const titles = (data.query?.search || []).map((r: any) => r.title);
    if (titles.length === 0) return [];

    // Get image info for all found files
    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join('|'))}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=800&format=json&origin=*`;
    const infoRes = await fetch(infoUrl);
    if (!infoRes.ok) return [];
    const infoData = await infoRes.json();

    const images: WikimediaImage[] = [];
    for (const page of Object.values(infoData.query?.pages || {}) as any[]) {
      const ii = page.imageinfo?.[0];
      if (!ii) continue;
      // Filter by size
      if (ii.width < MIN_WIDTH || ii.height < MIN_HEIGHT) continue;
      // Filter out SVG/PDF (usually not photos)
      const ext = ii.url?.split('.').pop()?.toLowerCase();
      if (['svg', 'pdf', 'tiff', 'tif'].includes(ext)) continue;

      const meta = ii.extmetadata || {};
      images.push({
        url: ii.url,
        thumbUrl: ii.thumburl || ii.url,
        width: ii.width,
        height: ii.height,
        title: page.title?.replace('File:', ''),
        descriptionUrl: ii.descriptionurl,
        license: meta.LicenseShortName?.value || 'Unknown',
        author: (meta.Artist?.value || 'Unknown').replace(/<[^>]*>/g, '').trim().slice(0, 200),
      });
    }
    return images;
  } catch (e: any) {
    console.log(`      ⚠️ Wikimedia error: ${e.message}`);
    return [];
  }
}

// ─── DB helpers ───

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

// ─── Main ───

async function main() {
  console.log('🖼️  FLM AUTO — Multi-Category Image Scraper\n');

  // Parse args
  const args = process.argv.slice(2);
  const onlyArg = args.find(a => a.startsWith('--only'));
  let brandFilter: string[] | null = null;
  if (onlyArg) {
    const val = onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1];
    if (val) brandFilter = val.split(',').map(s => s.trim().toLowerCase());
  }

  const catArg = args.find(a => a.startsWith('--category'));
  let categoryFilter: ImageCategory[] | null = null;
  if (catArg) {
    const val = catArg.includes('=') ? catArg.split('=')[1] : args[args.indexOf(catArg) + 1];
    if (val) categoryFilter = val.split(',').map(s => s.trim()) as ImageCategory[];
  }

  const categories: ImageCategory[] = categoryFilter || ['exterior', 'interior', 'blueprint', 'detail'];

  // Load DB
  process.stdout.write('  Loading brands...');
  const brands = await paginate('brands', 'id, name, slug');
  console.log(` ${brands.length}`);

  process.stdout.write('  Loading models...');
  const models = await paginate('models', 'id, name, brand_id');
  console.log(` ${models.length}`);

  process.stdout.write('  Loading generations...');
  const gens = await paginate('generations', 'id, name, model_id, production_start');
  console.log(` ${gens.length}`);

  // Check which gens already have images per category
  process.stdout.write('  Loading existing image specs...');
  const existingSpecs = await paginate('third_party_specs', 'generation_id, spec_type');
  const imageSpecTypes = new Set(['photos', 'photos_interior', 'photos_blueprint', 'photos_detail']);
  const existingImages = new Map<string, Set<string>>(); // gen_id -> set of spec_types
  for (const s of existingSpecs) {
    if (imageSpecTypes.has(s.spec_type)) {
      if (!existingImages.has(s.generation_id)) existingImages.set(s.generation_id, new Set());
      existingImages.get(s.generation_id)!.add(s.spec_type);
    }
  }
  console.log(` ${existingImages.size} gens with images\n`);

  // Map category -> spec_type
  const catToSpecType: Record<ImageCategory, string> = {
    exterior: 'photos',
    interior: 'photos_interior',
    blueprint: 'photos_blueprint',
    detail: 'photos_detail',
  };

  // Index
  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const modelsByBrand = new Map<string, any[]>();
  for (const m of models) {
    if (!modelsByBrand.has(m.brand_id)) modelsByBrand.set(m.brand_id, []);
    modelsByBrand.get(m.brand_id)!.push(m);
  }
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Filter brands
  const targetBrands = brandFilter
    ? brands.filter((b: any) => brandFilter!.some(f => b.name.toLowerCase().includes(f)))
    : brands;

  console.log(`📊 Processing ${targetBrands.length} brands, categories: ${categories.join(', ')}\n`);

  // Stats
  const stats = { 
    processed: 0, skipped: 0, found: 0, saved: 0, errors: 0,
    byCategory: Object.fromEntries(categories.map(c => [c, 0])) as Record<string, number>,
  };

  // JSON output for local backup
  const allResults: any[] = [];

  for (const brand of targetBrands) {
    const bModels = modelsByBrand.get(brand.id) || [];
    console.log(`\n🏷️  ${brand.name} (${bModels.length} models)`);

    for (let mi = 0; mi < bModels.length; mi++) {
      const model = bModels[mi];
      const mGens = gensByModel.get(model.id) || [];
      if (mGens.length === 0) continue;

      // Process max 3 gens per model to stay reasonable
      const targetGens = mGens.slice(0, 3);
      process.stdout.write(`   [${mi+1}/${bModels.length}] ${model.name} (${targetGens.length} gens)...`);

      for (const gen of targetGens) {
        stats.processed++;

        for (const category of categories) {
          const specType = catToSpecType[category];

          // Skip if already has this type
          const existing = existingImages.get(gen.id);
          if (existing?.has(specType)) {
            stats.skipped++;
            continue;
          }

          // Build search queries
          const genLabel = gen.name === 'Default' ? '' : gen.name;
          const queries = CATEGORY_QUERIES[category](brand.name, model.name, genLabel);

          let found: WikimediaImage[] = [];

          // Only try first 2 queries to speed things up — bail early if first hits
          for (const query of queries.slice(0, 2)) {
            if (found.length >= MAX_IMAGES_PER_CATEGORY) break;
            await delay(100);

            const results = await searchWikimedia(query, MAX_RESULTS_PER_QUERY);
            // Dedup by URL
            for (const img of results) {
              if (found.length >= MAX_IMAGES_PER_CATEGORY) break;
              if (!found.some(f => f.url === img.url)) {
                found.push(img);
              }
            }
            // If first query got results, skip the rest
            if (found.length >= 2) break;
          }

          if (found.length === 0) continue;

          stats.found += found.length;
          stats.byCategory[category] = (stats.byCategory[category] || 0) + found.length;

          // Save to DB — spec_value is numeric (count), raw_data is JSON (image details)
          const { error } = await supabase.from('third_party_specs').upsert({
            generation_id: gen.id,
            source: 'Wikimedia Commons',
            spec_type: specType,
            spec_value: found.length,
            raw_data: {
              category,
              count: found.length,
              scraped_at: new Date().toISOString(),
              photos: found.map(img => ({
                url: img.url,
                thumb: img.thumbUrl,
                w: img.width,
                h: img.height,
                title: img.title,
                license: img.license,
                author: img.author,
                source_url: img.descriptionUrl,
              })),
            },
          }, { onConflict: 'generation_id,source,spec_type' });

          if (error) {
            stats.errors++;
            console.log(`      ❌ DB error ${brand.name} ${model.name}: ${error.message}`);
          } else {
            stats.saved++;
          }

          // Local backup
          for (const img of found) {
            allResults.push({
              brand: brand.name,
              model: model.name,
              generation: gen.name,
              generation_id: gen.id,
              category,
              ...img,
            });
          }
        }
      }
    }

    // Progress per brand
    console.log(`\n   ✅ ${brand.name} done — ${stats.found} total found, ${stats.saved} saved, ${stats.errors} errors`);
  }

  // Save local backup
  const outputFile = '../data/images-multi-category.json';
  
  // Merge with existing
  let existing: any[] = [];
  if (fs.existsSync(outputFile)) {
    try { existing = JSON.parse(fs.readFileSync(outputFile, 'utf-8')); } catch {}
  }
  const mergedMap = new Map<string, any>();
  for (const e of existing) mergedMap.set(`${e.generation_id}|${e.category}|${e.url}`, e);
  for (const r of allResults) mergedMap.set(`${r.generation_id}|${r.category}|${r.url}`, r);
  fs.writeFileSync(outputFile, JSON.stringify([...mergedMap.values()], null, 2));

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  SCRAPING COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Gens processed:  ${stats.processed}`);
  console.log(`  Skipped (exist):  ${stats.skipped}`);
  console.log(`  Images found:     ${stats.found}`);
  console.log(`  Saved to DB:      ${stats.saved}`);
  console.log(`  Errors:           ${stats.errors}`);
  console.log('\n  By category:');
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    console.log(`    ${cat.padEnd(12)} ${count}`);
  }
  console.log(`\n  📁 Local backup: ${outputFile}`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
