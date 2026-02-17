/**
 * FLM AUTO — Full EuroNCAP Scraper
 * Scrapes 500+ vehicle ratings from EuroNCAP sitemap + individual pages
 * Combines with existing JSON data files
 * Matches to generations in DB
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-euroncap-full.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/euroncap-scrape-checkpoint.json');
const DELAY_MS = 1500;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchUrl(res.headers.location!).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

interface RatingEntry {
  brand: string;
  model: string;
  year_tested: number;
  stars: number;
  adult_pct: number | null;
  child_pct: number | null;
  pedestrian_pct: number | null;
  safety_assist_pct: number | null;
  source_url: string;
  euroncap_id: string;
}

function parseRatingPage(html: string, url: string): Partial<RatingEntry> | null {
  // Extract star rating from image: stars5-165x24.png
  const starMatch = html.match(/src="[^"]*stars(\d)-/);
  const stars = starMatch ? parseInt(starMatch[1]) : null;
  if (!stars) return null;

  // Extract year: year">2019
  const yearMatch = html.match(/year">(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Extract percentages in order: adult, child, pedestrian, safety
  const pctMatches: number[] = [];
  const pctRegex = /class="rating-images\s+(adult-occupant|child-occupant|pedestrian|safety-assist)"[^]*?(\d+)%/g;
  let m;
  while ((m = pctRegex.exec(html)) !== null) {
    pctMatches.push(parseInt(m[2]));
  }

  // Fallback: just grab first 4 percentages near rating sections
  if (pctMatches.length < 4) {
    pctMatches.length = 0;
    const simpleRegex = /class="rating-images[^"]*"[\s\S]*?(\d+)%/g;
    let sm;
    while ((sm = simpleRegex.exec(html)) !== null && pctMatches.length < 4) {
      pctMatches.push(parseInt(sm[1]));
    }
  }

  return {
    year_tested: year || undefined,
    stars,
    adult_pct: pctMatches[0] || null,
    child_pct: pctMatches[1] || null,
    pedestrian_pct: pctMatches[2] || null,
    safety_assist_pct: pctMatches[3] || null,
    source_url: url,
  };
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

// Normalize brand names for matching
const BRAND_ALIASES: Record<string, string> = {
  'vw': 'volkswagen', 'mercedes': 'mercedes-benz', 'merc': 'mercedes-benz',
  'opel/vauxhall': 'opel', 'opel%2fvauxhall': 'opel',
  'alfa': 'alfa romeo', 'alfa-romeo': 'alfa romeo',
  'land-rover': 'land rover', 'aston-martin': 'aston martin',
  'rolls-royce': 'rolls royce', 'ds': 'ds automobiles',
  'škoda': 'skoda', 'citroën': 'citroen', 'bmw': 'bmw',
};

function normalizeBrand(raw: string): string {
  const lower = decodeURIComponent(raw).toLowerCase().replace(/[+_]/g, ' ').trim();
  return BRAND_ALIASES[lower] || lower;
}

function normalizeModel(raw: string): string {
  return decodeURIComponent(raw).replace(/[+_]/g, ' ').trim();
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Full EuroNCAP Scraper');
  console.log('  Target: ≥500 generations with safety rating');
  console.log('═══════════════════════════════════════════════════════\n');

  // Load checkpoint
  let checkpoint: { scrapedUrls: Record<string, RatingEntry>; completed: string[] } = { scrapedUrls: {}, completed: [] };
  if (fs.existsSync(CHECKPOINT_FILE)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    console.log(`Loaded checkpoint: ${Object.keys(checkpoint.scrapedUrls).length} scraped, ${checkpoint.completed.length} completed\n`);
  }

  // Step 1: Load existing JSON data
  console.log('═══ STEP 1: Loading existing JSON data ═══\n');

  const extendedData: Record<string, RatingEntry> = {};

  // Load extended database
  const extPath = path.resolve(__dirname, '../data/EURONCAP_EXTENDED_DATABASE.json');
  if (fs.existsSync(extPath)) {
    const ext = JSON.parse(fs.readFileSync(extPath, 'utf-8'));
    for (const [brandKey, models] of Object.entries(ext.ratings_2024_2025 || {})) {
      for (const [modelKey, data] of Object.entries(models as Record<string, any>)) {
        const brand = normalizeBrand(brandKey);
        const key = `${brand}|${(data.model || modelKey).toLowerCase()}`;
        extendedData[key] = {
          brand,
          model: data.model || modelKey,
          year_tested: data.year_tested,
          stars: data.stars,
          adult_pct: data.adult_occupant_pct || null,
          child_pct: data.child_occupant_pct || null,
          pedestrian_pct: data.pedestrian_pct || null,
          safety_assist_pct: data.safety_assist_pct || null,
          source_url: data.url || '',
          euroncap_id: data.url ? data.url.split('/').pop() || '' : '',
        };
      }
    }
    console.log(`  Extended DB: ${Object.keys(extendedData).length} entries`);
  }

  // Load basic ratings
  const basicPath = path.resolve(__dirname, '../data/euroncap-ratings.json');
  if (fs.existsSync(basicPath)) {
    const basic = JSON.parse(fs.readFileSync(basicPath, 'utf-8'));
    let added = 0;
    for (const r of basic) {
      const key = `${normalizeBrand(r.brand)}|${r.model.toLowerCase()}`;
      if (!extendedData[key]) {
        extendedData[key] = {
          brand: normalizeBrand(r.brand),
          model: r.model,
          year_tested: r.year,
          stars: r.overall_rating,
          adult_pct: r.adult_occupant || null,
          child_pct: r.child_occupant || null,
          pedestrian_pct: r.vulnerable_road_users || null,
          safety_assist_pct: r.safety_assist || null,
          source_url: r.source_url || '',
          euroncap_id: '',
        };
        added++;
      }
    }
    console.log(`  Basic ratings: +${added} new entries`);
  }

  console.log(`  Total from JSON files: ${Object.keys(extendedData).length}\n`);

  // Step 2: Fetch sitemap for additional URLs
  console.log('═══ STEP 2: Fetching EuroNCAP sitemap ═══\n');

  let sitemapUrls: { brand: string; model: string; id: string; url: string }[] = [];

  try {
    const sitemap = await fetchUrl('https://www.euroncap.com/sitemap.xml');
    const urlMatches = sitemap.match(/https:\/\/www\.euroncap\.com\/en\/results\/[^<]+/g) || [];
    for (const url of urlMatches) {
      const parts = url.replace('https://www.euroncap.com/en/results/', '').split('/');
      if (parts.length >= 3) {
        sitemapUrls.push({
          brand: parts[0],
          model: parts[1],
          id: parts[2],
          url,
        });
      }
    }
    console.log(`  Found ${sitemapUrls.length} result URLs in sitemap\n`);
  } catch (e) {
    console.log('  Failed to fetch sitemap, continuing with existing data\n');
  }

  // Step 3: Scrape individual pages for URLs not yet in our data
  console.log('═══ STEP 3: Scraping individual rating pages ═══\n');

  // Merge sitemap data into extended data
  const toScrape = sitemapUrls.filter(s => {
    const key = `${normalizeBrand(s.brand)}|${normalizeModel(s.model).toLowerCase()}`;
    return !checkpoint.scrapedUrls[s.url] && !checkpoint.completed.includes(s.url);
  });

  console.log(`  To scrape: ${toScrape.length} pages\n`);

  let scraped = 0;
  let errors = 0;

  for (const item of toScrape) {
    try {
      const html = await fetchUrl(item.url);
      const parsed = parseRatingPage(html, item.url);

      if (parsed && parsed.stars) {
        const brand = normalizeBrand(item.brand);
        const model = normalizeModel(item.model);
        const key = `${brand}|${model.toLowerCase()}`;

        const entry: RatingEntry = {
          brand,
          model,
          year_tested: parsed.year_tested || 0,
          stars: parsed.stars,
          adult_pct: parsed.adult_pct,
          child_pct: parsed.child_pct,
          pedestrian_pct: parsed.pedestrian_pct,
          safety_assist_pct: parsed.safety_assist_pct,
          source_url: item.url,
          euroncap_id: item.id,
        };

        // Only add if we don't have this entry yet, or if this one has more data
        if (!extendedData[key] || (!extendedData[key].adult_pct && entry.adult_pct)) {
          extendedData[key] = entry;
        }
        checkpoint.scrapedUrls[item.url] = entry;
        scraped++;
      } else {
        checkpoint.completed.push(item.url);
      }
    } catch (e) {
      errors++;
      checkpoint.completed.push(item.url);
    }

    // Progress + checkpoint
    const total = scraped + errors + checkpoint.completed.length;
    if (total % 25 === 0 || scraped + errors === toScrape.length) {
      console.log(`  [${total}/${toScrape.length + Object.keys(checkpoint.scrapedUrls).length}] Scraped: ${scraped}, Errors: ${errors}, Total entries: ${Object.keys(extendedData).length}`);
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    }

    await sleep(DELAY_MS);
  }

  // Add previously scraped data
  for (const [url, entry] of Object.entries(checkpoint.scrapedUrls)) {
    const key = `${entry.brand}|${entry.model.toLowerCase()}`;
    if (!extendedData[key] || (!extendedData[key].adult_pct && entry.adult_pct)) {
      extendedData[key] = entry;
    }
  }

  console.log(`\n  Final rating entries: ${Object.keys(extendedData).length}\n`);

  // Step 4: Load DB generations for matching
  console.log('═══ STEP 4: Matching to DB generations ═══\n');

  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name, brand_id');
  const generations = await paginateAll('generations', 'id, model_id, name, production_start, production_end');

  const brandMap = new Map<string, string>(); // normalized name → id
  for (const b of brands) {
    brandMap.set(b.name.toLowerCase(), b.id);
    // Also add without hyphens/spaces
    brandMap.set(b.name.toLowerCase().replace(/[-\s]/g, ''), b.id);
  }

  // Map brand_id → models
  const modelsByBrand = new Map<string, any[]>();
  for (const m of models) {
    if (!modelsByBrand.has(m.brand_id)) modelsByBrand.set(m.brand_id, []);
    modelsByBrand.get(m.brand_id)!.push(m);
  }

  // Map model_id → generations
  const gensByModel = new Map<string, any[]>();
  for (const g of generations) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Check existing safety_ratings
  const existingRatings = await paginateAll('safety_ratings', 'generation_id, source_url');
  const existingGenIds = new Set(existingRatings.map(r => r.generation_id));
  console.log(`  Existing safety_ratings: ${existingRatings.length}`);
  console.log(`  Brands in DB: ${brands.length}, Models: ${models.length}, Generations: ${generations.length}\n`);

  function findBrandId(brandName: string): string | null {
    const norm = brandName.toLowerCase();
    return brandMap.get(norm) || brandMap.get(norm.replace(/[-\s]/g, '')) || null;
  }

  function fuzzyMatch(a: string, b: string): boolean {
    const na = a.toLowerCase().replace(/[-\s_]/g, '').replace(/class/g, '').replace(/series/g, '');
    const nb = b.toLowerCase().replace(/[-\s_]/g, '').replace(/class/g, '').replace(/series/g, '');
    return na === nb || na.includes(nb) || nb.includes(na);
  }

  function findGeneration(brandName: string, modelName: string, yearTested: number): string | null {
    const brandId = findBrandId(brandName);
    if (!brandId) return null;

    const brandModels = modelsByBrand.get(brandId) || [];

    // Find matching model
    let matchedModel: any = null;
    for (const m of brandModels) {
      if (fuzzyMatch(m.name, modelName)) {
        matchedModel = m;
        break;
      }
    }

    // Try partial match
    if (!matchedModel) {
      const modelLower = modelName.toLowerCase().replace(/[-\s]/g, '');
      for (const m of brandModels) {
        const mLower = m.name.toLowerCase().replace(/[-\s]/g, '');
        if (modelLower.includes(mLower) || mLower.includes(modelLower)) {
          matchedModel = m;
          break;
        }
      }
    }

    if (!matchedModel) return null;

    // Find generation by year
    const gens = gensByModel.get(matchedModel.id) || [];
    if (gens.length === 0) return null;

    // Try to find generation that covers the test year
    for (const g of gens) {
      const start = g.production_start || 0;
      const end = g.production_end || 2030;
      if (yearTested >= start - 1 && yearTested <= end + 1) {
        return g.id;
      }
    }

    // Fallback: most recent generation
    gens.sort((a: any, b: any) => (b.production_start || 0) - (a.production_start || 0));
    return gens[0].id;
  }

  // Step 5: Insert into safety_ratings
  console.log('═══ STEP 5: Inserting safety ratings ═══\n');

  let matched = 0;
  let inserted = 0;
  let skipped = 0;
  let insertErrors = 0;
  let unmatched: string[] = [];

  const entries = Object.values(extendedData);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const genId = findGeneration(entry.brand, entry.model, entry.year_tested);

    if (!genId) {
      unmatched.push(`${entry.brand} ${entry.model} (${entry.year_tested})`);
      continue;
    }

    matched++;

    if (existingGenIds.has(genId)) {
      // Update if we have more data
      if (entry.adult_pct) {
        const { error } = await supabase.from('safety_ratings').update({
          stars: entry.stars,
          adult_occupant_pct: entry.adult_pct,
          child_occupant_pct: entry.child_pct,
          pedestrian_pct: entry.pedestrian_pct,
          safety_assist_pct: entry.safety_assist_pct,
          test_year: entry.year_tested,
          source_url: entry.source_url,
          euroncap_id: entry.euroncap_id || null,
        }).eq('generation_id', genId);
        if (!error) skipped++; else insertErrors++;
      } else {
        skipped++;
      }
      continue;
    }

    const { error } = await supabase.from('safety_ratings').insert({
      generation_id: genId,
      stars: entry.stars,
      adult_occupant_pct: entry.adult_pct,
      child_occupant_pct: entry.child_pct,
      pedestrian_pct: entry.pedestrian_pct,
      safety_assist_pct: entry.safety_assist_pct,
      test_year: entry.year_tested,
      source_url: entry.source_url,
      euroncap_id: entry.euroncap_id || null,
    });

    if (!error) {
      inserted++;
      existingGenIds.add(genId);
    } else {
      insertErrors++;
      if (insertErrors <= 5) console.log(`  ERROR: ${error.message}`);
    }

    if ((i + 1) % 50 === 0 || i === entries.length - 1) {
      console.log(`  [${i + 1}/${entries.length}] Matched: ${matched}, Inserted: ${inserted}, Updated: ${skipped}, Errors: ${insertErrors}`);
    }
  }

  // Final count
  const { count: finalCount } = await supabase.from('safety_ratings').select('*', { count: 'exact', head: true });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  EURONCAP SCRAPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Rating entries found:  ${entries.length}`);
  console.log(`  Matched to generations: ${matched}`);
  console.log(`  Inserted:              ${inserted}`);
  console.log(`  Updated:               ${skipped}`);
  console.log(`  Errors:                ${insertErrors}`);
  console.log(`  Unmatched:             ${unmatched.length}`);
  console.log(`  Total safety_ratings:  ${finalCount}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (unmatched.length > 0 && unmatched.length <= 30) {
    console.log('Unmatched entries:');
    for (const u of unmatched) console.log(`  - ${u}`);
  }

  // Save checkpoint
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

main().catch(console.error);
