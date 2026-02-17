/**
 * FLM AUTO — ADEME Car Labelling Scraper
 * Fetches French official CO2/consumption data from ADEME open data API
 * Calculates malus 2024 & 2025, matches to FLM AUTO generations, upserts to DB
 *
 * API: https://data.ademe.fr/data-fair/api/v1/datasets/ademe-car-labelling/lines
 * Public, no key required. ~3,600 vehicles.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-ademe.ts
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

const API_BASE = 'https://data.ademe.fr/data-fair/api/v1/datasets/ademe-car-labelling/lines';
const PAGE_SIZE = 1000;
const DELAY_MS = 200;
const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_ademe.json');

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── ADEME brand → FLM AUTO brand mapping ──────────────────
// ADEME uses truncated/dotted names; map them to our DB names
const BRAND_MAP: Record<string, string> = {
  'ALFA ROMEO': 'Alfa Romeo',
  'ALPINE': 'Alpine',
  'AUDI': 'Audi',
  'B.M.W.': 'BMW',
  'CITROEN': 'Citroën',
  'CUPRA': 'Cupra',
  'DACIA': 'Dacia',
  'DS': 'DS',
  'FIAT': 'Fiat',
  'FORD': 'Ford',
  'HONDA': 'Honda',
  'HYUNDAI': 'Hyundai',
  'JEEP': 'Jeep',
  'KIA': 'Kia',
  'LAMBORGHIN': 'Lamborghini',
  'LEXUS': 'Lexus',
  'M.G.': 'MG',
  'MASERATI': 'Maserati',
  'MAZDA': 'Mazda',
  'MERCEDES': 'Mercedes-Benz',
  'MINI': 'MINI',
  'MITSUBISHI': 'Mitsubishi',
  'NISSAN': 'Nissan',
  'OPEL': 'Opel',
  'PEUGEOT': 'Peugeot',
  'PORSCHE': 'Porsche',
  'RENAULT': 'Renault',
  'ROLLS ROYC': 'Rolls-Royce',
  'SKODA': 'Skoda',
  'SUZUKI': 'Suzuki',
  'TESLA': 'Tesla',
  'TOYOTA': 'Toyota',
  'VOLKSWAGEN': 'Volkswagen',
  'VOLVO': 'Volvo',
};

// ─── ADEME record interface ────────────────────────────────

interface AdemeRecord {
  _i: number;
  _id: string;
  Marque: string;
  'Modèle': string;
  'Libellé_modèle': string;
  Description_Commerciale: string;
  Energie: string;
  CO2_vitesse_mixte_Min?: number;
  CO2_vitesse_mixte_Max?: number;
  Conso_vitesse_mixte_Min?: number;
  Conso_vitesse_mixte_Max?: number;
  'Barème_Bonus-Malus'?: number;
  'Prix_véhicule'?: number;
  Carrosserie?: string;
  Puissance_maximale?: number;
  Puissance_fiscale?: number;
  'Cylindrée'?: number;
  Type_de_boite?: string;
  Nombre_rapports?: number;
  'Poids_à_vide'?: number;
  Masse_OM_Min?: number;
  Masse_OM_Max?: number;
  Gamme?: string;
  Groupe?: string;
}

// ─── Checkpoint ─────────────────────────────────────────────

interface Checkpoint {
  lastAfter: number;       // cursor for ADEME pagination
  pagesCompleted: number;
  totalRecords: number;
  totalMatched: number;
  totalSavedPricing: number;
  totalSavedSpecs: number;
  totalSkipped: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    lastAfter: 0,
    pagesCompleted: 0,
    totalRecords: 0,
    totalMatched: 0,
    totalSavedPricing: 0,
    totalSavedSpecs: 0,
    totalSkipped: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(data: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── Malus barème ───────────────────────────────────────────

// French malus 2024 barème (CO2 g/km → EUR)
// Source: https://www.service-public.fr/particuliers/vosdroits/F35947
function calculateMalus2024(co2: number): number {
  if (co2 < 118) return 0;
  const BAREME: [number, number][] = [
    [118, 50], [119, 75], [120, 100], [121, 125], [122, 150],
    [123, 170], [124, 190], [125, 210], [126, 230], [127, 240],
    [128, 260], [129, 280], [130, 310], [131, 330], [132, 360],
    [133, 400], [134, 450], [135, 540], [136, 650], [137, 740],
    [138, 818], [139, 898], [140, 983], [141, 1074], [142, 1172],
    [143, 1276], [144, 1386], [145, 1504], [146, 1629], [147, 1761],
    [148, 1901], [149, 2049], [150, 2205], [151, 2370], [152, 2544],
    [153, 2726], [154, 2918], [155, 3119], [156, 3331], [157, 3552],
    [158, 3784], [159, 4026], [160, 4279], [161, 4543], [162, 4818],
    [163, 5105], [164, 5404], [165, 5715], [166, 6039], [167, 6375],
    [168, 6724], [169, 7086], [170, 7462], [171, 7851], [172, 8254],
    [173, 8671], [174, 9103], [175, 9550], [176, 10011], [177, 10488],
    [178, 10980], [179, 11488], [180, 12012], [181, 12552], [182, 13109],
    [183, 13682], [184, 14273], [185, 14881], [186, 15506], [187, 16149],
    [188, 16810], [189, 17490], [190, 18188], [191, 18905], [192, 19641],
    [193, 20396], [194, 21171], [195, 21966], [196, 22781], [197, 23616],
    [198, 24472], [199, 25349], [200, 26247], [201, 27166], [202, 28107],
    [203, 29070], [204, 30056], [205, 31063], [206, 32093], [207, 33147],
    [208, 34224], [209, 35324], [210, 36447], [211, 37595], [212, 38767],
    [213, 39964], [214, 41185], [215, 42431], [216, 43703], [217, 45000],
    [218, 46323], [219, 47672], [220, 49047], [221, 50449], [222, 51878],
    [223, 53334], [224, 54817],
  ];
  for (const [threshold, malus] of BAREME) {
    if (co2 <= threshold) return malus;
  }
  return 60000; // Plafond 2024
}

// 2025 barème: seuil abaissé de 5 g/km, plafond 70,000€
function calculateMalus2025(co2: number): number {
  if (co2 < 113) return 0;
  const shifted = calculateMalus2024(co2 + 5);
  // 2025 plafond is 70,000€ (vs 60,000€ in 2024)
  if (co2 + 5 > 224) {
    // Beyond the 2024 table with shift: apply 2025 cap
    return Math.min(70000, shifted === 60000 ? 70000 : shifted);
  }
  return shifted;
}

// ─── Model normalization & matching ─────────────────────────

interface GenInfo {
  id: string;
  brandName: string;
  modelName: string;
  prodStart: number | null;
  prodEnd: number | null;
}

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/classe\s/i, '')
    .replace(/class\s/i, '')
    .replace(/serie\s/i, 'series ')
    .replace(/série\s/i, 'series ')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e')
    .replace(/ë/g, 'e')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ä/g, 'a')
    .trim();
}

/**
 * Match an ADEME record to FLM AUTO generations.
 * Uses the Libellé_modèle (e.g. "SERIE 2") and Modèle (e.g. "218") fields.
 * Returns matching generations, preferring recent ones.
 */
function matchToGenerations(
  ademeMarque: string,
  ademeModele: string,
  ademeLibelle: string,
  brandName: string,
  gens: GenInfo[]
): GenInfo[] {
  const brandGens = gens.filter(g => g.brandName === brandName);
  if (brandGens.length === 0) return [];

  const normModele = normalizeForMatch(ademeModele);
  const normLibelle = normalizeForMatch(ademeLibelle);

  const matched: GenInfo[] = [];

  for (const gen of brandGens) {
    const normGen = normalizeForMatch(gen.modelName);

    // Exact match on model code (e.g. "kangoo" === "kangoo")
    if (normModele === normGen) {
      matched.push(gen);
      continue;
    }

    // Libellé match (e.g. "serie 2" matches "2 Series" or "Série 2")
    if (normLibelle === normGen) {
      matched.push(gen);
      continue;
    }

    // Partial: ADEME model contained in gen name or vice versa
    // e.g. ADEME "A3" matches gen "A3", ADEME "OCTAVIA" matches "Octavia"
    if (normModele.length >= 2 && (normGen === normModele || normGen.includes(normModele) || normModele.includes(normGen))) {
      matched.push(gen);
      continue;
    }

    // Partial on libellé
    if (normLibelle.length >= 2 && (normGen === normLibelle || normGen.includes(normLibelle) || normLibelle.includes(normGen))) {
      matched.push(gen);
      continue;
    }
  }

  // If multiple matches, prefer the most recent generation (likely the one ADEME refers to)
  if (matched.length > 1) {
    const sorted = matched.sort((a, b) => (b.prodStart || 0) - (a.prodStart || 0));
    // Return only the most recent generation
    return [sorted[0]];
  }

  return matched;
}

// ─── DB helpers ─────────────────────────────────────────────

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

// ─── Fetch ADEME page ───────────────────────────────────────

interface AdemePage {
  total: number;
  next?: string;
  results: AdemeRecord[];
}

async function fetchAdemePage(afterCursor: number): Promise<AdemePage | null> {
  const url = afterCursor > 0
    ? `${API_BASE}?size=${PAGE_SIZE}&after=${afterCursor}`
    : `${API_BASE}?size=${PAGE_SIZE}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`  HTTP ${resp.status} for ${url}`);
      return null;
    }
    const data = await resp.json() as AdemePage;
    return data;
  } catch (err: any) {
    console.error(`  Fetch error: ${err.message}`);
    return null;
  }
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — ADEME Car Labelling Scraper');
  console.log('  Source: data.ademe.fr (open data, ~3,600 vehicles)');
  console.log('═══════════════════════════════════════════════════════\n');

  const cp = loadCheckpoint();

  if (cp.pagesCompleted > 0) {
    console.log(`  Resuming from page ${cp.pagesCompleted + 1}, after=${cp.lastAfter}`);
    console.log(`  Already processed: ${cp.totalRecords} records, ${cp.totalMatched} matched, ${cp.totalSavedPricing} pricing rows\n`);
  }

  // ─── Load DB generations ──────────────────────────────────
  console.log('  Loading database...');
  const gens = await paginateAll('generations', 'id, name, model_id, production_start, production_end');
  const dbModels = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');

  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const modelMap = new Map(dbModels.map((m: any) => [m.id, m]));

  const genInfos: GenInfo[] = gens
    .map((g: any) => {
      const model = modelMap.get(g.model_id);
      const brand = model ? brandMap.get(model.brand_id) : null;
      return {
        id: g.id,
        brandName: brand?.name || '',
        modelName: model?.name || '',
        prodStart: g.production_start,
        prodEnd: g.production_end,
      };
    })
    .filter((g: GenInfo) => g.brandName && g.modelName);

  console.log(`  ${genInfos.length} generations loaded`);
  console.log(`  ${brands.length} brands, ${dbModels.length} models\n`);

  // ─── Fetch first page to get total ────────────────────────
  const firstPage = await fetchAdemePage(cp.lastAfter);
  if (!firstPage) {
    console.error('  FATAL: Could not fetch ADEME data');
    return;
  }

  const totalRecords = firstPage.total;
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
  console.log(`  ADEME dataset: ${totalRecords} records, ${totalPages} pages of ${PAGE_SIZE}\n`);

  const startTime = Date.now();
  let currentPage = firstPage;
  let pageNum = cp.pagesCompleted;

  // Process pages (first page already fetched)
  while (currentPage) {
    pageNum++;
    const results = currentPage.results;

    console.log(`  ── Page ${pageNum}/${totalPages} (${results.length} records) ──`);

    for (const record of results) {
      cp.totalRecords++;

      const ademeMarque = record.Marque;
      const ademeModele = record['Modèle'] || '';
      const ademeLibelle = record['Libellé_modèle'] || '';
      const descComm = record.Description_Commerciale || '';
      const energie = record.Energie || '';

      // Map ADEME brand to FLM AUTO brand
      const flmBrand = BRAND_MAP[ademeMarque];
      if (!flmBrand) {
        cp.totalSkipped++;
        continue;
      }

      // Extract CO2 (use Min value — most favorable, WLTP combined cycle)
      const co2Min = record.CO2_vitesse_mixte_Min;
      const co2Max = record.CO2_vitesse_mixte_Max;
      const consoMin = record.Conso_vitesse_mixte_Min;
      const consoMax = record.Conso_vitesse_mixte_Max;

      // For electric vehicles, CO2 is 0 or null — still useful for malus (bonus actually)
      const co2 = co2Min ? Math.round(co2Min) : (co2Max ? Math.round(co2Max) : 0);
      const consoMixte = consoMin || consoMax || null;

      // Match to FLM AUTO generations
      const matchedGens = matchToGenerations(ademeMarque, ademeModele, ademeLibelle, flmBrand, genInfos);

      if (matchedGens.length === 0) {
        cp.totalSkipped++;
        continue;
      }

      cp.totalMatched++;

      // Calculate malus
      const malus2024 = co2 > 0 ? calculateMalus2024(co2) : 0;
      const malus2025 = co2 > 0 ? calculateMalus2025(co2) : 0;

      for (const gen of matchedGens) {
        // 1. Upsert vehicle_pricing
        const { error: pricingError } = await supabase.from('vehicle_pricing').upsert({
          generation_id: gen.id,
          engine_variant_id: null,
          co2_gkm: co2 > 0 ? co2 : null,
          malus_2024_eur: malus2024,
          malus_2025_eur: malus2025,
          price_new_eur: record['Prix_véhicule'] || null,
          price_new_source: record['Prix_véhicule'] ? 'ademe' : null,
          raw_data: {
            ademe_id: record._id,
            marque: ademeMarque,
            modele: ademeModele,
            libelle_modele: ademeLibelle,
            description_commerciale: descComm,
            energie,
            co2_mixte_min: co2Min,
            co2_mixte_max: co2Max,
            conso_mixte_min: consoMin,
            conso_mixte_max: consoMax,
            carrosserie: record.Carrosserie,
            puissance_maximale_kw: record.Puissance_maximale,
            puissance_fiscale: record.Puissance_fiscale,
            cylindree: record['Cylindrée'],
            type_boite: record.Type_de_boite,
            poids_a_vide: record['Poids_à_vide'],
            prix_vehicule: record['Prix_véhicule'],
            bareme_bonus_malus_officiel: record['Barème_Bonus-Malus'],
          },
        }, { onConflict: 'generation_id,engine_variant_id' });

        if (!pricingError) {
          cp.totalSavedPricing++;
        } else if (pricingError.code !== '23505') {
          cp.errors++;
          if (cp.errors <= 10) console.log(`    pricing error: ${pricingError.message}`);
        }

        // 2. Upsert third_party_specs — CO2 WLTP
        if (co2 > 0) {
          const { error: specError } = await supabase.from('third_party_specs').upsert({
            generation_id: gen.id,
            source: 'ademe',
            source_url: `https://data.ademe.fr/datasets/ademe-car-labelling`,
            spec_type: 'co2_wltp_gkm',
            spec_value: co2,
            raw_data: {
              co2_mixte_min: co2Min,
              co2_mixte_max: co2Max,
              energie,
              description_commerciale: descComm,
            },
          }, { onConflict: 'generation_id,source,spec_type' });

          if (!specError) {
            cp.totalSavedSpecs++;
          } else if (specError.code !== '23505') {
            cp.errors++;
            if (cp.errors <= 10) console.log(`    spec error: ${specError.message}`);
          }
        }

        // 3. Upsert third_party_specs — mixed consumption (L/100km)
        if (consoMixte && consoMixte > 0) {
          const { error: consoError } = await supabase.from('third_party_specs').upsert({
            generation_id: gen.id,
            source: 'ademe',
            source_url: `https://data.ademe.fr/datasets/ademe-car-labelling`,
            spec_type: 'conso_mixte_wltp_l100km',
            spec_value: consoMixte,
            raw_data: {
              conso_mixte_min: consoMin,
              conso_mixte_max: consoMax,
              energie,
              description_commerciale: descComm,
            },
          }, { onConflict: 'generation_id,source,spec_type' });

          if (consoError && consoError.code !== '23505') {
            cp.errors++;
          }
        }
      }
    }

    // Save checkpoint after each page
    cp.pagesCompleted = pageNum;
    // Determine next cursor from the last record's _i
    if (results.length > 0) {
      cp.lastAfter = results[results.length - 1]._i;
    }
    saveCheckpoint(cp);

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`    Matched: ${cp.totalMatched} | Pricing: ${cp.totalSavedPricing} | Specs: ${cp.totalSavedSpecs} | Skipped: ${cp.totalSkipped} | Errors: ${cp.errors} | ${Math.floor(elapsed)}s elapsed`);

    // Check if there are more pages
    if (!currentPage.next || results.length < PAGE_SIZE) {
      break;
    }

    // Fetch next page
    await delay(DELAY_MS);
    currentPage = await fetchAdemePage(cp.lastAfter);
    if (!currentPage) {
      console.error('  Failed to fetch next page, stopping.');
      break;
    }
  }

  // ─── Final stats ──────────────────────────────────────────
  const elapsed = (Date.now() - startTime) / 1000;

  // Get final DB counts
  const { count: pricingCount } = await supabase.from('vehicle_pricing').select('*', { count: 'exact', head: true });
  const { count: withMalus } = await supabase
    .from('vehicle_pricing')
    .select('*', { count: 'exact', head: true })
    .gt('malus_2024_eur', 0);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ADEME SCRAPER — COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ADEME records processed:  ${cp.totalRecords}`);
  console.log(`  Matched to generations:   ${cp.totalMatched}`);
  console.log(`  Pricing rows saved:       ${cp.totalSavedPricing}`);
  console.log(`  Spec rows saved (CO2):    ${cp.totalSavedSpecs}`);
  console.log(`  Skipped (no match/brand): ${cp.totalSkipped}`);
  console.log(`  Errors:                   ${cp.errors}`);
  console.log(`  Duration:                 ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log(`  ──────────────────────────────────────────────────`);
  console.log(`  Total vehicle_pricing:    ${pricingCount}`);
  console.log(`  With malus > 0:           ${withMalus}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
