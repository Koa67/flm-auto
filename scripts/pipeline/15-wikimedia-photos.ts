/**
 * 15-wikimedia-photos.ts — Fill photo gaps via Wikimedia Commons API
 *
 * For each generation with 0 photos, searches Wikimedia Commons
 * for "{brand} {model} {generation}" and imports CC-licensed images.
 *
 * API: https://commons.wikimedia.org/w/api.php
 *   - action=query&list=search (find files)
 *   - action=query&titles=File:xxx&prop=imageinfo (get URL)
 *
 * Delay: 200ms between requests (polite crawling)
 * User-Agent: FLM-Auto/1.0 (flm-auto.fr; contact@flm-auto.fr)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/15-wikimedia-photos.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/15-wikimedia-photos.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/15-wikimedia-photos.ts --limit=100
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
const BATCH_SIZE = 50;
const DELAY_MS = 250; // polite to Wikimedia
const MAX_IMAGES_PER_GEN = 5;
const DATA_DIR = path.resolve(__dirname, '../../data');
const CHECKPOINT_PATH = path.join(DATA_DIR, 'wikimedia-photos-checkpoint.json');
const USER_AGENT = 'FLM-Auto/1.0 (https://flm-auto.fr; contact@flm-auto.fr)';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse: ${e}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

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

// Clean generation name for search query
function cleanGenName(name: string): string {
  return name
    .replace(/^default$/i, '')
    .replace(/^lci\s*/i, '')
    .replace(/\bfacelift\b/i, '')
    .replace(/\b(i|ii|iii|iv|v|vi)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build search queries for a generation
function buildQueries(brand: string, model: string, genName: string): string[] {
  const queries: string[] = [];
  const cleanGen = cleanGenName(genName);

  // Primary: brand + model + gen code
  if (cleanGen) {
    queries.push(`${brand} ${model} ${cleanGen}`);
  }
  // Fallback: brand + model only
  queries.push(`${brand} ${model} car`);

  return queries;
}

// Search Wikimedia Commons for files matching query
async function searchCommons(query: string, limit: number = 10): Promise<string[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srnamespace=6&srlimit=${limit}&format=json`;
  const data = await fetchJSON(url);
  const results = data?.query?.search || [];
  return results
    .map((r: any) => r.title as string)
    .filter((t: string) => /\.(jpg|jpeg|png)$/i.test(t));
}

// Get image URL from file title
async function getImageUrl(title: string): Promise<string | null> {
  const encoded = encodeURIComponent(title);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encoded}&prop=imageinfo&iiprop=url|size|mime&format=json`;
  const data = await fetchJSON(url);
  const pages = data?.query?.pages || {};
  for (const page of Object.values(pages) as any[]) {
    const info = page?.imageinfo?.[0];
    if (!info) continue;
    // Skip very small images (icons, logos)
    if (info.width < 400 || info.height < 300) continue;
    // Skip non-image mime types
    if (!info.mime?.startsWith('image/')) continue;
    return info.url;
  }
  return null;
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  15-WIKIMEDIA-PHOTOS — Fill photo gaps');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (LIMIT > 0) console.log(`  Limit: ${LIMIT} generations`);
  console.log('='.repeat(60));

  // Load generations
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  // Find gens with photos
  const imgs = await paginateAll('vehicle_images', 'generation_id');
  const gensWithPhotos = new Set(imgs.map((r: any) => r.generation_id));
  console.log(`  Gens with photos: ${gensWithPhotos.size}`);

  // Gens needing photos
  const missing = gens.filter((g: any) => !gensWithPhotos.has(g.id));
  console.log(`  Gens WITHOUT photos: ${missing.length}`);

  // Load checkpoint
  let processedSet = new Set<string>();
  if (fs.existsSync(CHECKPOINT_PATH)) {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
    processedSet = new Set(cp.processed || []);
    console.log(`  Checkpoint: ${processedSet.size} already processed`);
  }

  // Filter out already-processed
  const toProcess = missing.filter((g: any) => !processedSet.has(g.id));
  const limited = LIMIT > 0 ? toProcess.slice(0, LIMIT) : toProcess;
  console.log(`  To process: ${limited.length}`);

  const stats = {
    searched: 0,
    gensWithResults: 0,
    gensNoResults: 0,
    imagesFound: 0,
    imagesInserted: 0,
    errors: 0,
  };

  const toInsert: any[] = [];

  for (let i = 0; i < limited.length; i++) {
    const gen = limited[i];
    const model = gen.model as any;
    if (!model?.brand) continue;

    const brand = model.brand.name;
    const modelName = model.name;
    const genName = gen.name || '';

    const queries = buildQueries(brand, modelName, genName);
    let foundUrls: string[] = [];

    for (const query of queries) {
      try {
        const titles = await searchCommons(query, MAX_IMAGES_PER_GEN * 2);
        await sleep(DELAY_MS);

        for (const title of titles) {
          if (foundUrls.length >= MAX_IMAGES_PER_GEN) break;
          try {
            const imageUrl = await getImageUrl(title);
            await sleep(100);
            if (imageUrl && !foundUrls.includes(imageUrl)) {
              foundUrls.push(imageUrl);
            }
          } catch {
            // skip individual image errors
          }
        }

        if (foundUrls.length >= MAX_IMAGES_PER_GEN) break;
        stats.searched++;
      } catch {
        stats.errors++;
        await sleep(DELAY_MS * 2);
      }
    }

    if (foundUrls.length > 0) {
      stats.gensWithResults++;
      stats.imagesFound += foundUrls.length;

      for (const url of foundUrls) {
        toInsert.push({
          generation_id: gen.id,
          url: url,
          source: 'wikimedia_commons',
          image_type: 'exterior',
        });
      }
    } else {
      stats.gensNoResults++;
    }

    processedSet.add(gen.id);

    // Progress
    if ((i + 1) % 25 === 0 || i === limited.length - 1) {
      process.stdout.write(`  [${i + 1}/${limited.length}] found: ${stats.imagesFound} imgs for ${stats.gensWithResults} gens\n`);

      // Save checkpoint
      fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({
        processed: Array.from(processedSet),
        timestamp: new Date().toISOString(),
      }));
    }
  }

  // Insert
  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} images...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_images').insert(batch);
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }
    stats.imagesInserted = inserted;
    console.log(`  Inserted: ${inserted}`);
  }

  // Results
  const newGensWithPhotos = gensWithPhotos.size + stats.gensWithResults;
  console.log('\n' + '='.repeat(60));
  console.log('  WIKIMEDIA PHOTOS RESULTS');
  console.log('='.repeat(60));
  console.log(`  Searched:         ${stats.searched} queries`);
  console.log(`  Gens with imgs:   ${stats.gensWithResults}`);
  console.log(`  Gens no results:  ${stats.gensNoResults}`);
  console.log(`  Images found:     ${stats.imagesFound}`);
  console.log(`  Images inserted:  ${DRY_RUN ? '(dry run)' : stats.imagesInserted}`);
  console.log(`  Errors:           ${stats.errors}`);
  console.log(`  Photo coverage:   ${gensWithPhotos.size} → ${newGensWithPhotos} / ${gens.length} (${(newGensWithPhotos / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'wikimedia-photos-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, before: gensWithPhotos.size, after: newGensWithPhotos }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
