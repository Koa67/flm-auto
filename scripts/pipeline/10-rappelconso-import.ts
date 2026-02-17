/**
 * 10-rappelconso-import.ts — Import French RappelConso vehicle recalls
 *
 * Source: data.economie.gouv.fr API (free, no auth)
 * Target: vehicle_recalls table
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/10-rappelconso-import.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/10-rappelconso-import.ts
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
const DELAY_MS = 100;
const BATCH_SIZE = 50;
const PAGE_SIZE = 100;
const DATA_DIR = path.resolve(__dirname, '../../data');

// Brand normalization: RappelConso names → our DB names
const BRAND_MAP: Record<string, string> = {
  'bmw': 'BMW', 'mercedes': 'Mercedes-Benz', 'mercedes-benz': 'Mercedes-Benz',
  'audi': 'Audi', 'volkswagen': 'Volkswagen', 'vw': 'Volkswagen',
  'toyota': 'Toyota', 'honda': 'Honda', 'nissan': 'Nissan',
  'hyundai': 'Hyundai', 'kia': 'Kia', 'renault': 'Renault',
  'peugeot': 'Peugeot', 'volvo': 'Volvo', 'skoda': 'Skoda', 'škoda': 'Skoda',
  'porsche': 'Porsche', 'ford': 'Ford', 'mazda': 'Mazda',
  'fiat': 'Fiat', 'alfa romeo': 'Alfa Romeo', 'ferrari': 'Ferrari',
  'lamborghini': 'Lamborghini', 'jaguar': 'Jaguar', 'lexus': 'Lexus',
  'tesla': 'Tesla', 'land rover': 'Land Rover', 'maserati': 'Maserati',
  'aston martin': 'Aston Martin', 'bentley': 'Bentley',
  'rolls-royce': 'Rolls-Royce', 'rolls royce': 'Rolls-Royce',
  'mini': 'Mini', 'seat': 'Seat', 'citroen': 'Citroen', 'citroën': 'Citroen',
  'opel': 'Opel', 'ds': 'DS', 'ds automobiles': 'DS',
  'dacia': 'Dacia', 'cupra': 'Cupra',
};

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'FLM-Auto/1.0' },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse: ${e}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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

function resolveBrand(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  return BRAND_MAP[lower] || null;
}

function categorizeComponent(desc: string): string {
  const lower = desc.toLowerCase();
  if (lower.includes('airbag') || lower.includes('coussin')) return 'airbag';
  if (lower.includes('frein') || lower.includes('brake')) return 'brakes';
  if (lower.includes('carburant') || lower.includes('essence') || lower.includes('diesel') || lower.includes('fuel')) return 'fuel_system';
  if (lower.includes('electr') || lower.includes('batterie') || lower.includes('câbl')) return 'electrical';
  if (lower.includes('moteur') || lower.includes('engine')) return 'engine';
  if (lower.includes('direction') || lower.includes('steering')) return 'steering';
  if (lower.includes('boîte') || lower.includes('transmission')) return 'transmission';
  if (lower.includes('suspension') || lower.includes('amortisseur')) return 'suspension';
  if (lower.includes('pneu') || lower.includes('roue') || lower.includes('jante')) return 'tires_wheels';
  if (lower.includes('siège') || lower.includes('ceinture') || lower.includes('seat') || lower.includes('belt')) return 'seats_belts';
  if (lower.includes('porte') || lower.includes('serrure') || lower.includes('verrou')) return 'doors_locks';
  if (lower.includes('phare') || lower.includes('feu') || lower.includes('éclairage') || lower.includes('light')) return 'lights';
  if (lower.includes('logiciel') || lower.includes('software') || lower.includes('calculateur')) return 'software';
  return 'other';
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  10-RAPPELCONSO — French Vehicle Recalls Import');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load DB generations
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, production_start, production_end, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

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

  // Load existing
  const existingRecalls = await paginateAll('vehicle_recalls', 'recall_number, source');
  const existingSet = new Set(existingRecalls.filter(r => r.source === 'rappelconso').map(r => r.recall_number));
  console.log(`  Existing RappelConso recalls: ${existingSet.size}`);

  // Fetch all auto recalls from API
  console.log('\n━━━ Fetching RappelConso API ━━━');

  const stats = {
    apiPages: 0,
    totalRecords: 0,
    autoRecords: 0,
    newRecalls: 0,
    duplicates: 0,
    matched: 0,
    unmatched: 0,
    inserted: 0,
    brandNotInDB: 0,
    httpErrors: 0,
  };

  const toInsert: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso0/records?where=categorie_de_produit%3D%22Automobiles%22&limit=${PAGE_SIZE}&offset=${offset}&order_by=date_de_publication%20DESC`;
      const data = await fetchJSON(url);
      stats.apiPages++;

      const results = data.results || [];
      if (results.length === 0) { hasMore = false; break; }

      stats.totalRecords += results.length;

      for (const r of results) {
        stats.autoRecords++;
        const ref = r.reference_fiche;
        if (!ref) continue;
        if (existingSet.has(ref)) { stats.duplicates++; continue; }
        existingSet.add(ref);

        // Parse brand
        const rawBrand = r.nom_de_la_marque_du_produit || '';
        const ourBrand = resolveBrand(rawBrand);
        if (!ourBrand) { stats.brandNotInDB++; continue; }

        // Parse model from "noms_des_modeles_ou_references"
        const rawModel = r.noms_des_modeles_ou_references || '';
        const modelName = rawModel.split(/[,;\/]/).map((s: string) => s.trim()).filter(Boolean)[0] || rawModel;

        // Parse date
        const rawDate = r.date_de_publication || '';
        const recallDate = rawDate.substring(0, 10) || new Date().toISOString().substring(0, 10);

        // Parse description for component
        const desc = r.description_complementaire_du_risque || r.risques_encourus_par_le_consommateur || '';
        const component = categorizeComponent(desc + ' ' + (r.sous_categorie_de_produit || ''));

        // Try to match generation
        let genId: string | null = null;
        const brandLower = ourBrand.toLowerCase();
        const modelNorm = normalize(modelName);
        const year = parseInt(recallDate.substring(0, 4)) || 2024;

        for (const [k, entries] of genLookup) {
          const [bk, mk] = k.split('|');
          if (bk !== brandLower) continue;
          const mkNorm = normalize(mk);
          if (mkNorm === modelNorm || mkNorm.includes(modelNorm) || modelNorm.includes(mkNorm)) {
            const yearMatch = entries.find(e => year >= e.startYear - 2 && year <= e.endYear + 2);
            if (yearMatch) { genId = yearMatch.gen.id; stats.matched++; break; }
          }
        }
        if (!genId) stats.unmatched++;

        stats.newRecalls++;
        toInsert.push({
          brand: ourBrand,
          model: modelName.substring(0, 200),
          generation_id: genId,
          recall_number: ref,
          recall_date: recallDate,
          source: 'rappelconso',
          component,
          issue_summary: (r.risques_encourus_par_le_consommateur || desc).substring(0, 500),
          issue_description: (r.description_complementaire_du_risque || '').substring(0, 2000) || null,
          remedy: (r.mesures_correctives_prises || '').substring(0, 1000) || null,
          remedy_available: true,
          source_url: r.liens_vers_les_fiches_rappel || null,
        });
      }

      process.stdout.write(`[p${stats.apiPages}:${results.length}]`);
      offset += PAGE_SIZE;
      if (results.length < PAGE_SIZE) hasMore = false;
      await sleep(DELAY_MS);
    } catch (e: any) {
      stats.httpErrors++;
      console.error(`\n  API error at offset ${offset}: ${e.message}`);
      if (stats.httpErrors > 5) { hasMore = false; break; }
      await sleep(1000);
    }
  }
  console.log('');

  // Insert
  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} recalls...`);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_recalls').upsert(batch, {
        onConflict: 'recall_number,source'
      });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }
    stats.inserted = inserted;
    console.log(`  Inserted: ${inserted}`);
  }

  // Results
  console.log('\n' + '='.repeat(60));
  console.log('  RAPPELCONSO RESULTS');
  console.log('='.repeat(60));
  console.log(`  API pages:          ${stats.apiPages}`);
  console.log(`  Total records:      ${stats.totalRecords}`);
  console.log(`  Auto records:       ${stats.autoRecords}`);
  console.log(`  New recalls:        ${stats.newRecalls}`);
  console.log(`  Duplicates:         ${stats.duplicates}`);
  console.log(`  Brand not in DB:    ${stats.brandNotInDB}`);
  console.log(`  Gen matched:        ${stats.matched}`);
  console.log(`  Gen unmatched:      ${stats.unmatched}`);
  console.log(`  Inserted:           ${DRY_RUN ? '(dry run)' : stats.inserted}`);
  console.log(`  HTTP errors:        ${stats.httpErrors}`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'rappelconso-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
