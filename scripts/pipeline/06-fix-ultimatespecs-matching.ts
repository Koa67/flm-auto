/**
 * 06-fix-ultimatespecs-matching.ts — Reprocess variant data with SMART matching
 *
 * The original 01-ultimatespecs-deep.ts matched to genList[0] (first generation).
 * This script re-reads the already-scraped variant HTML cache and rematches using:
 *   1. Brand + Model name matching (with aliases)
 *   2. Year extraction from variant title → production_start/end range
 *   3. Chassis code extraction → generations.chassis_code
 *   4. Generation name fuzzy match (e.g. "G20" in title → gen.name containing "G20")
 *
 * Does NOT re-scrape — works entirely from cached variant files in data/ultimatespecs-variants/
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/06-fix-ultimatespecs-matching.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/06-fix-ultimatespecs-matching.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/06-fix-ultimatespecs-matching.ts --brand=bmw
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BRAND_FILTER = process.argv.find(a => a.startsWith('--brand='))?.split('=')[1]?.toLowerCase();
const SOURCE = 'UltimateSpecs';
const BATCH_SIZE = 100;
const CHECKPOINT_PATH = path.resolve(__dirname, '../../data/pipeline-01-deep-checkpoint.json');
const VARIANTS_DIR = path.resolve(__dirname, '../../data/ultimatespecs-variants');
const CACHE_DIR = path.resolve(__dirname, '../../data/ultimatespecs-html-cache');

// ═══════════ DB ═══════════
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

// ═══════════ Year extraction from UltimateSpecs URL/title ═══════════
// URLs look like: /car-specs/Audi/12345/Audi-A4-(B9)-2.0-TFSI-252HP.html
// Titles: "Audi A4 (B9) 2.0 TFSI 252HP (2016-2019)"
function extractYearFromUrl(url: string): number | null {
  // Try year in parentheses at end: "-(2019)-" or "-(2016-2019)"
  const parenMatch = url.match(/\((\d{4})(?:-\d{4})?\)/);
  if (parenMatch) return parseInt(parenMatch[1]);
  
  // Try 4-digit year at the end of URL before .html
  const endMatch = url.match(/[-_](\d{4})(?:[-_.]|\.html)/);
  if (endMatch) {
    const y = parseInt(endMatch[1]);
    if (y >= 1950 && y <= 2030) return y;
  }
  return null;
}

function extractYearFromTitle(title: string): number | null {
  // "Audi A4 (B9) 2.0 TFSI 252HP (2016-2019)" → 2016
  const rangeMatch = title.match(/\((\d{4})\s*[-–]\s*(\d{4})\)/);
  if (rangeMatch) return parseInt(rangeMatch[1]);
  
  // "... 2020 ..." — last 4-digit number that's a plausible year
  const allYears = [...title.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m => parseInt(m[1]));
  if (allYears.length > 0) return allYears[allYears.length - 1];
  return null;
}

// ═══════════ Chassis code extraction ═══════════
// "BMW 3 Series (G20)" → "G20"
// "Audi A4 (B9)" → "B9"
// "Mercedes C-Class (W205)" → "W205"
function extractChassisCode(title: string): string | null {
  const match = title.match(/\(([A-Z][A-Z0-9]{1,5})\)/i);
  if (match) {
    const code = match[1].toUpperCase();
    // Filter out things that are clearly years
    if (/^\d{4}$/.test(code)) return null;
    return code;
  }
  return null;
}

// ═══════════ Smart matching ═══════════
interface GenEntry {
  gen: any;
  brandName: string;
  modelName: string;
  startYear: number;
  endYear: number;
  chassisCode: string | null;
  genName: string;
}

function buildGenIndex(gens: any[]): {
  byBrandModel: Map<string, GenEntry[]>;
  byChassis: Map<string, GenEntry>;
  allBrands: Set<string>;
  allModels: Map<string, string[]>;
} {
  const byBrandModel = new Map<string, GenEntry[]>();
  const byChassis = new Map<string, GenEntry>();
  const allBrands = new Set<string>();
  const allModels = new Map<string, string[]>(); // brand → model names

  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;

    const brandName = model.brand.name.toLowerCase();
    const modelName = model.name.toLowerCase();
    const startYear = gen.production_start ? new Date(gen.production_start).getFullYear() : 1900;
    const endYear = gen.production_end ? new Date(gen.production_end).getFullYear() : 2030;
    const chassisCode = gen.chassis_code?.toUpperCase() || null;

    const entry: GenEntry = {
      gen, brandName, modelName, startYear, endYear, chassisCode,
      genName: gen.name.toLowerCase(),
    };

    const key = `${brandName}|${modelName}`;
    if (!byBrandModel.has(key)) byBrandModel.set(key, []);
    byBrandModel.get(key)!.push(entry);

    if (chassisCode) {
      byChassis.set(`${brandName}|${chassisCode}`, entry);
    }

    allBrands.add(brandName);
    if (!allModels.has(brandName)) allModels.set(brandName, []);
    const models = allModels.get(brandName)!;
    if (!models.includes(modelName)) models.push(modelName);
  }

  return { byBrandModel, byChassis, allBrands, allModels };
}

function smartMatch(
  url: string,
  brandSlug: string,
  index: ReturnType<typeof buildGenIndex>
): GenEntry | null {
  // Extract info from URL
  // URL: https://www.ultimatespecs.com/car-specs/Audi/12345/Audi-A4-(B9)-2.0-TFSI.html
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1]?.replace('.html', '') || '';
  const titleParts = filename.replace(/-/g, ' ');
  
  const year = extractYearFromUrl(url) || extractYearFromTitle(titleParts);
  const chassis = extractChassisCode(titleParts);
  
  const brandName = brandSlug.replace(/-/g, ' ').toLowerCase();

  // Strategy 1: Chassis code match (most precise)
  if (chassis) {
    const byChassisKey = `${brandName}|${chassis}`;
    const entry = index.byChassis.get(byChassisKey);
    if (entry) return entry;
  }

  // Strategy 2: Model name + year range
  const modelNames = index.allModels.get(brandName) || [];
  const normalizedTitle = normalize(titleParts);

  // Find best model match by length (longer match = more specific)
  let bestMatch: GenEntry | null = null;
  let bestMatchLen = 0;

  for (const modelName of modelNames) {
    const modelNorm = normalize(modelName);
    
    // Check if model name appears in the title
    if (!normalizedTitle.includes(modelNorm) && modelNorm.length >= 2) continue;
    // Also try: brand removed from title contains model
    const titleNoB = normalizedTitle.replace(normalize(brandName), '').trim();
    if (!titleNoB.startsWith(modelNorm) && !normalizedTitle.includes(modelNorm)) continue;

    if (modelNorm.length <= bestMatchLen) continue; // Want longest match
    
    const key = `${brandName}|${modelName}`;
    const entries = index.byBrandModel.get(key);
    if (!entries) continue;

    // If we have a year, match by range
    if (year) {
      const yearMatch = entries.find(e => year >= e.startYear && year <= e.endYear);
      if (yearMatch) {
        bestMatch = yearMatch;
        bestMatchLen = modelNorm.length;
        continue;
      }
      // Fallback: closest generation by year
      const closest = entries.reduce((a, b) =>
        Math.abs(a.startYear - year) < Math.abs(b.startYear - year) ? a : b
      );
      if (Math.abs(closest.startYear - year) <= 3) {
        bestMatch = closest;
        bestMatchLen = modelNorm.length;
        continue;
      }
    }

    // No year? Check generation name / chassis in title
    if (chassis) {
      const genByName = entries.find(e =>
        e.genName.includes(chassis.toLowerCase()) ||
        (e.chassisCode && e.chassisCode === chassis)
      );
      if (genByName) {
        bestMatch = genByName;
        bestMatchLen = modelNorm.length;
        continue;
      }
    }

    // Last resort: latest generation
    const latest = entries.reduce((a, b) => a.startYear > b.startYear ? a : b);
    if (modelNorm.length > bestMatchLen) {
      bestMatch = latest;
      bestMatchLen = modelNorm.length;
    }
  }

  return bestMatch;
}

// ═══════════ MAIN ═══════════
async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  06-FIX-ULTIMATESPECS — Smart Rematch');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (BRAND_FILTER) console.log(`  Brand: ${BRAND_FILTER}`);
  console.log('='.repeat(60));

  // Load checkpoint to get processed variant URLs
  if (!fs.existsSync(CHECKPOINT_PATH)) {
    console.error('❌ No checkpoint found. Run 01-ultimatespecs-deep.ts first.');
    process.exit(1);
  }
  const cp = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
  const processedVariants: string[] = cp.processedVariants || [];
  console.log(`\n  Processed variants in checkpoint: ${processedVariants.length}`);

  // Load variant URL files
  if (!fs.existsSync(VARIANTS_DIR)) {
    console.error('❌ No variants directory. Run 01-ultimatespecs-deep.ts first.');
    process.exit(1);
  }

  // Load DB
  console.log('  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, chassis_code, internal_code, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  const index = buildGenIndex(gens);

  // Load existing specs for this source
  const existingSpecs = await paginateAll('third_party_specs', 'generation_id, spec_type, source');
  const existingGenIds = new Set(
    existingSpecs.filter(s => s.source === SOURCE).map(s => s.generation_id)
  );
  console.log(`  Generations already with UltimateSpecs data: ${existingGenIds.size}`);

  // Read variant files
  const variantFiles = fs.readdirSync(VARIANTS_DIR).filter(f => f.endsWith('.json'));
  const allVariants: { url: string; brand: string }[] = [];

  for (const vf of variantFiles) {
    const brandSlug = vf.replace('.json', '');
    if (BRAND_FILTER && !brandSlug.includes(BRAND_FILTER)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(VARIANTS_DIR, vf), 'utf-8'));
      for (const v of data) {
        allVariants.push({ url: v.url, brand: brandSlug });
      }
    } catch {}
  }
  console.log(`  Total variant URLs: ${allVariants.length}`);

  // Test matching quality
  const stats = {
    total: allVariants.length,
    matched: 0,
    matchedNew: 0, // Matched to a gen that didn't have UltimateSpecs data yet
    unmatched: 0,
    byBrand: new Map<string, { total: number; matched: number; newMatch: number }>(),
    unmatchedExamples: [] as string[],
  };

  for (const variant of allVariants) {
    const brandStats = stats.byBrand.get(variant.brand) || { total: 0, matched: 0, newMatch: 0 };
    brandStats.total++;

    const match = smartMatch(variant.url, variant.brand, index);
    if (match) {
      stats.matched++;
      brandStats.matched++;
      if (!existingGenIds.has(match.gen.id)) {
        stats.matchedNew++;
        brandStats.newMatch++;
      }
    } else {
      stats.unmatched++;
      if (stats.unmatchedExamples.length < 30) {
        stats.unmatchedExamples.push(variant.url);
      }
    }

    stats.byBrand.set(variant.brand, brandStats);
  }

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('  SMART MATCH RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total variants:     ${stats.total}`);
  console.log(`  Matched:            ${stats.matched} (${(stats.matched / stats.total * 100).toFixed(1)}%)`);
  console.log(`  NEW matches:        ${stats.matchedNew} (gens without UltimateSpecs data yet)`);
  console.log(`  Unmatched:          ${stats.unmatched}`);

  console.log('\n  By brand:');
  console.log(`  ${'Brand'.padEnd(20)} ${'Total'.padStart(8)} ${'Match'.padStart(8)} ${'New'.padStart(8)} ${'Rate'.padStart(8)}`);
  console.log(`  ${'-'.repeat(20)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(8)}`);
  for (const [brand, data] of [...stats.byBrand.entries()].sort((a, b) => b[1].total - a[1].total)) {
    const rate = data.total > 0 ? (data.matched / data.total * 100).toFixed(0) + '%' : '-';
    console.log(`  ${brand.padEnd(20)} ${String(data.total).padStart(8)} ${String(data.matched).padStart(8)} ${String(data.newMatch).padStart(8)} ${rate.padStart(8)}`);
  }

  if (stats.unmatchedExamples.length > 0) {
    console.log('\n  Sample unmatched URLs:');
    for (const url of stats.unmatchedExamples.slice(0, 15)) {
      console.log(`    ${url}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('  This is a DRY RUN analysis. The actual re-import requires');
  console.log('  fetching and re-parsing variant HTML pages.');
  console.log('  To proceed with re-import, the next step is to modify');
  console.log('  01-ultimatespecs-deep.ts to use smartMatch() instead of');
  console.log('  the naive genList[0] approach.');
  console.log('='.repeat(60));
}

main().catch(console.error);
