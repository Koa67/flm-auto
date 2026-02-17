/**
 * FLM AUTO — Photo Gap Filler (Wikimedia Category Search)
 * Uses Wikimedia category search API to find categories by name
 * Different from text search — finds categories that contain photos
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fill-photo-gaps-catsearch.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_catsearch.json');
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface CheckpointData {
  processedGenIds: string[];
  totalSaved: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { processedGenIds: [], totalSaved: 0, errors: 0, startedAt: new Date().toISOString() };
}

function saveCheckpoint(data: CheckpointData): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// Search for categories by name
async function searchCategories(query: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srnamespace: '14', // Category namespace
    srlimit: '5',
    format: 'json',
    origin: '*',
  });

  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.query?.search || []).map((s: any) => s.title?.replace('Category:', '')).filter(Boolean);
  } catch {
    return [];
  }
}

// Get images from a category
async function getCategoryImages(category: string, maxImages = 5): Promise<any[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: `Category:${category}`,
    gcmtype: 'file',
    gcmlimit: String(maxImages),
    prop: 'imageinfo',
    iiprop: 'url|size|mime',
    iiurlwidth: '800',
    format: 'json',
    origin: '*',
  });

  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const results: any[] = [];
    for (const page of Object.values(data.query?.pages || {}) as any[]) {
      const ii = page.imageinfo?.[0];
      if (!ii || ii.width < 500 || ii.height < 300) continue;
      if (!ii.mime?.startsWith('image/')) continue;
      const ext = ii.url?.split('.').pop()?.toLowerCase();
      if (['svg', 'pdf', 'tiff', 'tif', 'gif'].includes(ext)) continue;
      results.push({
        url: ii.url,
        thumbUrl: ii.thumburl || ii.url,
        width: ii.width,
        height: ii.height,
        title: page.title?.replace('File:', ''),
      });
    }
    return results;
  } catch {
    return [];
  }
}

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

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Wikimedia Category Search Gap Filler');
  console.log('═══════════════════════════════════════════════════════\n');

  const checkpoint = loadCheckpoint();
  const processedSet = new Set(checkpoint.processedGenIds);
  let { totalSaved, errors } = checkpoint;

  console.log('Loading data...');
  const gens = await paginateAll('generations', 'id, name, slug, chassis_code, body_type, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const existingPhotos = await paginateAll('vehicle_images', 'generation_id');

  const hasPhoto = new Set(existingPhotos.map(p => p.generation_id).filter(Boolean));
  const brandMap = new Map(brands.map(b => [b.id, b]));
  const modelMap = new Map(models.map(m => [m.id, m]));

  const orphans = gens.filter(g => {
    if (hasPhoto.has(g.id) || processedSet.has(g.id)) return false;
    return modelMap.has(g.model_id) && brandMap.has(modelMap.get(g.model_id)!.brand_id);
  });

  const totalGens = 4268;
  const currentCovered = totalGens - orphans.length;
  console.log(`Orphans: ${orphans.length}, Coverage: ${currentCovered}/${totalGens} (${(currentCovered / totalGens * 100).toFixed(1)}%)\n`);

  const startTime = Date.now();
  let coveredThisRun = 0;

  for (let i = 0; i < orphans.length; i++) {
    const gen = orphans[i];
    const model = modelMap.get(gen.model_id)!;
    const brand = brandMap.get(model.brand_id)!;

    // Build category search queries — try different patterns
    const queries = [
      `${brand.name} ${model.name}`,
      `${model.name} ${brand.name}`,
    ];
    if (gen.chassis_code) {
      queries.push(`${brand.name} ${gen.chassis_code}`);
    }
    // Some models have specific Wikimedia naming
    if (brand.name === 'BMW') queries.push(`BMW ${model.name}`);
    if (brand.name === 'Mercedes-Benz') queries.push(`Mercedes-Benz ${model.name}`);

    let photos: any[] = [];

    for (const q of queries) {
      // Find matching categories
      const categories = await searchCategories(q);
      await delay(200);

      // Try each found category
      for (const cat of categories) {
        // Basic relevance check
        const catLower = cat.toLowerCase();
        const brandLower = brand.name.toLowerCase();
        const modelLower = model.name.toLowerCase();
        if (!catLower.includes(brandLower) && !catLower.includes(modelLower)) continue;

        photos = await getCategoryImages(cat, 3);
        await delay(200);
        if (photos.length > 0) break;
      }

      if (photos.length > 0) break;
    }

    if (photos.length > 0) {
      const rows = photos.slice(0, 2).map((p, idx) => ({
        generation_id: gen.id,
        image_type: 'exterior',
        url: p.url,
        thumbnail_url: p.thumbUrl,
        width: p.width,
        height: p.height,
        alt_text: `${brand.name} ${model.name} ${gen.name}`,
        source: 'Wikimedia Commons',
        is_primary: idx === 0,
        display_order: idx,
      }));

      const urls = rows.map(r => r.url);
      const { data: existing } = await supabase.from('vehicle_images').select('url').in('url', urls);
      const existingUrls = new Set((existing || []).map(e => e.url));
      const newRows = rows.filter(r => !existingUrls.has(r.url));

      if (newRows.length > 0) {
        const { error } = await supabase.from('vehicle_images').insert(newRows);
        if (!error) {
          totalSaved += newRows.length;
          coveredThisRun++;
        } else {
          errors++;
        }
      }
    }

    processedSet.add(gen.id);

    if ((i + 1) % 25 === 0 || i === orphans.length - 1) {
      const cov = currentCovered + coveredThisRun;
      const pct = (cov / totalGens * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const eta = (orphans.length - i - 1) / Math.max(rate, 0.01);

      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ` +
        `${i + 1}/${orphans.length} | ` +
        `Coverage: ${cov}/${totalGens} (${pct}%) | ` +
        `+${coveredThisRun} gens, ${totalSaved} imgs | ` +
        `Errors: ${errors} | ` +
        `ETA: ${Math.floor(eta / 60)}m${Math.floor(eta % 60)}s`
      );

      if (cov >= Math.ceil(totalGens * 0.9)) {
        console.log('\n  TARGET 90% REACHED!');
        break;
      }
    }

    if ((i + 1) % 50 === 0) {
      saveCheckpoint({
        processedGenIds: [...processedSet],
        totalSaved, errors,
        startedAt: checkpoint.startedAt,
      });
    }

    await delay(150);
  }

  saveCheckpoint({
    processedGenIds: [...processedSet],
    totalSaved, errors,
    startedAt: checkpoint.startedAt,
  });

  const elapsed = (Date.now() - startTime) / 1000;
  const finalCov = currentCovered + coveredThisRun;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  CATEGORY SEARCH COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Processed:     ${processedSet.size}`);
  console.log(`  New coverage:  +${coveredThisRun}`);
  console.log(`  Images saved:  ${totalSaved}`);
  console.log(`  Coverage:      ${finalCov}/${totalGens} (${(finalCov / totalGens * 100).toFixed(1)}%)`);
  console.log(`  Duration:      ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
