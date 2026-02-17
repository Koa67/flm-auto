/**
 * 01-ultimatespecs-deep.ts — REAL deep scrape pipeline
 *
 * Problem: Existing JSON files only have 3 fields (power_hp, power_kw, displacement_cc)
 * because the original scraper only had model listing URLs, not variant detail pages.
 *
 * Strategy (2-pass):
 *   Pass 1: For each model listing URL, fetch the page and extract all variant .html links
 *   Pass 2: For each variant URL, fetch the detail page and parse ALL specs
 *   Then: Match to DB generations and upsert into third_party_specs
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/01-ultimatespecs-deep.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/01-ultimatespecs-deep.ts --dry-run --brand=audi --limit=5
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/01-ultimatespecs-deep.ts --pass2-only  (skip listing fetch)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

// CLI
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BRAND_FILTER = args.find(a => a.startsWith('--brand='))?.split('=')[1]?.toLowerCase();
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0;
const PASS2_ONLY = args.includes('--pass2-only');
const DELAY_MS = 350;

const DATA_DIR = path.resolve(__dirname, '../../data/ultimatespecs');
const VARIANTS_DIR = path.resolve(__dirname, '../../data/ultimatespecs-variants');
const CHECKPOINT = path.resolve(__dirname, '../../data/pipeline-01-deep-checkpoint.json');
const SOURCE = 'UltimateSpecs';

// ═══════════ HTTP ═══════════
function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : `https://www.ultimatespecs.com${url}`;
    const req = https.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) return fetchPage(loc).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════ PASS 1: Extract variant URLs from listing pages ═══════════
function extractVariantUrls(html: string): string[] {
  const urls: string[] = [];
  // Links to individual variants: /car-specs/Brand/12345/Brand-Model-Variant.html
  const regex = /href="(\/car-specs\/[^"]+\.html)"/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    // Skip compare pages, gallery, etc
    if (url.includes('comparator') || url.includes('gallery') || url.includes('advanced')) continue;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

// ═══════════ PASS 2: Parse specs from variant detail page ═══════════
function parseVariantSpecs(html: string): Record<string, any> {
  const specs: Record<string, any> = {};

  // Extract from table rows: <td>Key</td><td>Value</td> pattern
  // UltimateSpecs uses | Key : | Value | pattern in text
  const tableRegex = /\|\s*([^|]+?)\s*:\s*\|\s*([^|]+?)\s*\|/g;
  let match;
  while ((match = tableRegex.exec(html)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key && value && value !== '-' && value !== 'N/A' && key.length < 100) {
      specs[key] = value;
    }
  }

  // Also try the raw HTML table extraction as fallback
  const htmlTableRegex = /<t[hd][^>]*>\s*([\s\S]*?)\s*<\/t[hd]>\s*<t[hd][^>]*>\s*([\s\S]*?)\s*<\/t[hd]>/gi;
  while ((match = htmlTableRegex.exec(html)) !== null) {
    const key = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const value = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (key && value && value !== '-' && value !== 'N/A' && key.length < 100 && !specs[key]) {
      specs[key] = value;
    }
  }

  return specs;
}

function parseNum(val: string | undefined): number | null {
  if (!val) return null;
  // Extract first number with decimals
  const m = val.match(/([\d,]+\.?\d*)/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(',', ''));
  return isNaN(num) ? null : num;
}

function parseNumMetric(val: string | undefined): number | null {
  if (!val) return null;
  // Try to extract metric value (often second in "X inches / Y cm" format)
  const cmMatch = val.match(/([\d,.]+)\s*cm/i);
  if (cmMatch) return parseFloat(cmMatch[1].replace(',', '')) * 10; // cm to mm
  const mmMatch = val.match(/([\d,.]+)\s*mm/i);
  if (mmMatch) return parseFloat(mmMatch[1].replace(',', ''));
  const kgMatch = val.match(/([\d,.]+)\s*kg/i);
  if (kgMatch) return parseFloat(kgMatch[1].replace(',', ''));
  const lMatch = val.match(/([\d,.]+)\s*L(?:\b|\/)/i);
  if (lMatch) return parseFloat(lMatch[1].replace(',', ''));
  const kmhMatch = val.match(/([\d,.]+)\s*km\/h/i);
  if (kmhMatch) return parseFloat(kmhMatch[1].replace(',', ''));
  const nmMatch = val.match(/([\d,.]+)\s*Nm/i);
  if (nmMatch) return parseFloat(nmMatch[1].replace(',', ''));
  const cm3Match = val.match(/([\d,.]+)\s*cm3/i);
  if (cm3Match) return parseFloat(cm3Match[1].replace(',', ''));
  return parseNum(val);
}

function normalizeSpecKey(raw: string): { key: string, extractor: (v: string) => number | null } | null {
  const lower = raw.toLowerCase().replace(/\s*:\s*$/, '').trim();

  // Dimensions
  if (lower.includes('length') && !lower.includes('ratio')) return { key: 'length_mm', extractor: parseNumMetric };
  if (lower.includes('width') && !lower.includes('wheel') && !lower.includes('track')) return { key: 'width_mm', extractor: parseNumMetric };
  if (lower.includes('height')) return { key: 'height_mm', extractor: parseNumMetric };
  if (lower.includes('wheelbase')) return { key: 'wheelbase_mm', extractor: parseNumMetric };
  if (lower.includes('front axle') || lower.includes('front track')) return { key: 'track_front_mm', extractor: parseNumMetric };
  if (lower.includes('rear axle') || lower.includes('rear track')) return { key: 'track_rear_mm', extractor: parseNumMetric };

  // Weight
  if (lower.includes('curb weight') || lower.includes('kerb weight') || lower.includes('unladen')) return { key: 'curb_weight_kg', extractor: parseNumMetric };

  // Interior
  if (lower.includes('seat')) return { key: 'seats', extractor: parseNum };
  if (lower.includes('door') && !lower.includes('outdoor')) return { key: 'doors', extractor: parseNum };
  if (lower.includes('trunk') && !lower.includes('first')) return { key: 'trunk_volume_l', extractor: (v) => { const m = v.match(/([\d,.]+)\s*L/i); return m ? parseFloat(m[1].replace(',','')) : parseNum(v); }};
  if (lower.includes('trunk') && lower.includes('first')) return { key: 'trunk_volume_max_l', extractor: (v) => { const m = v.match(/([\d,.]+)\s*L/i); return m ? parseFloat(m[1].replace(',','')) : parseNum(v); }};

  // Engine
  if (lower.includes('displacement') || lower.includes('engine size')) return { key: 'displacement_cc', extractor: (v) => { const m = v.match(/([\d,.]+)\s*cm3/i); return m ? parseFloat(m[1].replace(',','')) : parseNum(v); }};
  if (lower.includes('cylinder') && lower.includes('number')) return { key: 'cylinders', extractor: parseNum };
  if (lower.includes('engine type') && lower.includes('cylinder')) return { key: 'engine_layout', extractor: () => null }; // string value
  if (lower.includes('horsepower') || (lower.includes('power') && !lower.includes('weight') && !lower.includes('ratio'))) return { key: 'power_hp', extractor: (v) => { const m = v.match(/([\d,.]+)\s*(?:HP|bhp)/i); return m ? parseFloat(m[1].replace(',','')) : parseNum(v); }};
  if (lower.includes('torque') || lower.includes('maximum torque')) return { key: 'torque_nm', extractor: parseNumMetric };
  if (lower.includes('fuel type') || lower.includes('fuel :')) return { key: 'fuel_type', extractor: () => null }; // string value
  if (lower.includes('compression')) return { key: 'compression_ratio', extractor: parseNum };

  // Performance
  if (lower.includes('top speed')) return { key: 'top_speed_kmh', extractor: parseNumMetric };
  if (lower.includes('0 to 100') || lower.includes('0-100')) return { key: 'acceleration_0_100', extractor: (v) => { const m = v.match(/([\d,.]+)\s*s/i); return m ? parseFloat(m[1].replace(',','')) : parseNum(v); }};

  // Consumption
  if (lower.includes('combined') && (lower.includes('fuel') || lower.includes('consumption') || lower.includes('economy'))) return { key: 'fuel_consumption_combined', extractor: (v) => { const m = v.match(/([\d,.]+)\s*L\/100/i); return m ? parseFloat(m[1].replace(',','')) : null; }};
  if (lower.includes('city') && (lower.includes('fuel') || lower.includes('consumption'))) return { key: 'fuel_consumption_city', extractor: (v) => { const m = v.match(/([\d,.]+)\s*L\/100/i); return m ? parseFloat(m[1].replace(',','')) : null; }};
  if ((lower.includes('open road') || lower.includes('highway') || lower.includes('extra')) && (lower.includes('fuel') || lower.includes('consumption'))) return { key: 'fuel_consumption_highway', extractor: (v) => { const m = v.match(/([\d,.]+)\s*L\/100/i); return m ? parseFloat(m[1].replace(',','')) : null; }};
  if (lower.includes('co2')) return { key: 'co2_gkm', extractor: (v) => { const m = v.match(/([\d,.]+)\s*g\/km/i); return m ? parseFloat(m[1].replace(',','')) : parseNum(v); }};
  if (lower.includes('fuel tank')) return { key: 'fuel_tank_l', extractor: (v) => { const m = v.match(/([\d,.]+)\s*L/i); return m ? parseFloat(m[1].replace(',','')) : parseNum(v); }};
  if (lower.includes('range') && !lower.includes('rpm')) return { key: 'range_km', extractor: (v) => { const m = v.match(/([\d,.]+)\s*km/i); return m ? parseFloat(m[1].replace(',','')) : null; }};

  // Transmission
  if (lower.includes('drive') && lower.includes('wheel')) return { key: 'drivetrain', extractor: () => null }; // string
  if (lower.includes('transmission') || lower.includes('gearbox')) return { key: 'transmission', extractor: () => null }; // string

  // Tyres
  if (lower.includes('front tyre') || lower.includes('front tire')) return { key: 'tyre_front', extractor: () => null };
  if (lower.includes('rear tyre') || lower.includes('rear tire')) return { key: 'tyre_rear', extractor: () => null };

  return null;
}

// ═══════════ DB CACHES ═══════════
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
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

// ═══════════ CHECKPOINT ═══════════
function loadCheckpoint(): { processedListings: string[], processedVariants: string[] } {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8'));
  } catch {
    return { processedListings: [], processedVariants: [] };
  }
}
function saveCheckpoint(cp: { processedListings: string[], processedVariants: string[] }) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2));
}

// ═══════════ MAIN ═══════════
async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  01-ULTIMATESPECS-DEEP — 2-Pass Deep Scrape');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (BRAND_FILTER) console.log(`  Brand: ${BRAND_FILTER}`);
  if (LIMIT) console.log(`  Limit: ${LIMIT} variants per brand`);
  if (PASS2_ONLY) console.log(`  Skipping Pass 1 (--pass2-only)`);
  console.log('='.repeat(60));

  // Ensure dirs
  if (!fs.existsSync(VARIANTS_DIR)) fs.mkdirSync(VARIANTS_DIR, { recursive: true });

  const cp = loadCheckpoint();

  // ─── PASS 1: Fetch listing pages, extract variant URLs ───
  if (!PASS2_ONLY) {
    console.log('\n━━━ PASS 1: Fetching model listing pages for variant URLs ━━━');

    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).sort();
    let totalVariantUrls = 0;

    for (const file of files) {
      const brandSlug = file.replace('.json', '');
      if (BRAND_FILTER && !brandSlug.includes(BRAND_FILTER)) continue;

      let vehicles: any[];
      try {
        vehicles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
        if (!Array.isArray(vehicles)) continue;
      } catch { continue; }

      // Get unique listing URLs
      const listingUrls = [...new Set(vehicles.map(v => v.source_url).filter(Boolean))];
      console.log(`\n  ${brandSlug}: ${listingUrls.length} listing pages`);

      const brandVariants: { url: string, brand: string, generation: string }[] = [];

      for (const listUrl of listingUrls) {
        if (cp.processedListings.includes(listUrl)) {
          process.stdout.write('s');
          continue;
        }

        try {
          const html = await fetchPage(listUrl);
          const variantUrls = extractVariantUrls(html);

          for (const vu of variantUrls) {
            brandVariants.push({
              url: `https://www.ultimatespecs.com${vu}`,
              brand: brandSlug,
              generation: vehicles.find(v => v.source_url === listUrl)?.generation || '',
            });
          }

          cp.processedListings.push(listUrl);
          saveCheckpoint(cp);
          process.stdout.write(`+${variantUrls.length} `);
          totalVariantUrls += variantUrls.length;
          await sleep(DELAY_MS);
        } catch (e: any) {
          process.stdout.write('x');
        }
      }

      // Save variant URLs for this brand
      if (brandVariants.length > 0) {
        fs.writeFileSync(
          path.join(VARIANTS_DIR, `${brandSlug}.json`),
          JSON.stringify(brandVariants, null, 2)
        );
      }
    }
    console.log(`\n\n  Total variant URLs found: ${totalVariantUrls}`);
  }

  // ─── PASS 2: Fetch each variant page, parse specs, insert into DB ───
  console.log('\n━━━ PASS 2: Fetching variant detail pages & inserting specs ━━━');

  // Load DB caches
  console.log('  Loading DB caches...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  ${gens.length} generations loaded`);

  // Build lookup: normalize(brand) + normalize(model) → generation[]
  const genLookup = new Map<string, any[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const key = `${normalize(model.brand.name)}|${normalize(model.name)}`;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push(gen);
  }

  // Load existing specs for this source
  const existingSpecs = await paginateAll('third_party_specs', 'generation_id, spec_type, source');
  const existingSet = new Set(
    existingSpecs
      .filter(s => s.source === SOURCE)
      .map(s => `${s.generation_id}|${s.spec_type}`)
  );
  console.log(`  ${existingSet.size} existing UltimateSpecs entries`);

  // Read variant files
  const variantFiles = fs.readdirSync(VARIANTS_DIR).filter(f => f.endsWith('.json')).sort();
  if (variantFiles.length === 0) {
    console.log('  No variant files found. Run without --pass2-only first.');
    return;
  }

  const stats = {
    variantsTotal: 0,
    variantsFetched: 0,
    specsExtracted: 0,
    matched: 0,
    unmatched: 0,
    inserted: 0,
    skipped: 0,
    httpErrors: 0,
    parseErrors: 0,
  };

  for (const vFile of variantFiles) {
    const brandSlug = vFile.replace('.json', '');
    if (BRAND_FILTER && !brandSlug.includes(BRAND_FILTER)) continue;

    let variants: { url: string, brand: string, generation: string }[];
    try {
      variants = JSON.parse(fs.readFileSync(path.join(VARIANTS_DIR, vFile), 'utf-8'));
    } catch { continue; }

    if (LIMIT) variants = variants.slice(0, LIMIT);
    stats.variantsTotal += variants.length;

    console.log(`\n  ${brandSlug}: ${variants.length} variants`);

    for (const variant of variants) {
      if (cp.processedVariants.includes(variant.url)) {
        process.stdout.write('s');
        stats.skipped++;
        continue;
      }

      // Fetch variant page
      let html: string;
      try {
        html = await fetchPage(variant.url);
        stats.variantsFetched++;
        await sleep(DELAY_MS);
      } catch {
        stats.httpErrors++;
        process.stdout.write('x');
        continue;
      }

      // Parse raw specs from HTML
      const rawSpecs = parseVariantSpecs(html);
      if (Object.keys(rawSpecs).length < 3) {
        stats.parseErrors++;
        process.stdout.write('?');
        cp.processedVariants.push(variant.url);
        saveCheckpoint(cp);
        continue;
      }

      // Extract title for model matching
      const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/\s+specs.*$/i, '').trim() : '';
      
      // Extract brand and model from title: "Audi A4 (B9) 2.0 TFSI 252HP S tronic Specs"
      const brandName = variant.brand.replace(/-/g, ' ');
      const modelFromTitle = title
        .replace(new RegExp(`^${brandName}\\s+`, 'i'), '')
        .replace(/\s+\d+\.\d+.*$/, '') // Remove engine spec suffix
        .replace(/\s*\([^)]+\)\s*$/, '') // Remove (B9) suffix
        .trim();

      // Match to DB generation
      let matchedGen: any = null;
      
      // Try exact model match
      for (const [key, genList] of genLookup) {
        const [bNorm, mNorm] = key.split('|');
        if (bNorm !== normalize(brandName)) continue;
        
        const modelNorm = normalize(modelFromTitle);
        if (mNorm === modelNorm || modelNorm.startsWith(mNorm) || mNorm.startsWith(modelNorm)) {
          matchedGen = genList[0]; // Take first generation
          break;
        }
      }

      // Fuzzy fallback
      if (!matchedGen) {
        for (const [key, genList] of genLookup) {
          const [bNorm, mNorm] = key.split('|');
          if (bNorm !== normalize(brandName)) continue;
          if (normalize(title).includes(mNorm) && mNorm.length >= 2) {
            matchedGen = genList[0];
            break;
          }
        }
      }

      if (!matchedGen) {
        stats.unmatched++;
        process.stdout.write('m');
        cp.processedVariants.push(variant.url);
        saveCheckpoint(cp);
        continue;
      }

      stats.matched++;

      // Normalize and insert specs
      const specsToInsert: any[] = [];
      const stringSpecs: Record<string, string> = {};

      for (const [rawKey, rawValue] of Object.entries(rawSpecs)) {
        const mapping = normalizeSpecKey(rawKey);
        if (!mapping) continue;

        const { key, extractor } = mapping;
        const numValue = extractor(rawValue);

        // Skip if already exists
        const existKey = `${matchedGen.id}|${key}`;
        if (existingSet.has(existKey)) continue;

        if (numValue !== null) {
          specsToInsert.push({
            generation_id: matchedGen.id,
            source: SOURCE,
            source_url: variant.url,
            spec_type: key,
            spec_value: numValue,
            raw_data: { raw_key: rawKey, raw_value: rawValue, variant_title: title },
          });
          existingSet.add(existKey);
          stats.specsExtracted++;
        } else if (typeof rawValue === 'string' && rawValue.length > 0) {
          // Store string values (drivetrain, fuel_type, etc.)
          stringSpecs[key] = rawValue;
          specsToInsert.push({
            generation_id: matchedGen.id,
            source: SOURCE,
            source_url: variant.url,
            spec_type: key,
            spec_value: 0,
            raw_data: { raw_key: rawKey, raw_value: rawValue, variant_title: title, string_value: rawValue },
          });
          existingSet.add(existKey);
          stats.specsExtracted++;
        }
      }

      // Insert
      if (!DRY_RUN && specsToInsert.length > 0) {
        for (let i = 0; i < specsToInsert.length; i += 50) {
          const batch = specsToInsert.slice(i, i + 50);
          const { error } = await supabase.from('third_party_specs').upsert(batch, {
            onConflict: 'generation_id,source,spec_type'
          });
          if (error) {
            process.stdout.write('E');
          } else {
            stats.inserted += batch.length;
          }
        }
        process.stdout.write('.');
      } else if (DRY_RUN && specsToInsert.length > 0) {
        process.stdout.write('+');
      } else {
        process.stdout.write('=');
      }

      cp.processedVariants.push(variant.url);
      if (stats.variantsFetched % 50 === 0) saveCheckpoint(cp);
    }

    saveCheckpoint(cp);
  }

  // Final stats
  console.log('\n\n' + '='.repeat(60));
  console.log('  DEEP SCRAPE RESULTS');
  console.log('='.repeat(60));
  console.log(`  Variants total:     ${stats.variantsTotal}`);
  console.log(`  Variants fetched:   ${stats.variantsFetched}`);
  console.log(`  Specs extracted:    ${stats.specsExtracted}`);
  console.log(`  Matched to DB:      ${stats.matched}`);
  console.log(`  Unmatched:          ${stats.unmatched}`);
  console.log(`  Inserted to DB:     ${stats.inserted}`);
  console.log(`  Skipped (exists):   ${stats.skipped}`);
  console.log(`  HTTP errors:        ${stats.httpErrors}`);
  console.log(`  Parse errors:       ${stats.parseErrors}`);
  console.log('='.repeat(60));

  // Save stats
  const statsPath = path.resolve(__dirname, '../../data/pipeline-01-deep-stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  console.log(`  Stats saved: ${statsPath}`);
}

main().catch(console.error);
