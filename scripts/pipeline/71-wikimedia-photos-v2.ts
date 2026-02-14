/**
 * 71-wikimedia-photos-v2.ts — Wikimedia Commons photo fill for zero-photo gens
 *
 * Targets gens with 0 photos or only C/D photos.
 * Uses multiple search queries per gen with intelligent filtering.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/71-wikimedia-photos-v2.ts --dry-run --limit=50
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/71-wikimedia-photos-v2.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0;
const DELAY_MS = 200;
const MAX_IMAGES_PER_GEN = 8;
const MIN_WIDTH = 400;
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');
const CHECKPOINT_PATH = path.join(DATA_DIR, 'wikimedia-v2-checkpoint.json');
const USER_AGENT = 'FLM-Auto/2.0 (https://flm-auto.fr; contact@flm-auto.fr)';

// Exclusion patterns for filenames
const EXCLUDE_PATTERNS = /logo|emblem|badge|icon|flag|map|chart|diagram|svg|gif|stamp|medal|trophy|award/i;
const PREFER_PATTERNS = /front|rear|side|exterior|interior|facelift|sedan|hatchback|wagon|suv|coupe/i;

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

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function extractYear(gen: any): string | null {
  if (gen.production_start) {
    const y = gen.production_start.substring(0, 4);
    if (parseInt(y) >= 1950) return y;
  }
  if (gen.slug) {
    const match = gen.slug.match(/(\d{4})$/);
    if (match && parseInt(match[1]) >= 1950) return match[1];
  }
  return null;
}

function classifyImage(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('interior') || lower.includes('cockpit') || lower.includes('dashboard') || lower.includes('cabin')) return 'interior';
  if (lower.includes('engine') || lower.includes('motor')) return 'technical';
  return 'exterior';
}

interface SearchResult {
  title: string;
  url: string;
  thumbUrl: string | null;
  width: number;
  height: number;
  imageType: string;
}

async function searchWikimedia(query: string): Promise<SearchResult[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(query)}&srlimit=20&format=json`;
  try {
    const data = await fetchJSON(url);
    const results = data?.query?.search || [];
    await sleep(DELAY_MS);

    const images: SearchResult[] = [];
    for (const result of results) {
      const title = result.title;
      if (!title.startsWith('File:')) continue;
      const filename = title.replace('File:', '');

      // Filter out non-photos
      if (EXCLUDE_PATTERNS.test(filename)) continue;
      if (/\.(svg|gif)$/i.test(filename)) continue;

      // Get image info
      try {
        const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|mime&format=json`;
        const infoData = await fetchJSON(infoUrl);
        await sleep(DELAY_MS);

        const pages = infoData?.query?.pages;
        if (!pages) continue;
        const page = Object.values(pages)[0] as any;
        const info = page?.imageinfo?.[0];
        if (!info) continue;

        // Skip small images and non-image types
        if (info.width < MIN_WIDTH) continue;
        if (!info.mime?.startsWith('image/')) continue;
        if (info.mime === 'image/svg+xml' || info.mime === 'image/gif') continue;

        images.push({
          title: filename,
          url: info.url,
          thumbUrl: info.thumburl || null,
          width: info.width,
          height: info.height,
          imageType: classifyImage(filename),
        });
      } catch {
        // Skip individual image info failures
      }
    }
    return images;
  } catch {
    return [];
  }
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  71-WIKIMEDIA-PHOTOS-V2 — Fill zero-photo gens');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${LIMIT ? ` (limit: ${LIMIT})` : ''}`);
  console.log('='.repeat(60));

  // Load diagnostic
  console.log('\n  Loading data...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  // Load existing images to find gaps
  const images = await paginateAll('vehicle_images', 'generation_id, confidence');
  const genPhotoStatus = new Map<string, { count: number; hasAB: boolean }>();
  for (const img of images) {
    if (!img.generation_id) continue;
    if (!genPhotoStatus.has(img.generation_id)) {
      genPhotoStatus.set(img.generation_id, { count: 0, hasAB: false });
    }
    const stat = genPhotoStatus.get(img.generation_id)!;
    stat.count++;
    if (img.confidence === 'A' || img.confidence === 'B') stat.hasAB = true;
  }

  // Identify targets: zero photos first, then no A/B
  const targets: any[] = [];
  for (const gen of gens) {
    const stat = genPhotoStatus.get(gen.id);
    if (!stat || stat.count === 0) {
      targets.push({ ...gen, priority: 0 }); // Zero photos — highest priority
    } else if (!stat.hasAB) {
      targets.push({ ...gen, priority: 1 }); // Has photos but no A/B
    }
  }

  // Sort by priority (zero photos first)
  targets.sort((a, b) => a.priority - b.priority);
  const toProcess = LIMIT ? targets.slice(0, LIMIT) : targets;
  console.log(`  Targets: ${targets.length} (zero: ${targets.filter(t => t.priority === 0).length}, no A/B: ${targets.filter(t => t.priority === 1).length})`);
  console.log(`  Processing: ${toProcess.length}`);

  // Load checkpoint
  let checkpoint: { completed: string[]; stats: { searched: number; found: number; inserted: number } } = {
    completed: [],
    stats: { searched: 0, found: 0, inserted: 0 },
  };
  if (fs.existsSync(CHECKPOINT_PATH)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
    console.log(`  Resuming: ${checkpoint.completed.length} already done`);
  }

  const completedSet = new Set(checkpoint.completed);
  const toInsert: any[] = [];
  let searched = checkpoint.stats.searched;
  let found = checkpoint.stats.found;
  let inserted = checkpoint.stats.inserted;

  for (let i = 0; i < toProcess.length; i++) {
    const gen = toProcess[i];
    if (completedSet.has(gen.id)) continue;

    const brand = gen.model?.brand?.name || '';
    const model = gen.model?.name || '';
    const year = extractYear(gen);

    // Build search queries
    const queries: string[] = [];
    // Query 1: brand + model + gen name (most specific)
    if (gen.name) queries.push(`${brand} ${model} ${gen.name}`);
    // Query 2: brand + model + year
    if (year) queries.push(`${brand} ${model} ${year}`);
    // Query 3: brand + model (broad fallback)
    queries.push(`${brand} ${model}`);

    // Deduplicate and search
    const seenUrls = new Set<string>();
    const allResults: SearchResult[] = [];

    for (const query of queries) {
      if (allResults.length >= MAX_IMAGES_PER_GEN) break;
      const results = await searchWikimedia(query);
      for (const r of results) {
        if (seenUrls.has(r.url)) continue;
        seenUrls.add(r.url);
        allResults.push(r);
        if (allResults.length >= MAX_IMAGES_PER_GEN) break;
      }
      searched++;
    }

    if (allResults.length > 0) {
      found++;
      // Sort: prefer exterior, prefer images with good keywords
      allResults.sort((a, b) => {
        const aScore = (a.imageType === 'exterior' ? 10 : 0) + (PREFER_PATTERNS.test(a.title) ? 5 : 0) + (a.width > 1000 ? 3 : 0);
        const bScore = (b.imageType === 'exterior' ? 10 : 0) + (PREFER_PATTERNS.test(b.title) ? 5 : 0) + (b.width > 1000 ? 3 : 0);
        return bScore - aScore;
      });

      for (const img of allResults.slice(0, MAX_IMAGES_PER_GEN)) {
        toInsert.push({
          generation_id: gen.id,
          url: img.url,
          thumbnail_url: img.thumbUrl,
          image_type: img.imageType,
          width: img.width,
          height: img.height,
          source: 'Wikimedia Commons',
          confidence: 'A',
          alt_text: `${brand} ${model} ${gen.name || ''}`.trim(),
          display_order: 99,
          is_primary: false,
        });
        inserted++;
      }
    }

    completedSet.add(gen.id);
    checkpoint.completed.push(gen.id);
    checkpoint.stats = { searched, found, inserted };

    // Progress
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`  Progress: ${i + 1}/${toProcess.length} — found: ${found}, images: ${inserted}\r`);
    }

    // Checkpoint every 50 gens
    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));

      // Batch insert if not dry run
      if (!DRY_RUN && toInsert.length > 0) {
        for (let j = 0; j < toInsert.length; j += BATCH_SIZE) {
          const batch = toInsert.slice(j, j + BATCH_SIZE);
          const { error } = await supabase.from('vehicle_images').insert(batch);
          if (error) console.error(`\n  Insert error: ${error.message}`);
        }
        toInsert.length = 0;
      }
    }
  }

  // Final insert
  if (!DRY_RUN && toInsert.length > 0) {
    for (let j = 0; j < toInsert.length; j += BATCH_SIZE) {
      const batch = toInsert.slice(j, j + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_images').insert(batch);
      if (error) console.error(`\n  Insert error: ${error.message}`);
    }
  }

  // Save final checkpoint
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));

  console.log(`\n\n  RESULTS:`);
  console.log(`    Gens processed: ${checkpoint.completed.length}`);
  console.log(`    Search queries: ${searched}`);
  console.log(`    Gens with results: ${found}`);
  console.log(`    Images ${DRY_RUN ? 'would insert' : 'inserted'}: ${inserted}`);
  console.log(`    Hit rate: ${toProcess.length > 0 ? (found / Math.min(toProcess.length, checkpoint.completed.length) * 100).toFixed(1) : 0}%`);
}

main().catch(console.error);
