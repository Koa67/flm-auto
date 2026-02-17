/**
 * FLM AUTO — Photo Gap Filler V2 (Aggressive Mode)
 * For the remaining ~786 orphan generations that Phase 1 missed
 *
 * Strategy:
 *   1. Broader Wikimedia search (model-only, body-type variations)
 *   2. Heavy Pexels usage (200 req/hour — ~3 per generation)
 *   3. Wikipedia page images as fallback
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fill-photo-gaps-v2.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_fill_gaps_v2.json');
const MAX_IMAGES_PER_GEN = 2;

const PEXELS_API_KEY = 'H2AOu3UIjVVx2ASLCSV80nk1AgMMHA8jVp6o3bmGNiw9UmGf1vQbPokM';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface CheckpointData {
  processedGenIds: string[];
  totalSaved: number;
  wikiSaved: number;
  pexelsSaved: number;
  wpSaved: number;
  errors: number;
  startedAt: string;
}

interface OrphanGen {
  id: string;
  name: string;
  slug: string;
  chassis_code: string | null;
  body_type: string | null;
  model_id: string;
  modelName: string;
  brandName: string;
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    processedGenIds: [], totalSaved: 0, wikiSaved: 0, pexelsSaved: 0,
    wpSaved: 0, errors: 0, startedAt: new Date().toISOString()
  };
}

function saveCheckpoint(data: CheckpointData): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── Wikimedia Search (broader queries) ──────────────────

async function searchWikimedia(query: string): Promise<any[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '8',
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
        source: 'Wikimedia Commons',
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Wikipedia article images ────────────────────────────

async function getWikipediaImages(query: string): Promise<any[]> {
  try {
    // Search Wikipedia for the article
    const searchParams = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '1',
      format: 'json',
      origin: '*',
    });
    const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams}`);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const title = searchData.query?.search?.[0]?.title;
    if (!title) return [];

    // Get images from the article
    const imgParams = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'images|pageimages',
      imlimit: '10',
      piprop: 'original|thumbnail',
      pithumbsize: '800',
      format: 'json',
      origin: '*',
    });
    const imgRes = await fetch(`https://en.wikipedia.org/w/api.php?${imgParams}`);
    if (!imgRes.ok) return [];
    const imgData = await imgRes.json();
    const page = Object.values(imgData.query?.pages || {})[0] as any;
    if (!page) return [];

    const results: any[] = [];

    // Main page image (usually the best)
    if (page.original?.source) {
      results.push({
        url: page.original.source,
        thumbUrl: page.thumbnail?.source || page.original.source,
        width: page.original.width || 800,
        height: page.original.height || 600,
        title: title,
        source: 'Wikipedia',
      });
    }

    // Other images from the article - fetch their info from Commons
    const images = (page.images || [])
      .filter((img: any) => {
        const name = img.title?.toLowerCase() || '';
        return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
      })
      .filter((img: any) => {
        const name = img.title?.toLowerCase() || '';
        return !name.includes('logo') && !name.includes('flag') && !name.includes('icon') && !name.includes('commons');
      })
      .slice(0, 3);

    for (const img of images) {
      const infoParams = new URLSearchParams({
        action: 'query',
        titles: img.title,
        prop: 'imageinfo',
        iiprop: 'url|size',
        iiurlwidth: '800',
        format: 'json',
        origin: '*',
      });
      try {
        const infoRes = await fetch(`https://commons.wikimedia.org/w/api.php?${infoParams}`);
        if (!infoRes.ok) continue;
        const infoData = await infoRes.json();
        const infoPage = Object.values(infoData.query?.pages || {})[0] as any;
        const ii = infoPage?.imageinfo?.[0];
        if (ii && ii.width >= 500 && ii.height >= 300) {
          results.push({
            url: ii.url,
            thumbUrl: ii.thumburl || ii.url,
            width: ii.width,
            height: ii.height,
            title: img.title.replace('File:', ''),
            source: 'Wikimedia Commons',
          });
        }
      } catch { /* skip */ }
      await delay(100);
    }

    return results;
  } catch {
    return [];
  }
}

// ─── Pexels API ──────────────────────────────────────────

async function searchPexels(query: string): Promise<any[]> {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
    if (!res.ok) {
      if (res.status === 429) {
        console.log('   Pexels rate limited, waiting 60s...');
        await delay(60000);
      }
      return [];
    }
    const data = await res.json();
    return (data.photos || []).map((p: any) => ({
      url: p.src.original,
      thumbUrl: p.src.large,
      width: p.width,
      height: p.height,
      title: p.alt || query,
      source: 'Pexels',
      sourceUrl: p.url,
    }));
  } catch {
    return [];
  }
}

// ─── DB Helpers ──────────────────────────────────────────

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

async function getOrphanGenerations(): Promise<OrphanGen[]> {
  const gens = await paginateAll('generations', 'id, name, slug, chassis_code, body_type, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const existingPhotos = await paginateAll('vehicle_images', 'generation_id');

  const hasPhoto = new Set(existingPhotos.map(p => p.generation_id).filter(Boolean));
  const brandMap = new Map(brands.map(b => [b.id, b]));
  const modelMap = new Map(models.map(m => [m.id, m]));

  const orphans: OrphanGen[] = [];
  for (const gen of gens) {
    if (hasPhoto.has(gen.id)) continue;
    const model = modelMap.get(gen.model_id);
    if (!model) continue;
    const brand = brandMap.get(model.brand_id);
    if (!brand) continue;
    orphans.push({ ...gen, modelName: model.name, brandName: brand.name });
  }
  return orphans;
}

// ─── Query Builders ──────────────────────────────────────

function buildBroadWikiQueries(gen: OrphanGen): string[] {
  const { brandName, modelName, name, chassis_code, body_type } = gen;
  const queries: string[] = [];

  // Try model name alone (e.g., "Countach", "Urus")
  queries.push(`${brandName} ${modelName} car photo`);

  // With body type
  if (body_type) {
    queries.push(`${brandName} ${modelName} ${body_type}`);
  }

  // Generation name might contain years
  const yearMatch = name.match(/(19|20)\d{2}/);
  if (yearMatch) {
    queries.push(`${brandName} ${modelName} ${yearMatch[0]}`);
  }

  // Chassis code variations
  if (chassis_code) {
    queries.push(`${chassis_code} car`);
    queries.push(`${brandName} ${chassis_code} automobile`);
  }

  // Brand aliases
  const aliases: Record<string, string[]> = {
    'Mercedes-Benz': ['Mercedes', 'Merc', 'MB'],
    'Volkswagen': ['VW'],
    'BMW': ['Bayerische Motoren Werke'],
  };
  const brandAliases = aliases[brandName] || [];
  for (const alias of brandAliases) {
    queries.push(`${alias} ${modelName}`);
  }

  return [...new Set(queries)];
}

function buildPexelsQueries(gen: OrphanGen): string[] {
  const { brandName, modelName, body_type } = gen;
  const queries: string[] = [];

  queries.push(`${brandName} ${modelName} car`);
  queries.push(`${brandName} ${modelName}`);
  if (body_type) {
    queries.push(`${brandName} ${body_type}`);
  }

  return queries;
}

// ─── Insert ──────────────────────────────────────────────

async function insertImages(genId: string, photos: any[], gen: OrphanGen): Promise<number> {
  if (photos.length === 0) return 0;
  const rows = photos.slice(0, MAX_IMAGES_PER_GEN).map((photo, idx) => ({
    generation_id: genId,
    image_type: 'exterior',
    url: photo.url,
    thumbnail_url: photo.thumbUrl,
    width: photo.width,
    height: photo.height,
    alt_text: `${gen.brandName} ${gen.modelName} ${gen.name}`,
    source: photo.source,
    source_url: photo.sourceUrl || null,
    is_primary: idx === 0,
    display_order: idx,
  }));

  const urls = rows.map(r => r.url);
  const { data: existing } = await supabase.from('vehicle_images').select('url').in('url', urls);
  const existingUrls = new Set((existing || []).map(e => e.url));
  const newRows = rows.filter(r => !existingUrls.has(r.url));
  if (newRows.length === 0) return 0;

  const { error } = await supabase.from('vehicle_images').insert(newRows);
  if (error) return -1;
  return newRows.length;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Photo Gap Filler V2 (Aggressive)');
  console.log('  Target: 81.6% → 90% photo coverage');
  console.log('═══════════════════════════════════════════════════════\n');

  const checkpoint = loadCheckpoint();
  const processedSet = new Set(checkpoint.processedGenIds);
  let { totalSaved, wikiSaved, pexelsSaved, wpSaved, errors } = checkpoint;

  if (processedSet.size > 0) {
    console.log(`Resuming: ${processedSet.size} processed, ${totalSaved} saved\n`);
  }

  console.log('Loading orphan generations...');
  const allOrphans = await getOrphanGenerations();
  const orphans = allOrphans.filter(g => !processedSet.has(g.id));
  console.log(`Orphans: ${allOrphans.length} total, ${orphans.length} remaining\n`);

  const totalGens = 4268;
  const currentCovered = totalGens - allOrphans.length;
  const target90 = Math.ceil(totalGens * 0.9);
  console.log(`Current: ${currentCovered}/${totalGens} (${(currentCovered / totalGens * 100).toFixed(1)}%)`);
  console.log(`Target: ${target90} (90%), need ${target90 - currentCovered} more\n`);

  const startTime = Date.now();
  let coveredThisRun = 0;
  let pexelsRequests = 0;

  for (let i = 0; i < orphans.length; i++) {
    const gen = orphans[i];
    let photos: any[] = [];
    let source = '';

    // ── Strategy 1: Broader Wikimedia search ──
    const wikiQueries = buildBroadWikiQueries(gen);
    for (const q of wikiQueries) {
      photos = await searchWikimedia(q);
      if (photos.length > 0) { source = 'wiki'; break; }
      await delay(200);
    }

    // ── Strategy 2: Wikipedia article images ──
    if (photos.length === 0) {
      const wpQuery = `${gen.brandName} ${gen.modelName}`;
      photos = await getWikipediaImages(wpQuery);
      if (photos.length > 0) source = 'wp';
      await delay(300);
    }

    // ── Strategy 3: Pexels (heavy usage) ──
    if (photos.length === 0 && pexelsRequests < 195) {
      const pexelsQueries = buildPexelsQueries(gen);
      for (const q of pexelsQueries) {
        photos = await searchPexels(q);
        pexelsRequests++;
        if (photos.length > 0) { source = 'pexels'; break; }
        await delay(500);
        if (pexelsRequests >= 195) break;
      }
    }

    // ── Insert ──
    if (photos.length > 0) {
      const inserted = await insertImages(gen.id, photos, gen);
      if (inserted > 0) {
        totalSaved += inserted;
        coveredThisRun++;
        if (source === 'wiki') wikiSaved += inserted;
        else if (source === 'pexels') pexelsSaved += inserted;
        else if (source === 'wp') wpSaved += inserted;
      } else if (inserted < 0) {
        errors++;
      }
    }

    processedSet.add(gen.id);

    // Progress every 25
    if ((i + 1) % 25 === 0 || i === orphans.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = orphans.length - i - 1;
      const eta = remaining / Math.max(rate, 0.01);
      const cov = currentCovered + coveredThisRun;
      const pct = (cov / totalGens * 100).toFixed(1);

      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ` +
        `${i + 1}/${orphans.length} | ` +
        `Coverage: ${cov}/${totalGens} (${pct}%) | ` +
        `+${totalSaved} (W:${wikiSaved} WP:${wpSaved} P:${pexelsSaved}) | ` +
        `Pexels: ${pexelsRequests}/195 | ` +
        `Errors: ${errors} | ` +
        `ETA: ${Math.floor(eta / 60)}m${Math.floor(eta % 60)}s`
      );

      if (cov >= target90) {
        console.log(`\n  TARGET 90% REACHED! ${cov}/${totalGens}`);
        break;
      }
    }

    // Checkpoint every 50
    if ((i + 1) % 50 === 0) {
      saveCheckpoint({
        processedGenIds: [...processedSet],
        totalSaved, wikiSaved, pexelsSaved, wpSaved, errors,
        startedAt: checkpoint.startedAt,
      });
    }

    await delay(150);
  }

  saveCheckpoint({
    processedGenIds: [...processedSet],
    totalSaved, wikiSaved, pexelsSaved, wpSaved, errors,
    startedAt: checkpoint.startedAt,
  });

  const elapsed = (Date.now() - startTime) / 1000;
  const finalCov = currentCovered + coveredThisRun;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  PHOTO GAP FILL V2 COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Processed:     ${processedSet.size} generations`);
  console.log(`  New coverage:  +${coveredThisRun} generations`);
  console.log(`  Images saved:  ${totalSaved} (Wiki: ${wikiSaved}, WP: ${wpSaved}, Pexels: ${pexelsSaved})`);
  console.log(`  Coverage:      ${finalCov}/${totalGens} (${(finalCov / totalGens * 100).toFixed(1)}%)`);
  console.log(`  Pexels reqs:   ${pexelsRequests}`);
  console.log(`  Errors:        ${errors}`);
  console.log(`  Duration:      ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
