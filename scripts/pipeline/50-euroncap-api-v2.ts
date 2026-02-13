/**
 * 50-euroncap-api-v2.ts — EuroNCAP A-Z listing re-scrape with improved matching
 *
 * Source: https://www.euroncap.com/en/ratings/a-z-listing/
 * Target: safety_ratings table
 *
 * Improvements over 11-euroncap-full-scrape:
 *   - Parses A-Z listing for all makes/models/years/stars
 *   - Fetches detail pages for 4 sub-scores
 *   - Better brand alias mapping
 *   - Year overlap matching with generations.production_start/end
 *   - Never overwrites confidence A ratings
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/50-euroncap-api-v2.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/50-euroncap-api-v2.ts
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
const DELAY_MS = 500;
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');
const CHECKPOINT_PATH = path.join(DATA_DIR, 'euroncap-api-v2-checkpoint.json');

// Brand aliases: EuroNCAP name → DB name
const BRAND_ALIASES: Record<string, string> = {
  'vw': 'Volkswagen',
  'volkswagen': 'Volkswagen',
  'merc': 'Mercedes-Benz',
  'mercedes': 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  'alfa': 'Alfa Romeo',
  'alfa romeo': 'Alfa Romeo',
  'land rover': 'Land Rover',
  'rolls royce': 'Rolls-Royce',
  'rolls-royce': 'Rolls-Royce',
  'aston martin': 'Aston Martin',
  'bmw': 'BMW',
  'ds': 'DS',
  'ds automobiles': 'DS',
  'mg': 'MG',
  'seat': 'SEAT',
  'cupra': 'Cupra',
  'mini': 'MINI',
  'smart': 'Smart',
};

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) return fetchPage(loc.startsWith('/') ? `https://www.euroncap.com${loc}` : loc).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return; }
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

interface EuroNCAPEntry {
  brand: string;
  model: string;
  year: number;
  stars: number;
  detailUrl: string;
  adult_pct?: number;
  child_pct?: number;
  pedestrian_pct?: number;
  safety_assist_pct?: number;
}

interface Checkpoint {
  entries: EuroNCAPEntry[];
  detailsFetched: number;
  phase: 'listing' | 'details' | 'matching' | 'done';
}

function parseAZListing(html: string): EuroNCAPEntry[] {
  const entries: EuroNCAPEntry[] = [];

  // EuroNCAP A-Z listing uses table rows with rating data
  // Pattern: <tr> with make, model, year, stars, link
  const rowRegex = /<tr[^>]*class="[^"]*"[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowRegex) || [];

  for (const row of rows) {
    // Extract link
    const linkMatch = row.match(/href="(\/en\/results\/[^"]+)"/i);
    // Extract text cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
    }

    if (cells.length >= 3) {
      const brand = cells[0];
      const model = cells[1];
      const yearStr = cells[2];
      const starsMatch = row.match(/(\d)\s*(?:star|étoile)/i) || row.match(/data-stars="(\d)"/i);

      // Also try to find stars from star images/classes
      let stars = 0;
      if (starsMatch) {
        stars = parseInt(starsMatch[1]);
      } else {
        const starImgCount = (row.match(/star-full|star_full|icon-star|rated/gi) || []).length;
        if (starImgCount > 0 && starImgCount <= 5) stars = starImgCount;
      }

      const year = parseInt(yearStr);
      if (brand && model && year >= 1997 && year <= 2026 && stars >= 1 && stars <= 5) {
        entries.push({
          brand,
          model,
          year,
          stars,
          detailUrl: linkMatch ? `https://www.euroncap.com${linkMatch[1]}` : '',
        });
      }
    }
  }

  // Also try JSON-LD or structured data
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const content = block.replace(/<\/?script[^>]*>/gi, '');
        const data = JSON.parse(content);
        if (data['@type'] === 'ItemList' && data.itemListElement) {
          for (const item of data.itemListElement) {
            // Parse from structured data if available
          }
        }
      } catch { /* ignore parse errors */ }
    }
  }

  // Fallback: try Umbraco API which the old script used
  return entries;
}

function parseDetailPage(html: string): { adult_pct?: number; child_pct?: number; pedestrian_pct?: number; safety_assist_pct?: number } {
  const result: any = {};

  // Look for percentage patterns
  const adultMatch = html.match(/adult\s*(?:occupant)?[^0-9]*?(\d{1,3})\s*%/i);
  const childMatch = html.match(/child\s*(?:occupant)?[^0-9]*?(\d{1,3})\s*%/i);
  const pedMatch = html.match(/pedestrian[^0-9]*?(\d{1,3})\s*%/i) || html.match(/vulnerable\s*road\s*user[^0-9]*?(\d{1,3})\s*%/i);
  const assistMatch = html.match(/safety\s*assist[^0-9]*?(\d{1,3})\s*%/i);

  if (adultMatch) result.adult_pct = parseInt(adultMatch[1]);
  if (childMatch) result.child_pct = parseInt(childMatch[1]);
  if (pedMatch) result.pedestrian_pct = parseInt(pedMatch[1]);
  if (assistMatch) result.safety_assist_pct = parseInt(assistMatch[1]);

  // Also try data attributes
  const dataAdult = html.match(/data-adult="(\d+)"/i);
  const dataChild = html.match(/data-child="(\d+)"/i);
  const dataPed = html.match(/data-pedestrian="(\d+)"/i);
  const dataAssist = html.match(/data-assist="(\d+)"/i);

  if (dataAdult && !result.adult_pct) result.adult_pct = parseInt(dataAdult[1]);
  if (dataChild && !result.child_pct) result.child_pct = parseInt(dataChild[1]);
  if (dataPed && !result.pedestrian_pct) result.pedestrian_pct = parseInt(dataPed[1]);
  if (dataAssist && !result.safety_assist_pct) result.safety_assist_pct = parseInt(dataAssist[1]);

  return result;
}

async function fetchEuroNCAPViaAPI(): Promise<EuroNCAPEntry[]> {
  // Try the Umbraco Content Delivery API (what the old script used)
  const entries: EuroNCAPEntry[] = [];

  // The EuroNCAP website uses an internal API for ratings
  // Try: /umbraco/api/ratingsearchapi/GetByMake?make=BMW
  const apiBase = 'https://www.euroncap.com/umbraco/api/ratingsearchapi';

  // First get all makes
  try {
    console.log('  Trying Umbraco API...');
    const listHtml = await fetchPage(`${apiBase}/GetByMake`);
    // Parse the response (usually JSON)
    try {
      const data = JSON.parse(listHtml);
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.make && item.model && item.stars && item.yearOfPublication) {
            entries.push({
              brand: item.make,
              model: item.model,
              year: parseInt(item.yearOfPublication),
              stars: parseInt(item.stars),
              detailUrl: item.url ? `https://www.euroncap.com${item.url}` : '',
              adult_pct: item.adultOccupant ? parseInt(item.adultOccupant) : undefined,
              child_pct: item.childOccupant ? parseInt(item.childOccupant) : undefined,
              pedestrian_pct: item.pedestrian || item.vulnerableRoadUser ? parseInt(item.pedestrian || item.vulnerableRoadUser) : undefined,
              safety_assist_pct: item.safetyAssist ? parseInt(item.safetyAssist) : undefined,
            });
          }
        }
      }
    } catch {
      // Not JSON, try HTML parsing
    }
  } catch (e: any) {
    console.log(`  Umbraco API failed: ${e.message}`);
  }

  // If API didn't work, try the A-Z HTML page
  if (entries.length === 0) {
    console.log('  Trying A-Z listing HTML...');
    try {
      const html = await fetchPage('https://www.euroncap.com/en/ratings/a-z-listing/');
      const parsed = parseAZListing(html);
      entries.push(...parsed);
    } catch (e: any) {
      console.log(`  A-Z listing failed: ${e.message}`);
    }
  }

  // If still nothing, try the newer content API
  if (entries.length === 0) {
    console.log('  Trying content delivery API...');
    try {
      // EuroNCAP also exposes data via their content API
      const response = await fetchPage('https://www.euroncap.com/en/ratings/a-z-listing/?ajax=true&offset=0&count=2000');
      try {
        const data = JSON.parse(response);
        if (data.items || data.ratings || data.Results) {
          const items = data.items || data.ratings || data.Results || [];
          for (const item of items) {
            const brand = item.Make || item.make || item.brand || '';
            const model = item.Model || item.model || item.name || '';
            const year = parseInt(item.Year || item.year || item.yearOfPublication || '0');
            const stars = parseInt(item.Stars || item.stars || item.overallRating || '0');
            if (brand && model && year && stars) {
              entries.push({
                brand, model, year, stars,
                detailUrl: item.Url || item.url || '',
                adult_pct: parseInt(item.AdultOccupant || item.adultOccupant || '0') || undefined,
                child_pct: parseInt(item.ChildOccupant || item.childOccupant || '0') || undefined,
                pedestrian_pct: parseInt(item.Pedestrian || item.pedestrian || item.VulnerableRoadUser || '0') || undefined,
                safety_assist_pct: parseInt(item.SafetyAssist || item.safetyAssist || '0') || undefined,
              });
            }
          }
        }
      } catch { /* not JSON */ }
    } catch (e: any) {
      console.log(`  Content API failed: ${e.message}`);
    }
  }

  return entries;
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  50-EURONCAP-API-V2 — Re-scrape with improved matching');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load checkpoint
  let checkpoint: Checkpoint | null = null;
  if (fs.existsSync(CHECKPOINT_PATH)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
    console.log(`\n  Resuming from checkpoint: ${checkpoint!.phase}, ${checkpoint!.entries.length} entries`);
  }

  // Phase 1: Fetch EuroNCAP entries
  let entries: EuroNCAPEntry[] = checkpoint?.entries || [];

  if (!checkpoint || checkpoint.phase === 'listing') {
    console.log('\n  Phase 1: Fetching EuroNCAP ratings...');
    entries = await fetchEuroNCAPViaAPI();
    console.log(`  Found ${entries.length} entries from EuroNCAP`);

    // Save checkpoint
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({ entries, detailsFetched: 0, phase: 'details' }, null, 2));
  }

  // Phase 2: Fetch detail pages for sub-scores (if missing)
  if (entries.length > 0) {
    const needDetails = entries.filter(e => e.detailUrl && !e.adult_pct);
    if (needDetails.length > 0) {
      console.log(`\n  Phase 2: Fetching ${needDetails.length} detail pages...`);
      let fetched = checkpoint?.detailsFetched || 0;

      for (let i = fetched; i < needDetails.length; i++) {
        const entry = needDetails[i];
        try {
          const html = await fetchPage(entry.detailUrl);
          const scores = parseDetailPage(html);
          Object.assign(entry, scores);
        } catch (e: any) {
          // Skip failed detail fetches
        }
        await sleep(DELAY_MS);

        if (i > 0 && i % 50 === 0) {
          console.log(`    ${i}/${needDetails.length} details fetched`);
          fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({ entries, detailsFetched: i, phase: 'details' }, null, 2));
        }
      }
    }
  }

  // Phase 3: Match against DB
  console.log('\n  Phase 3: Matching against DB...');

  const gens = await paginateAll(
    'generations',
    'id, name, slug, internal_code, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Loaded ${gens.length} generations`);

  // Load existing safety ratings
  const existingRatings = await paginateAll('safety_ratings', 'generation_id, confidence');
  const existingA = new Set(existingRatings.filter((r: any) => r.confidence === 'A').map((r: any) => r.generation_id));
  const existingAll = new Set(existingRatings.map((r: any) => r.generation_id));
  console.log(`  Existing ratings: ${existingRatings.length} (${existingA.size} at confidence A)`);

  // Build gen index: normalized "brand|model" → generations[]
  const genIndex = new Map<string, any[]>();
  for (const gen of gens) {
    const brand = gen.model?.brand?.name;
    const model = gen.model?.name;
    if (!brand || !model) continue;
    const key = normalize(`${brand}|${model}`);
    if (!genIndex.has(key)) genIndex.set(key, []);
    genIndex.get(key)!.push(gen);
  }

  // Match entries to generations
  const matched: Array<{ entry: EuroNCAPEntry; gen: any }> = [];
  let skippedExistingA = 0;
  let noMatch = 0;

  for (const entry of entries) {
    // Resolve brand alias
    const brandNorm = normalize(entry.brand);
    const resolvedBrand = BRAND_ALIASES[brandNorm] || entry.brand;

    // Try direct match
    const key = normalize(`${resolvedBrand}|${entry.model}`);
    let candidates = genIndex.get(key) || [];

    // Try fuzzy match if no direct hit
    if (candidates.length === 0) {
      const modelNorm = normalize(entry.model);
      for (const [k, v] of genIndex) {
        const [bk, mk] = k.split('|');
        if (!bk.includes(normalize(resolvedBrand)) && !normalize(resolvedBrand).includes(bk)) continue;
        if (mk.includes(modelNorm) || modelNorm.includes(mk)) {
          candidates = v;
          break;
        }
      }
    }

    if (candidates.length === 0) {
      noMatch++;
      continue;
    }

    // Find best gen by year overlap
    const bestGen = candidates.find(g => {
      const startYear = g.production_start ? new Date(g.production_start).getFullYear() : 0;
      const endYear = g.production_end ? new Date(g.production_end).getFullYear() : 2099;
      return entry.year >= startYear - 1 && entry.year <= endYear + 1;
    }) || candidates.reduce((a: any, b: any) => {
      const aStart = a.production_start ? new Date(a.production_start).getFullYear() : 2000;
      const bStart = b.production_start ? new Date(b.production_start).getFullYear() : 2000;
      return Math.abs(aStart - entry.year) < Math.abs(bStart - entry.year) ? a : b;
    });

    if (existingA.has(bestGen.id)) {
      skippedExistingA++;
      continue;
    }

    matched.push({ entry, gen: bestGen });
  }

  console.log(`  Matched: ${matched.length}`);
  console.log(`  Skipped (existing A): ${skippedExistingA}`);
  console.log(`  No match: ${noMatch}`);

  // Phase 4: Upsert
  const toUpsert = matched.map(({ entry, gen }) => ({
    generation_id: gen.id,
    stars: entry.stars,
    adult_occupant_pct: entry.adult_pct || null,
    child_occupant_pct: entry.child_pct || null,
    pedestrian_pct: entry.pedestrian_pct || null,
    safety_assist_pct: entry.safety_assist_pct || null,
    test_year: entry.year,
    source_url: entry.detailUrl || 'euroncap-api-v2',
    confidence: 'A',
  }));

  console.log(`\n  Phase 4: Upserting ${toUpsert.length} ratings...`);

  let upserted = 0;
  if (!DRY_RUN && toUpsert.length > 0) {
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').upsert(batch, { onConflict: 'generation_id' });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        upserted += batch.length;
      }
    }
  }

  // Report
  const report = {
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : 'live',
    entries_found: entries.length,
    matched: matched.length,
    skipped_existing_a: skippedExistingA,
    no_match: noMatch,
    upserted,
  };

  fs.writeFileSync(path.join(DATA_DIR, 'euroncap-api-v2-report.json'), JSON.stringify(report, null, 2));
  console.log('\n  Report saved to data/euroncap-api-v2-report.json');
  console.log(`\n  ${DRY_RUN ? 'DRY RUN — no writes' : `DONE — ${upserted} ratings upserted`}`);
}

main().catch(console.error);
