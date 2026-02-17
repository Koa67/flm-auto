/**
 * FLM AUTO — Photo Gap Filler
 * Multi-source approach to push photo coverage from 44.7% → 90%
 *
 * Sources (in priority order):
 *   1. Wikimedia Commons search API (text search, not category-based)
 *   2. Pexels API (200 req/hour)
 *
 * Target: cover ~1,934 more generations (from 1,907 → 3,841)
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fill-photo-gaps.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_fill_gaps.json');
const DELAY_WIKI = 200;
const DELAY_PEXELS = 400; // ~200 req/hour = 1 every 18s, but bursts allowed
const MAX_IMAGES_PER_GEN = 3;

const PEXELS_API_KEY = 'H2AOu3UIjVVx2ASLCSV80nk1AgMMHA8jVp6o3bmGNiw9UmGf1vQbPokM';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Types ───────────────────────────────────────────────

interface CheckpointData {
  processedGenIds: string[];
  totalSaved: number;
  wikiSaved: number;
  pexelsSaved: number;
  totalProcessed: number;
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

// ─── Checkpoint ──────────────────────────────────────────

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    processedGenIds: [], totalSaved: 0, wikiSaved: 0, pexelsSaved: 0,
    totalProcessed: 0, errors: 0, startedAt: new Date().toISOString()
  };
}

function saveCheckpoint(data: CheckpointData): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── Wikimedia Search API ────────────────────────────────

async function searchWikimediaImages(query: string): Promise<any[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6', // File namespace
    gsrlimit: '10',
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
      if (!ii) continue;
      if (ii.width < 600 || ii.height < 400) continue;
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

// ─── Pexels API ──────────────────────────────────────────

async function searchPexels(query: string): Promise<any[]> {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY },
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.photos || []).map((p: any) => ({
      url: p.src.original,
      thumbUrl: p.src.large,
      width: p.width,
      height: p.height,
      title: p.alt || `${query}`,
      source: 'Pexels',
      sourceUrl: p.url,
      photographer: p.photographer,
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

    orphans.push({
      ...gen,
      modelName: model.name,
      brandName: brand.name,
    });
  }

  return orphans;
}

// ─── Search Query Builders ───────────────────────────────

function buildWikiQueries(gen: OrphanGen): string[] {
  const queries: string[] = [];
  const { brandName, modelName, chassis_code, name } = gen;

  // Most specific first
  if (chassis_code) {
    queries.push(`${brandName} ${chassis_code}`);
  }
  queries.push(`${brandName} ${modelName} ${name}`);
  queries.push(`${brandName} ${modelName} car`);
  queries.push(`${brandName} ${modelName}`);

  // For generic model names like "3 Series", add more context
  if (/^\d/.test(modelName) || modelName.includes('Class') || modelName.includes('Serie')) {
    queries.push(`${brandName} ${modelName} automobile`);
  }

  return [...new Set(queries)];
}

function buildPexelsQuery(gen: OrphanGen): string {
  return `${gen.brandName} ${gen.modelName} car`;
}

// ─── Insert Images ───────────────────────────────────────

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

  // Dedup check
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
  console.log('  FLM AUTO — Photo Gap Filler (Multi-Source)');
  console.log('  Target: 44.7% → 90% photo coverage');
  console.log('═══════════════════════════════════════════════════════\n');

  // Load checkpoint
  const checkpoint = loadCheckpoint();
  const processedSet = new Set(checkpoint.processedGenIds);
  let { totalSaved, wikiSaved, pexelsSaved, totalProcessed, errors } = checkpoint;

  if (processedSet.size > 0) {
    console.log(`Resuming: ${processedSet.size} processed, ${totalSaved} saved\n`);
  }

  // Get orphan generations
  console.log('Loading orphan generations...');
  const allOrphans = await getOrphanGenerations();
  const orphans = allOrphans.filter(g => !processedSet.has(g.id));
  console.log(`Orphans: ${allOrphans.length} total, ${orphans.length} remaining\n`);

  const totalGens = 4268;
  const currentCovered = totalGens - allOrphans.length;
  const target90 = Math.ceil(totalGens * 0.9);
  const needed = target90 - currentCovered;
  console.log(`Current coverage: ${currentCovered}/${totalGens} (${(currentCovered / totalGens * 100).toFixed(1)}%)`);
  console.log(`Target (90%): ${target90} generations`);
  console.log(`Need to cover: ${needed} more generations\n`);

  const startTime = Date.now();
  let batchSaved = 0;
  let coveredThisRun = 0;
  let pexelsRequests = 0;
  const pexelsStartTime = Date.now();

  for (let i = 0; i < orphans.length; i++) {
    const gen = orphans[i];
    let photos: any[] = [];
    let source = '';

    // ── Source 1: Wikimedia Search API ──
    const wikiQueries = buildWikiQueries(gen);
    for (const q of wikiQueries) {
      photos = await searchWikimediaImages(q);
      if (photos.length > 0) break;
      await delay(DELAY_WIKI);
    }

    if (photos.length > 0) {
      source = 'wiki';
    }

    // ── Source 2: Pexels API (if wiki failed) ──
    if (photos.length === 0) {
      // Rate limit: 200/hour → check if we can make a request
      const elapsedHours = (Date.now() - pexelsStartTime) / 3600000;
      const allowedRequests = Math.floor(elapsedHours * 190) + 50; // 190/hr with 50 burst buffer

      if (pexelsRequests < allowedRequests || pexelsRequests < 190) {
        const pexelsQuery = buildPexelsQuery(gen);
        photos = await searchPexels(pexelsQuery);
        pexelsRequests++;
        source = 'pexels';
        await delay(DELAY_PEXELS);
      }
    }

    // ── Insert ──
    if (photos.length > 0) {
      const inserted = await insertImages(gen.id, photos, gen);
      if (inserted > 0) {
        totalSaved += inserted;
        batchSaved += inserted;
        coveredThisRun++;
        if (source === 'wiki') wikiSaved += inserted;
        if (source === 'pexels') pexelsSaved += inserted;
      } else if (inserted < 0) {
        errors++;
      }
    }

    totalProcessed++;
    processedSet.add(gen.id);

    // Progress every 50
    if ((i + 1) % 50 === 0 || i === orphans.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = orphans.length - i - 1;
      const eta = remaining / Math.max(rate, 0.01);
      const currentCov = currentCovered + coveredThisRun;
      const pct = (currentCov / totalGens * 100).toFixed(1);

      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ` +
        `${i + 1}/${orphans.length} | ` +
        `Coverage: ${currentCov}/${totalGens} (${pct}%) | ` +
        `+${batchSaved} images (W:${wikiSaved} P:${pexelsSaved}) | ` +
        `Errors: ${errors} | ` +
        `ETA: ${Math.floor(eta / 60)}m${Math.floor(eta % 60)}s`
      );

      // Stop if we've hit 90%
      if (currentCov >= target90) {
        console.log(`\n  TARGET 90% REACHED! ${currentCov}/${totalGens}`);
        break;
      }
    }

    // Checkpoint every 100
    if ((i + 1) % 100 === 0) {
      saveCheckpoint({
        processedGenIds: [...processedSet],
        totalSaved, wikiSaved, pexelsSaved, totalProcessed, errors,
        startedAt: checkpoint.startedAt,
      });
    }

    await delay(DELAY_WIKI);
  }

  // Final checkpoint
  saveCheckpoint({
    processedGenIds: [...processedSet],
    totalSaved, wikiSaved, pexelsSaved, totalProcessed, errors,
    startedAt: checkpoint.startedAt,
  });

  const elapsed = (Date.now() - startTime) / 1000;
  const finalCov = currentCovered + coveredThisRun;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  PHOTO GAP FILL COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Processed:     ${totalProcessed} generations`);
  console.log(`  New coverage:  +${coveredThisRun} generations`);
  console.log(`  Images saved:  ${totalSaved} (Wiki: ${wikiSaved}, Pexels: ${pexelsSaved})`);
  console.log(`  Coverage:      ${finalCov}/${totalGens} (${(finalCov / totalGens * 100).toFixed(1)}%)`);
  console.log(`  Errors:        ${errors}`);
  console.log(`  Duration:      ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
