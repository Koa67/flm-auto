/**
 * 48-safety-reharvest.ts — Re-harvest cached safety data, overwrite C/D/E
 *
 * 0 HTTP calls. All from local JSON cache.
 *
 * Sources (priority order):
 *   1. EuroNCAP v3 (483 with percentages)
 *   2. EuroNCAP Extended (62 with gen codes)
 *   3. EuroNCAP basic (45 stars only)
 *   4. NHTSA cached (3,224 ratings)
 *
 * Overwrite rules:
 *   - No existing rating → INSERT (A)
 *   - Existing A (EuroNCAP) + new is NHTSA → SKIP (EuroNCAP > NHTSA)
 *   - Existing A (NHTSA) + new is EuroNCAP → OVERWRITE (upgrade)
 *   - Existing A + same source + new has more data → ENRICH
 *   - Existing B/C/D/E → OVERWRITE always with A
 *
 * Phase 5: Re-tag confidence
 * Phase 6: Re-propagate A→B within model
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/48-safety-reharvest.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/48-safety-reharvest.ts
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
const BATCH_SIZE = 50;
const DATA_DIR = path.resolve(__dirname, '../../data');

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

function getProdYear(gen: any): number | null {
  if (!gen?.production_start) return null;
  const s = String(gen.production_start);
  if (/^\d{4}$/.test(s)) return parseInt(s);
  if (/^\d{4}-/.test(s)) return parseInt(s.substring(0, 4));
  return null;
}

function getEndYear(gen: any): number | null {
  if (!gen?.production_end) return null;
  const s = String(gen.production_end);
  if (/^\d{4}$/.test(s)) return parseInt(s);
  if (/^\d{4}-/.test(s)) return parseInt(s.substring(0, 4));
  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isEuroNCAP(url: string): boolean {
  return (url || '').includes('euroncap');
}

function isNHTSA(url: string): boolean {
  return (url || '').includes('nhtsa');
}

// ── NHTSA model normalization ──
const NHTSA_SUFFIXES = /\s*(4-DR|2-DR|SEDAN|SUV|HEV|PHEV|AWD|4WD|FWD|SWB|LWB|COUPE|CONVERTIBLE|WAGON|HATCHBACK|CREW CAB|DOUBLE CAB|REGULAR CAB|SUPER CREW|SUPERCAB|EXTENDED CAB|SHORT BED|LONG BED|EL|HYBRID|TURBO)$/i;

function normalizeNHTSAModel(model: string): string {
  let m = model.trim();
  // Keep stripping suffixes until stable
  let prev = '';
  while (prev !== m) {
    prev = m;
    m = m.replace(NHTSA_SUFFIXES, '').trim();
  }
  // Remove trailing motor/drive variants like "xDrive40i", "sDrive30i", "e-tron", "300h"
  m = m.replace(/\s+[a-z]?Drive\d*[a-z]*/i, '');
  m = m.replace(/\s+\d{2,3}[a-z]{0,2}$/i, ''); // "300h", "50e"
  return normalize(m);
}

const NHTSA_BRAND_MAP: Record<string, string> = {
  'BMW': 'BMW', 'MERCEDES-BENZ': 'Mercedes-Benz', 'AUDI': 'Audi',
  'VOLKSWAGEN': 'Volkswagen', 'VOLVO': 'Volvo', 'TOYOTA': 'Toyota',
  'HONDA': 'Honda', 'HYUNDAI': 'Hyundai', 'KIA': 'Kia', 'NISSAN': 'Nissan',
  'MAZDA': 'Mazda', 'FORD': 'Ford', 'LEXUS': 'Lexus', 'PORSCHE': 'Porsche',
  'FIAT': 'Fiat', 'JAGUAR': 'Jaguar', 'LAND ROVER': 'Land Rover',
  'ALFA ROMEO': 'Alfa Romeo', 'MINI': 'Mini', 'TESLA': 'Tesla',
  'FERRARI': 'Ferrari', 'LAMBORGHINI': 'Lamborghini', 'MASERATI': 'Maserati',
  'BENTLEY': 'Bentley', 'ROLLS ROYCE': 'Rolls-Royce', 'ROLLS-ROYCE': 'Rolls-Royce',
  'ASTON MARTIN': 'Aston Martin', 'SUBARU': 'Subaru', 'CHEVROLET': 'Chevrolet',
  'BUICK': 'Buick', 'CADILLAC': 'Cadillac', 'CHRYSLER': 'Chrysler',
  'DODGE': 'Dodge', 'JEEP': 'Jeep', 'LINCOLN': 'Lincoln', 'GMC': 'GMC',
  'GENESIS': 'Genesis', 'INFINITI': 'Infiniti', 'ACURA': 'Acura',
  'PEUGEOT': 'Peugeot', 'RENAULT': 'Renault', 'CITROEN': 'Citroen',
  'OPEL': 'Opel', 'SEAT': 'Seat', 'SKODA': 'Skoda',
};

interface MatchResult {
  genId: string;
  genName: string;
  modelName: string;
  brandName: string;
}

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║  48-SAFETY-REHARVEST — 0 HTTP, all from cache                                ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                                                    ║`);
  console.log('╚' + '═'.repeat(78) + '╝');

  // ── Load DB data ──
  console.log('\n  Loading DB...');
  const gens = await paginateAll('generations', 'id, name, production_start, production_end, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const existingSafety = await paginateAll('safety_ratings', 'id, generation_id, stars, source_url, confidence, adult_occupant_pct, child_occupant_pct, pedestrian_pct, safety_assist_pct, test_year');

  const genById = new Map<string, any>();
  for (const g of gens) genById.set(g.id, g);
  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);
  const brandById = new Map<string, any>();
  for (const b of brands) brandById.set(b.id, b);
  const brandByName = new Map<string, any>();
  for (const b of brands) brandByName.set(normalize(b.name), b);

  // Build model lookup: brandName_modelName → model
  const modelLookup = new Map<string, any>();
  for (const m of models) {
    const brand = brandById.get(m.brand_id);
    if (brand) {
      modelLookup.set(`${normalize(brand.name)}_${normalize(m.name)}`, m);
    }
  }

  // Gens by model
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Existing safety by gen
  const safetyByGen = new Map<string, any>();
  for (const s of existingSafety) safetyByGen.set(s.generation_id, s);

  console.log(`  Gens: ${gens.length} | Existing safety: ${existingSafety.length}`);

  const beforeConf: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const s of existingSafety) beforeConf[s.confidence || 'D']++;

  // ── Matching function ──
  function findGen(brandName: string, modelName: string, year: number): MatchResult | null {
    const nb = normalize(brandName);
    const nm = normalize(modelName);

    // Direct lookup
    let model = modelLookup.get(`${nb}_${nm}`);

    // Try with brand prefix removed from model ("BMW 3 Series" → "3 series")
    if (!model && nm.startsWith(nb + ' ')) {
      model = modelLookup.get(`${nb}_${normalize(nm.substring(nb.length + 1))}`);
    }
    // Try removing brand prefix case-insensitively
    if (!model) {
      const cleanModel = nm.replace(new RegExp('^' + nb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'), '');
      if (cleanModel !== nm) {
        model = modelLookup.get(`${nb}_${cleanModel}`);
      }
    }

    // Containment search
    if (!model) {
      const brand = brandByName.get(nb);
      if (brand) {
        for (const m of models) {
          if (m.brand_id !== brand.id) continue;
          if (normalize(m.name) === nm || nm.includes(normalize(m.name)) || normalize(m.name).includes(nm)) {
            model = m;
            break;
          }
        }
      }
    }

    if (!model) return null;

    const brand = brandById.get(model.brand_id);
    if (!brand) return null;

    // Find best gen by year
    const modelGens = gensByModel.get(model.id) || [];
    let bestGen: any = null;
    let bestDist = Infinity;

    for (const g of modelGens) {
      const start = getProdYear(g);
      const end = getEndYear(g) || (start ? start + 8 : null);

      if (start && end) {
        if (year >= start - 1 && year <= end + 1) {
          const dist = Math.abs(year - start);
          if (dist < bestDist) { bestDist = dist; bestGen = g; }
        }
      } else if (start) {
        const dist = Math.abs(year - start);
        if (dist <= 5 && dist < bestDist) { bestDist = dist; bestGen = g; }
      }
    }

    // Fallback: closest gen by year if within 3
    if (!bestGen) {
      for (const g of modelGens) {
        const start = getProdYear(g);
        if (start) {
          const dist = Math.abs(year - start);
          if (dist <= 3 && dist < bestDist) { bestDist = dist; bestGen = g; }
        }
      }
    }

    // Last resort: if model has only 1 gen
    if (!bestGen && modelGens.length === 1) {
      bestGen = modelGens[0];
    }

    if (!bestGen) return null;

    return {
      genId: bestGen.id,
      genName: bestGen.name,
      modelName: model.name,
      brandName: brand.name,
    };
  }

  // ── Decision function ──
  function shouldInsertOrUpdate(
    genId: string,
    newSource: 'euroncap' | 'nhtsa',
    newHasPcts: boolean,
  ): 'insert' | 'update' | 'enrich' | 'skip' {
    const existing = safetyByGen.get(genId);
    if (!existing) return 'insert';

    const existingConf = existing.confidence || 'D';
    const existingIsEuroNCAP = isEuroNCAP(existing.source_url || '');
    const existingIsNHTSA = isNHTSA(existing.source_url || '');

    // B/C/D/E → always overwrite
    if (existingConf !== 'A') return 'update';

    // Existing is A
    if (newSource === 'nhtsa' && existingIsEuroNCAP) return 'skip'; // EuroNCAP > NHTSA
    if (newSource === 'euroncap' && existingIsNHTSA) return 'update'; // Upgrade NHTSA → EuroNCAP
    if (newSource === 'euroncap' && existingIsEuroNCAP) {
      // Same source: enrich if new has pcts and existing doesn't
      if (newHasPcts && !existing.adult_occupant_pct) return 'enrich';
      return 'skip';
    }
    if (newSource === 'nhtsa' && existingIsNHTSA) return 'skip'; // Already have NHTSA

    return 'update'; // Default: update if existing is A but unknown source
  }

  const toUpsert: any[] = [];
  const stats = {
    phase1: { processed: 0, inserted: 0, updated: 0, enriched: 0, skipped: 0, unmatched: 0 },
    phase2: { processed: 0, inserted: 0, updated: 0, skipped: 0, unmatched: 0 },
    phase3: { processed: 0, inserted: 0, updated: 0, skipped: 0, unmatched: 0 },
    phase4: { processed: 0, inserted: 0, updated: 0, skipped: 0, unmatched: 0, skippedEuroNCAP: 0 },
    phase5: 0,
    phase6: 0,
  };

  // ══════════════════════════════════════════════════════════
  // Phase 1: EuroNCAP v3 (483 with percentages) — THE BEST
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Phase 1: EuroNCAP v3 (detailed ratings)');
  console.log('═══════════════════════════════════════════════════════════════');

  const euroncapV3Path = path.join(DATA_DIR, 'raw/euroncap_v3_all_ratings.json');
  if (fs.existsSync(euroncapV3Path)) {
    const v3Data = JSON.parse(fs.readFileSync(euroncapV3Path, 'utf-8'));
    const v3Ratings = v3Data.ratings || [];
    console.log(`  Loaded: ${v3Ratings.length} ratings`);

    for (const r of v3Ratings) {
      stats.phase1.processed++;
      const match = findGen(r.brand, r.model, r.year_tested);
      if (!match) { stats.phase1.unmatched++; continue; }

      const decision = shouldInsertOrUpdate(match.genId, 'euroncap', !!r.adult_pct);

      if (decision === 'skip') { stats.phase1.skipped++; continue; }

      const row: any = {
        generation_id: match.genId,
        stars: r.stars,
        source_url: r.source_url || `https://www.euroncap.com/en/results/${r.brand}/`,
        confidence: 'A',
        test_year: r.year_tested,
      };
      if (r.adult_pct) row.adult_occupant_pct = r.adult_pct;
      if (r.child_pct) row.child_occupant_pct = r.child_pct;
      if (r.pedestrian_pct) row.pedestrian_pct = r.pedestrian_pct;
      if (r.safety_assist_pct) row.safety_assist_pct = r.safety_assist_pct;

      if (decision === 'insert') {
        toUpsert.push(row);
        safetyByGen.set(match.genId, { ...row, source_url: row.source_url, confidence: 'A' });
        stats.phase1.inserted++;
      } else if (decision === 'update') {
        const existing = safetyByGen.get(match.genId);
        row.id = existing.id;
        toUpsert.push(row);
        safetyByGen.set(match.genId, { ...existing, ...row, confidence: 'A' });
        stats.phase1.updated++;
      } else if (decision === 'enrich') {
        const existing = safetyByGen.get(match.genId);
        row.id = existing.id;
        toUpsert.push(row);
        safetyByGen.set(match.genId, { ...existing, ...row });
        stats.phase1.enriched++;
      }
    }
  } else {
    console.log('  ⚠ File not found');
  }
  console.log(`  P1: processed=${stats.phase1.processed} insert=${stats.phase1.inserted} update=${stats.phase1.updated} enrich=${stats.phase1.enriched} skip=${stats.phase1.skipped} unmatched=${stats.phase1.unmatched}`);

  // ══════════════════════════════════════════════════════════
  // Phase 2: EuroNCAP Extended (62 with gen codes)
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Phase 2: EuroNCAP Extended (with gen codes)');
  console.log('═══════════════════════════════════════════════════════════════');

  const extPath = path.join(DATA_DIR, 'EURONCAP_EXTENDED_DATABASE.json');
  if (fs.existsSync(extPath)) {
    const extData = JSON.parse(fs.readFileSync(extPath, 'utf-8'));
    const brandRatings = extData.ratings_2024_2025 || {};

    for (const [brandKey, modelsObj] of Object.entries(brandRatings)) {
      for (const [, data] of Object.entries(modelsObj as any)) {
        const r = data as any;
        stats.phase2.processed++;
        const match = findGen(brandKey, r.model, r.year_tested);
        if (!match) { stats.phase2.unmatched++; continue; }

        const decision = shouldInsertOrUpdate(match.genId, 'euroncap', !!r.adult_occupant_pct);
        if (decision === 'skip') { stats.phase2.skipped++; continue; }

        const row: any = {
          generation_id: match.genId,
          stars: r.stars,
          source_url: r.url || `https://www.euroncap.com/en/results/${brandKey}/`,
          confidence: 'A',
          test_year: r.year_tested,
        };
        if (r.adult_occupant_pct) row.adult_occupant_pct = r.adult_occupant_pct;
        if (r.child_occupant_pct) row.child_occupant_pct = r.child_occupant_pct;
        if (r.pedestrian_pct) row.pedestrian_pct = r.pedestrian_pct;
        if (r.safety_assist_pct) row.safety_assist_pct = r.safety_assist_pct;

        if (decision === 'insert') {
          toUpsert.push(row);
          safetyByGen.set(match.genId, { ...row, confidence: 'A' });
          stats.phase2.inserted++;
        } else {
          const existing = safetyByGen.get(match.genId);
          row.id = existing.id;
          toUpsert.push(row);
          safetyByGen.set(match.genId, { ...existing, ...row, confidence: 'A' });
          stats.phase2.updated++;
        }
      }
    }
  }
  console.log(`  P2: processed=${stats.phase2.processed} insert=${stats.phase2.inserted} update=${stats.phase2.updated} skip=${stats.phase2.skipped} unmatched=${stats.phase2.unmatched}`);

  // ══════════════════════════════════════════════════════════
  // Phase 3: EuroNCAP basic (45 stars only)
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Phase 3: EuroNCAP basic (stars only)');
  console.log('═══════════════════════════════════════════════════════════════');

  const basicPath = path.join(DATA_DIR, 'euroncap-ratings.json');
  if (fs.existsSync(basicPath)) {
    const basicRatings = JSON.parse(fs.readFileSync(basicPath, 'utf-8'));
    console.log(`  Loaded: ${basicRatings.length} ratings`);

    for (const r of basicRatings) {
      stats.phase3.processed++;
      const match = findGen(r.brand, r.model, r.year);
      if (!match) { stats.phase3.unmatched++; continue; }

      const decision = shouldInsertOrUpdate(match.genId, 'euroncap', false);
      if (decision === 'skip' || decision === 'enrich') { stats.phase3.skipped++; continue; }

      const row: any = {
        generation_id: match.genId,
        stars: r.overall_rating,
        source_url: r.source_url || 'https://www.euroncap.com/en/ratings-rewards/',
        confidence: 'A',
        test_year: r.year,
      };

      if (decision === 'insert') {
        toUpsert.push(row);
        safetyByGen.set(match.genId, { ...row, confidence: 'A' });
        stats.phase3.inserted++;
      } else {
        const existing = safetyByGen.get(match.genId);
        row.id = existing.id;
        toUpsert.push(row);
        safetyByGen.set(match.genId, { ...existing, ...row, confidence: 'A' });
        stats.phase3.updated++;
      }
    }
  }
  console.log(`  P3: processed=${stats.phase3.processed} insert=${stats.phase3.inserted} update=${stats.phase3.updated} skip=${stats.phase3.skipped} unmatched=${stats.phase3.unmatched}`);

  // ══════════════════════════════════════════════════════════
  // Phase 4: NHTSA cached (3,224 ratings)
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Phase 4: NHTSA cached ratings');
  console.log('═══════════════════════════════════════════════════════════════');

  const nhtsaPath = path.join(DATA_DIR, 'nhtsa-5star-checkpoint.json');
  if (fs.existsSync(nhtsaPath)) {
    const nhtsaData = JSON.parse(fs.readFileSync(nhtsaPath, 'utf-8'));
    const nhtsaRatings = nhtsaData.ratings || [];
    console.log(`  Loaded: ${nhtsaRatings.length} ratings`);

    for (const r of nhtsaRatings) {
      stats.phase4.processed++;

      const mappedBrand = NHTSA_BRAND_MAP[r.make?.toUpperCase()] || r.make;
      if (!mappedBrand || !brandByName.has(normalize(mappedBrand))) {
        stats.phase4.unmatched++;
        continue;
      }

      const normalizedModel = normalizeNHTSAModel(r.model || '');
      const match = findGen(mappedBrand, normalizedModel, r.year);

      // Try raw model if normalized fails
      if (!match) {
        const match2 = findGen(mappedBrand, r.model || '', r.year);
        if (!match2) { stats.phase4.unmatched++; continue; }
        // Use match2
        processNHTSA(match2, r);
        continue;
      }

      processNHTSA(match, r);
    }

    function processNHTSA(match: MatchResult, r: any) {
      const decision = shouldInsertOrUpdate(match.genId, 'nhtsa', false);

      if (decision === 'skip') {
        const existing = safetyByGen.get(match.genId);
        if (existing && isEuroNCAP(existing.source_url || '')) {
          stats.phase4.skippedEuroNCAP++;
        }
        stats.phase4.skipped++;
        return;
      }

      const row: any = {
        generation_id: match.genId,
        stars: r.stars,
        source_url: `https://www.nhtsa.gov/vehicle/${r.year}/${encodeURIComponent(r.make)}/${encodeURIComponent(r.model)}`,
        confidence: 'A',
        test_year: r.year,
      };

      if (decision === 'insert') {
        toUpsert.push(row);
        safetyByGen.set(match.genId, { ...row, confidence: 'A' });
        stats.phase4.inserted++;
      } else {
        const existing = safetyByGen.get(match.genId);
        row.id = existing.id;
        toUpsert.push(row);
        safetyByGen.set(match.genId, { ...existing, ...row, confidence: 'A' });
        stats.phase4.updated++;
      }
    }
  }
  console.log(`  P4: processed=${stats.phase4.processed} insert=${stats.phase4.inserted} update=${stats.phase4.updated} skip=${stats.phase4.skipped} (${stats.phase4.skippedEuroNCAP} kept EuroNCAP) unmatched=${stats.phase4.unmatched}`);

  // ══════════════════════════════════════════════════════════
  // Execute upserts
  // ══════════════════════════════════════════════════════════
  console.log(`\n  Total to upsert: ${toUpsert.length}`);

  if (!DRY_RUN && toUpsert.length > 0) {
    console.log('  Upserting...');
    let done = 0;
    let errors = 0;
    // Separate inserts (no id) from updates (has id)
    const inserts = toUpsert.filter(r => !r.id);
    const updates = toUpsert.filter(r => r.id);

    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      const batch = inserts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('safety_ratings').insert(batch);
      if (error) { console.error(`  Insert error at ${i}: ${error.message}`); errors++; }
      else done += batch.length;
    }

    for (const row of updates) {
      const id = row.id;
      delete row.id;
      const { error } = await supabase.from('safety_ratings').update(row).eq('id', id);
      if (error) { console.error(`  Update error for ${id}: ${error.message}`); errors++; }
      else done++;
    }

    console.log(`  Done: ${done} | Errors: ${errors}`);
  }

  // ══════════════════════════════════════════════════════════
  // Phase 5: Re-tag confidence for ALL safety_ratings
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Phase 5: Re-tag confidence');
  console.log('═══════════════════════════════════════════════════════════════');

  if (!DRY_RUN) {
    const allSafety = await paginateAll('safety_ratings', 'id, source_url, confidence');
    const confUpdates: { id: string; confidence: string }[] = [];

    for (const s of allSafety) {
      const url = s.source_url || '';
      if ((url.includes('euroncap') || url.includes('nhtsa') || url.includes('iihs') ||
           url.includes('jncap') || url.includes('nasva')) && s.confidence !== 'A') {
        confUpdates.push({ id: s.id, confidence: 'A' });
        stats.phase5++;
      }
    }

    if (confUpdates.length > 0) {
      const ids = confUpdates.map(u => u.id);
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await supabase.from('safety_ratings').update({ confidence: 'A' }).in('id', batch);
      }
    }
    console.log(`  Re-tagged ${stats.phase5} rows to A`);
  }

  // ══════════════════════════════════════════════════════════
  // Phase 6: Re-propagate A→B within model
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Phase 6: Re-propagate (A→B within same model)');
  console.log('═══════════════════════════════════════════════════════════════');

  if (!DRY_RUN) {
    // Reload
    const freshSafety = await paginateAll('safety_ratings', 'id, generation_id, stars, source_url, confidence, adult_occupant_pct, child_occupant_pct, pedestrian_pct, safety_assist_pct');
    const freshByGen = new Map<string, any>();
    for (const s of freshSafety) freshByGen.set(s.generation_id, s);

    const propInserts: any[] = [];

    for (const [modelId, modelGens] of Array.from(gensByModel.entries())) {
      // Find A-rated gens in this model
      const aGens = modelGens.filter(g => {
        const s = freshByGen.get(g.id);
        return s && s.confidence === 'A';
      });
      if (aGens.length === 0) continue;

      // Find gens without rating or with C/D/E
      const needUpgrade = modelGens.filter(g => {
        const s = freshByGen.get(g.id);
        if (!s) return true;
        return s.confidence === 'C' || s.confidence === 'D' || s.confidence === 'E';
      });

      for (const target of needUpgrade) {
        const targetYear = getProdYear(target);

        // Find closest A-rated gen
        let bestSource: any = null;
        let bestDist = Infinity;

        for (const src of aGens) {
          const srcYear = getProdYear(src);
          if (srcYear && targetYear) {
            const dist = Math.abs(srcYear - targetYear);
            if (dist <= 5 && dist < bestDist) {
              bestDist = dist;
              bestSource = src;
            }
          } else if (!targetYear) {
            // No year on target — use first A source
            bestSource = src;
            bestDist = 0;
            break;
          }
        }

        if (!bestSource) continue;
        const srcRating = freshByGen.get(bestSource.id);
        if (!srcRating) continue;

        const existing = freshByGen.get(target.id);
        const row: any = {
          generation_id: target.id,
          stars: srcRating.stars,
          source_url: `propagated_from:${bestSource.id}`,
          confidence: 'B',
          test_year: srcRating.test_year || null,
        };
        if (srcRating.adult_occupant_pct) row.adult_occupant_pct = srcRating.adult_occupant_pct;
        if (srcRating.child_occupant_pct) row.child_occupant_pct = srcRating.child_occupant_pct;
        if (srcRating.pedestrian_pct) row.pedestrian_pct = srcRating.pedestrian_pct;
        if (srcRating.safety_assist_pct) row.safety_assist_pct = srcRating.safety_assist_pct;

        if (existing) {
          // Update existing
          const { error } = await supabase.from('safety_ratings').update(row).eq('id', existing.id);
          if (!error) {
            stats.phase6++;
            freshByGen.set(target.id, { ...existing, ...row });
          }
        } else {
          propInserts.push(row);
          freshByGen.set(target.id, row);
          stats.phase6++;
        }
      }
    }

    if (propInserts.length > 0) {
      for (let i = 0; i < propInserts.length; i += BATCH_SIZE) {
        const batch = propInserts.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('safety_ratings').insert(batch);
        if (error) console.error(`  Propagation insert error: ${error.message}`);
      }
    }
    console.log(`  Propagated: ${stats.phase6}`);
  }

  // ══════════════════════════════════════════════════════════
  // Final report
  // ══════════════════════════════════════════════════════════
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║  SAFETY RE-HARVEST RESULTS                                                   ║');
  console.log('╠' + '═'.repeat(78) + '╣');

  console.log(`║  Phase 1 — EuroNCAP v3 (detailed)                                            ║`);
  console.log(`║    Processed: ${String(stats.phase1.processed).padStart(4)} | Insert: ${String(stats.phase1.inserted).padStart(3)} | Update: ${String(stats.phase1.updated).padStart(3)} | Enrich: ${String(stats.phase1.enriched).padStart(3)} | Skip: ${String(stats.phase1.skipped).padStart(3)}   ║`);
  console.log(`║  Phase 2 — EuroNCAP Extended                                                 ║`);
  console.log(`║    Processed: ${String(stats.phase2.processed).padStart(4)} | Insert: ${String(stats.phase2.inserted).padStart(3)} | Update: ${String(stats.phase2.updated).padStart(3)} | Skip: ${String(stats.phase2.skipped).padStart(3)}            ║`);
  console.log(`║  Phase 3 — EuroNCAP basic                                                    ║`);
  console.log(`║    Processed: ${String(stats.phase3.processed).padStart(4)} | Insert: ${String(stats.phase3.inserted).padStart(3)} | Update: ${String(stats.phase3.updated).padStart(3)} | Skip: ${String(stats.phase3.skipped).padStart(3)}            ║`);
  console.log(`║  Phase 4 — NHTSA cached                                                      ║`);
  console.log(`║    Processed: ${String(stats.phase4.processed).padStart(4)} | Insert: ${String(stats.phase4.inserted).padStart(3)} | Update: ${String(stats.phase4.updated).padStart(3)} | Skip: ${String(stats.phase4.skipped).padStart(3)} (${stats.phase4.skippedEuroNCAP} EuroNCAP kept)  ║`);
  console.log(`║  Phase 5 — Re-tag: ${stats.phase5}                                                      ║`);
  console.log(`║  Phase 6 — Re-propagate: ${stats.phase6}                                                ║`);
  console.log('╠' + '─'.repeat(78) + '╣');

  // Compute after stats
  if (!DRY_RUN) {
    const afterSafety = await paginateAll('safety_ratings', 'generation_id, confidence');
    const afterConf: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    const afterGenConf = new Map<string, string>();
    for (const s of afterSafety) {
      afterConf[s.confidence || 'D']++;
      afterGenConf.set(s.generation_id, s.confidence || 'D');
    }

    const abSet = new Set(['A', 'B']);
    let verifiedGens = 0;
    for (const gen of gens) {
      if (abSet.has(afterGenConf.get(gen.id) || '')) verifiedGens++;
    }

    console.log('║                                                                              ║');
    console.log('║  BEFORE → AFTER                                                              ║');
    for (const c of ['A', 'B', 'C', 'D', 'E']) {
      console.log(`║    ${c}: ${String(beforeConf[c] || 0).padStart(5)} → ${String(afterConf[c] || 0).padStart(5)}                                                         ║`);
    }
    console.log(`║                                                                              ║`);
    console.log(`║  Safety Verified (A+B): ${(1400 / gens.length * 100).toFixed(1)}% → ${(verifiedGens / gens.length * 100).toFixed(1)}%                                         ║`);
    console.log('╚' + '═'.repeat(78) + '╝');

    // Compute full scores
    const specsGens = await paginateAll('third_party_specs', 'generation_id');
    const specsGenSet = new Set(specsGens.map((r: any) => r.generation_id));

    // Photos
    const photoGenAB = new Set<string>();
    let pp = 0;
    while (true) {
      const { data, error } = await supabase.from('vehicle_images').select('generation_id, confidence').range(pp * 1000, (pp + 1) * 1000 - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data) { if (r.confidence === 'A' || r.confidence === 'B') photoGenAB.add(r.generation_id); }
      if (data.length < 1000) break;
      pp++;
    }

    const videoGenAB = new Set<string>();
    let vp = 0;
    while (true) {
      const { data, error } = await supabase.from('vehicle_videos').select('generation_id, confidence').range(vp * 1000, (vp + 1) * 1000 - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data) { if (r.confidence === 'A' || r.confidence === 'B') videoGenAB.add(r.generation_id); }
      if (data.length < 1000) break;
      vp++;
    }

    const dimsAB = await paginateAll('interior_dimensions', 'generation_id, confidence');
    const dimsGenAB = new Set(dimsAB.filter((r: any) => r.confidence === 'A' || r.confidence === 'B').map((r: any) => r.generation_id));
    const fitsAB = await paginateAll('family_fit_compatibility', 'generation_id, confidence');
    const fitsGenAB = new Set(fitsAB.filter((r: any) => r.confidence === 'A' || r.confidence === 'B').map((r: any) => r.generation_id));

    const T = gens.length;
    const score =
      (specsGenSet.size / T * 100) * 0.15 +
      (photoGenAB.size / T * 100) * 0.15 +
      (verifiedGens / T * 100) * 0.25 +
      (dimsGenAB.size / T * 100) * 0.15 +
      (fitsGenAB.size / T * 100) * 0.15 +
      (videoGenAB.size / T * 100) * 0.15;

    console.log(`\n  VERIFIED SCORE: ${score.toFixed(1)} / 100  (was 71.7)`);
    console.log(`  Safety Verified: ${(verifiedGens / T * 100).toFixed(1)}%  (was 32.8%)`);

    const report = {
      timestamp: new Date().toISOString(),
      stats,
      before: beforeConf,
      after: afterConf,
      verifiedGens,
      verifiedPct: (verifiedGens / T * 100).toFixed(1),
      score: score.toFixed(1),
    };
    fs.writeFileSync(path.join(DATA_DIR, 'safety-reharvest-report.json'), JSON.stringify(report, null, 2));
  } else {
    console.log('║  [DRY RUN — no DB changes]                                                  ║');
    console.log('╚' + '═'.repeat(78) + '╝');
  }

  console.log(`\n  Report: ${path.join(DATA_DIR, 'safety-reharvest-report.json')}`);
}

main().catch(console.error);
