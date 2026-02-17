/**
 * FLM AUTO — Final Photo Gap Push (Wikipedia model-level images)
 * For each orphan model, gets the Wikipedia article main image
 * and assigns it to ALL orphan generations of that model
 *
 * Target: 88.7% → 90%+ (need 55 more generations covered)
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fill-photo-gaps-final.ts
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

// Get Wikipedia article's primary image
async function getWikipediaImage(query: string): Promise<any | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      titles: query,
      prop: 'pageimages',
      piprop: 'original|thumbnail',
      pithumbsize: '800',
      redirects: '1',
      format: 'json',
      origin: '*',
    });

    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const page = Object.values(data.query?.pages || {})[0] as any;
    if (!page?.original?.source) return null;

    return {
      url: page.original.source,
      thumbUrl: page.thumbnail?.source || page.original.source,
      width: page.original.width || 800,
      height: page.original.height || 600,
    };
  } catch {
    return null;
  }
}

// Try multiple Wikipedia search terms
async function findWikipediaImage(brand: string, model: string): Promise<any | null> {
  const queries = [
    `${brand} ${model}`,
    `${brand}_${model}`.replace(/ /g, '_'),
  ];

  // Brand-specific Wikipedia article patterns
  if (brand === 'Mercedes-Benz') {
    queries.push(`Mercedes-Benz ${model.replace('Classe ', '').replace('Class ', '')}`);
    queries.push(`Mercedes-Benz ${model.replace('Classe ', '').replace('Class ', '')}-Class`);
  }
  if (brand === 'Peugeot' || brand === 'Renault' || brand === 'Mazda') {
    queries.push(`${brand} ${model.split(' ')[0]}`); // Just first word for models like "Mazda3 2"
  }

  for (const q of queries) {
    const img = await getWikipediaImage(q);
    if (img) return img;
    await delay(200);

    // Also try searching Wikipedia
    try {
      const searchParams = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: `${brand} ${model} car`,
        srlimit: '3',
        format: 'json',
        origin: '*',
      });
      const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams}`);
      const searchData = await searchRes.json();
      const titles = (searchData.query?.search || []).map((s: any) => s.title);

      for (const title of titles) {
        const imgParams = new URLSearchParams({
          action: 'query',
          titles: title,
          prop: 'pageimages',
          piprop: 'original|thumbnail',
          pithumbsize: '800',
          redirects: '1',
          format: 'json',
          origin: '*',
        });
        const imgRes = await fetch(`https://en.wikipedia.org/w/api.php?${imgParams}`);
        const imgData = await imgRes.json();
        const p = Object.values(imgData.query?.pages || {})[0] as any;
        if (p?.original?.source) {
          return {
            url: p.original.source,
            thumbUrl: p.thumbnail?.source || p.original.source,
            width: p.original.width || 800,
            height: p.original.height || 600,
          };
        }
        await delay(200);
      }
    } catch { /* skip */ }
  }

  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Final Photo Gap Push (Wikipedia)');
  console.log('  Target: 88.7% → 90%+');
  console.log('═══════════════════════════════════════════════════════\n');

  // Load data
  console.log('Loading data...');
  const gens = await paginateAll('generations', 'id, name, slug, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const existingPhotos = await paginateAll('vehicle_images', 'generation_id');

  const hasPhoto = new Set(existingPhotos.map(p => p.generation_id).filter(Boolean));
  const brandMap = new Map(brands.map(b => [b.id, b]));
  const modelMap = new Map(models.map(m => [m.id, m]));

  // Group orphan generations by model
  const orphansByModel = new Map<string, any[]>();
  for (const gen of gens) {
    if (hasPhoto.has(gen.id)) continue;
    const model = modelMap.get(gen.model_id);
    if (!model) continue;
    if (!orphansByModel.has(model.id)) orphansByModel.set(model.id, []);
    orphansByModel.get(model.id)!.push(gen);
  }

  const totalOrphans = [...orphansByModel.values()].reduce((s, arr) => s + arr.length, 0);
  const currentCovered = 4268 - totalOrphans;
  const target90 = Math.ceil(4268 * 0.9);
  console.log(`Orphan models: ${orphansByModel.size}, orphan gens: ${totalOrphans}`);
  console.log(`Current: ${currentCovered}/4268 (${(currentCovered / 4268 * 100).toFixed(1)}%)`);
  console.log(`Need: ${target90 - currentCovered} more for 90%\n`);

  const startTime = Date.now();
  let coveredGens = 0;
  let totalSaved = 0;
  let modelIdx = 0;
  const modelEntries = [...orphansByModel.entries()];

  for (const [modelId, orphanGens] of modelEntries) {
    const model = modelMap.get(modelId)!;
    const brand = brandMap.get(model.brand_id);
    if (!brand) continue;

    const img = await findWikipediaImage(brand.name, model.name);

    if (img) {
      // Assign to all orphan gens of this model
      for (const gen of orphanGens) {
        const row = {
          generation_id: gen.id,
          image_type: 'exterior',
          url: img.url,
          thumbnail_url: img.thumbUrl,
          width: img.width,
          height: img.height,
          alt_text: `${brand.name} ${model.name} ${gen.name}`,
          source: 'Wikipedia',
          is_primary: true,
          display_order: 0,
        };

        // Check for duplicate URL
        const { data: existing } = await supabase.from('vehicle_images').select('url').eq('url', img.url).eq('generation_id', gen.id).limit(1);
        if (existing && existing.length > 0) continue;

        const { error } = await supabase.from('vehicle_images').insert(row);
        if (!error) {
          totalSaved++;
          coveredGens++;
        }
      }
    }

    modelIdx++;

    if (modelIdx % 10 === 0 || modelIdx === modelEntries.length) {
      const cov = currentCovered + coveredGens;
      const pct = (cov / 4268 * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = modelIdx / elapsed;
      const eta = (modelEntries.length - modelIdx) / Math.max(rate, 0.01);

      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ` +
        `${modelIdx}/${modelEntries.length} models | ` +
        `Coverage: ${cov}/4268 (${pct}%) | ` +
        `+${coveredGens} gens, ${totalSaved} imgs | ` +
        `ETA: ${Math.floor(eta / 60)}m${Math.floor(eta % 60)}s`
      );

      if (cov >= target90) {
        console.log('\n  TARGET 90% REACHED!');
        break;
      }
    }

    await delay(300);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const finalCov = currentCovered + coveredGens;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  FINAL PUSH COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Models checked:  ${modelIdx}`);
  console.log(`  New gens covered: +${coveredGens}`);
  console.log(`  Images saved:    ${totalSaved}`);
  console.log(`  Coverage:        ${finalCov}/4268 (${(finalCov / 4268 * 100).toFixed(1)}%)`);
  console.log(`  Duration:        ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
