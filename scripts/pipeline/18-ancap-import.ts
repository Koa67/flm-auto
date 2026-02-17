/**
 * 18-ancap-import.ts — Import ANCAP (Australasian NCAP) Safety Ratings
 *
 * ANCAP uses EuroNCAP test results for most vehicles sold in Australasia.
 * Their public API returns rated vehicles with star ratings.
 *
 * Source: https://www.ancap.com.au/safety-ratings
 * API: JSON endpoints from their website
 *
 * Rules:
 *   - Only import for generations WITHOUT existing safety ratings
 *   - ANCAP stars map directly (same EuroNCAP protocol)
 *   - Source marked as 'ancap'
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/18-ancap-import.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/18-ancap-import.ts
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
const BATCH_SIZE = 50;
const DELAY_MS = 300;
const DATA_DIR = path.resolve(__dirname, '../../data');

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : require('http');
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'FLM-Auto/1.0 (https://flm-auto.fr)',
        'Accept': 'application/json',
      },
      timeout: 15000,
    }, (res: any) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJSON(res.headers.location).then(resolve).catch(reject);
        return;
      }
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

function fetchHTML(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHTML(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve(data));
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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Brand name mapping: ANCAP → our DB
const BRAND_MAP: Record<string, string> = {
  'bmw': 'bmw', 'mercedes-benz': 'mercedes-benz', 'audi': 'audi',
  'volkswagen': 'volkswagen', 'toyota': 'toyota', 'honda': 'honda',
  'nissan': 'nissan', 'hyundai': 'hyundai', 'kia': 'kia',
  'renault': 'renault', 'peugeot': 'peugeot', 'volvo': 'volvo',
  'skoda': 'skoda', 'porsche': 'porsche', 'ford': 'ford', 'mazda': 'mazda',
  'fiat': 'fiat', 'alfa romeo': 'alfa romeo', 'ferrari': 'ferrari',
  'lamborghini': 'lamborghini', 'jaguar': 'jaguar', 'lexus': 'lexus',
  'tesla': 'tesla', 'land rover': 'land rover', 'maserati': 'maserati',
  'aston martin': 'aston martin', 'bentley': 'bentley',
  'rolls-royce': 'rolls-royce', 'mini': 'mini', 'seat': 'seat',
  'citroen': 'citroen', 'citroën': 'citroen', 'opel': 'opel',
};

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  18-ANCAP-IMPORT — ANCAP Safety Ratings');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load DB
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  const ratings = await paginateAll('safety_ratings', 'generation_id');
  const ratedGens = new Set(ratings.map((r: any) => r.generation_id));
  console.log(`  Existing safety_ratings: ${ratings.length}`);

  // Build gen lookup
  const genLookup = new Map<string, { gen: any; startYear: number; endYear: number }[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const key = `${model.brand.name.toLowerCase()}|${model.name.toLowerCase()}`;
    const startYear = gen.production_start ? new Date(gen.production_start).getFullYear() : 1900;
    const endYear = gen.production_end ? new Date(gen.production_end).getFullYear() : 2030;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push({ gen, startYear, endYear });
  }

  // Try to scrape ANCAP ratings page
  console.log('\n  Fetching ANCAP ratings...');

  const stats = {
    ancapVehicles: 0,
    matched: 0,
    unmatched: 0,
    alreadyRated: 0,
    newRatings: 0,
    inserted: 0,
    errors: 0,
  };

  const toInsert: any[] = [];

  // ANCAP website scraping approach: iterate through pages
  // The ANCAP site lists ratings at /safety-ratings/{brand}
  const ancapBrands = [
    'audi', 'bmw', 'citroen', 'fiat', 'ford', 'honda', 'hyundai', 'jaguar',
    'kia', 'land-rover', 'lexus', 'mazda', 'mercedes-benz', 'mini', 'nissan',
    'opel', 'peugeot', 'porsche', 'renault', 'seat', 'skoda', 'tesla',
    'toyota', 'volkswagen', 'volvo', 'alfa-romeo', 'aston-martin', 'bentley',
    'ferrari', 'lamborghini', 'maserati', 'rolls-royce',
  ];

  for (const ancapBrand of ancapBrands) {
    try {
      const url = `https://www.ancap.com.au/safety-ratings/${ancapBrand}`;
      const html = await fetchHTML(url);
      await sleep(DELAY_MS);

      // Extract rated vehicles from HTML
      // Look for patterns like: data-rating="5" and vehicle model names
      // ANCAP uses structured data — look for star ratings in the page

      // Pattern 1: JSON-LD structured data
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
      if (jsonLdMatch) {
        for (const match of jsonLdMatch) {
          try {
            const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
            const parsed = JSON.parse(jsonStr);
            if (parsed['@type'] === 'ItemList' && parsed.itemListElement) {
              for (const item of parsed.itemListElement) {
                processAncapItem(item, ancapBrand, genLookup, ratedGens, toInsert, stats);
              }
            }
          } catch { /* skip parse errors */ }
        }
      }

      // Pattern 2: Extract from HTML patterns
      // Look for rating cards with star info
      const ratingPattern = /class="[^"]*rating[^"]*"[^>]*>[\s\S]*?(\d)\s*star/gi;
      const modelPattern = /class="[^"]*model[^"]*"[^>]*>([\s\S]*?)<\//gi;

      // Alternative: look for data attributes
      const dataRatingPattern = /data-stars?="(\d)"[^>]*data-(?:model|name)="([^"]+)"/gi;
      let drMatch;
      while ((drMatch = dataRatingPattern.exec(html)) !== null) {
        const stars = parseInt(drMatch[1]);
        const modelName = drMatch[2];
        if (stars >= 1 && stars <= 5 && modelName) {
          processSimpleRating(ancapBrand, modelName, stars, null, genLookup, ratedGens, toInsert, stats);
        }
      }

      // Pattern 3: Look for structured vehicle listings
      // <a href="/safety-ratings/brand/model">Model Name</a> ... <span>5 stars</span>
      const listingPattern = /href="\/safety-ratings\/[^"]*?"[^>]*>([^<]+)<[\s\S]*?(\d)\s*(?:star|Star)/gi;
      let lMatch;
      while ((lMatch = listingPattern.exec(html)) !== null) {
        const modelName = lMatch[1].trim();
        const stars = parseInt(lMatch[2]);
        if (stars >= 1 && stars <= 5 && modelName && modelName.length > 1) {
          processSimpleRating(ancapBrand, modelName, stars, null, genLookup, ratedGens, toInsert, stats);
        }
      }

      process.stdout.write(`[${ancapBrand}:${stats.newRatings}]`);
    } catch (e: any) {
      stats.errors++;
      process.stdout.write(`[${ancapBrand}:ERR]`);
      await sleep(DELAY_MS);
    }
  }
  console.log('');

  // Insert
  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} ANCAP ratings...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').upsert(batch, {
        onConflict: 'generation_id'
      });
      if (error) console.error(`  Batch error at ${i}: ${error.message}`);
      else inserted += batch.length;
    }
    stats.inserted = inserted;
    console.log(`  Inserted: ${inserted}`);
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('  ANCAP IMPORT RESULTS');
  console.log('='.repeat(60));
  console.log(`  ANCAP vehicles found: ${stats.ancapVehicles}`);
  console.log(`  Matched to DB:       ${stats.matched}`);
  console.log(`  Already rated:       ${stats.alreadyRated}`);
  console.log(`  New ratings:         ${stats.newRatings}`);
  console.log(`  Unmatched:           ${stats.unmatched}`);
  console.log(`  Inserted:            ${DRY_RUN ? '(dry run)' : stats.inserted}`);
  console.log(`  Errors:              ${stats.errors}`);
  const newTotal = ratings.length + stats.newRatings;
  console.log(`  Safety coverage:     ${ratings.length} → ${newTotal} / ${gens.length} (${(newTotal / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'ancap-import-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

function processAncapItem(
  item: any,
  ancapBrand: string,
  genLookup: Map<string, any[]>,
  ratedGens: Set<string>,
  toInsert: any[],
  stats: any
) {
  const name = item.name || item.item?.name || '';
  const rating = item.item?.aggregateRating?.ratingValue || null;
  if (!name || !rating) return;
  processSimpleRating(ancapBrand, name, parseInt(rating), item.item?.url, genLookup, ratedGens, toInsert, stats);
}

function processSimpleRating(
  ancapBrand: string,
  modelName: string,
  stars: number,
  sourceUrl: string | null,
  genLookup: Map<string, any[]>,
  ratedGens: Set<string>,
  toInsert: any[],
  stats: any
) {
  stats.ancapVehicles++;

  // Resolve brand
  const brandClean = ancapBrand.replace(/-/g, ' ').toLowerCase();
  const ourBrand = BRAND_MAP[brandClean];
  if (!ourBrand) { stats.unmatched++; return; }

  // Try to match generation
  const modelNorm = normalize(modelName);
  let matched = false;

  for (const [key, entries] of Array.from(genLookup.entries())) {
    const [bk, mk] = key.split('|');
    if (bk !== ourBrand) continue;

    const mkNorm = normalize(mk);
    if (mkNorm === modelNorm || mkNorm.includes(modelNorm) || modelNorm.includes(mkNorm)) {
      // Find the most recent generation
      const sorted = entries.sort((a: any, b: any) => b.startYear - a.startYear);
      for (const entry of sorted) {
        if (ratedGens.has(entry.gen.id)) { stats.alreadyRated++; matched = true; break; }

        toInsert.push({
          generation_id: entry.gen.id,
          stars: stars,
          source_url: sourceUrl || `https://www.ancap.com.au/safety-ratings/${ancapBrand}`,
        });
        ratedGens.add(entry.gen.id);
        stats.matched++;
        stats.newRatings++;
        matched = true;
        break;
      }
      break;
    }
  }

  if (!matched) stats.unmatched++;
}

main().catch(console.error);
