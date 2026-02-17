/**
 * 02-ev-database-import.ts — Import EV_DATABASE_COMPLETE.json → third_party_specs
 *
 * Imports EV-specific data: battery capacity, range, charging speed, etc.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/02-ev-database-import.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/02-ev-database-import.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const EV_FILE = path.resolve(__dirname, '../../data/EV_DATABASE_COMPLETE.json');
const SOURCE = 'ev-database';

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error(`  Paginate error ${table}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  02-EV-DATABASE-IMPORT — EV specs to DB');
  console.log(`  ${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(EV_FILE)) {
    console.error(`File not found: ${EV_FILE}`);
    process.exit(1);
  }

  const evData: any[] = JSON.parse(fs.readFileSync(EV_FILE, 'utf-8'));
  console.log(`\n  Loaded ${evData.length} EV records`);

  // Load generations
  console.log('  Loading generations...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, model:models(id, name, brand:brands(id, name))'
  );
  console.log(`  ${gens.length} generations loaded`);

  const genLookup = new Map<string, any[]>();
  for (const gen of gens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    const key = `${normalize(model.brand.name)}|${normalize(model.name)}`;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push(gen);
  }

  let totalInserted = 0;
  let matched = 0;
  let unmatched = 0;
  const specsToInsert: any[] = [];

  for (const ev of evData) {
    const brand = ev.brand || ev.make || '';
    const model = ev.model || '';
    if (!brand || !model) { unmatched++; continue; }

    // Find matching generation
    const key = `${normalize(brand)}|${normalize(model)}`;
    let matchedGens = genLookup.get(key);

    if (!matchedGens) {
      for (const [k, g] of genLookup.entries()) {
        const [bNorm, mNorm] = k.split('|');
        if (bNorm === normalize(brand) && (mNorm.includes(normalize(model)) || normalize(model).includes(mNorm))) {
          matchedGens = g;
          break;
        }
      }
    }

    if (!matchedGens || matchedGens.length === 0) {
      unmatched++;
      continue;
    }

    matched++;
    const gen = matchedGens[0];

    // Extract EV-specific specs
    const specs: Record<string, string> = {};
    if (ev.battery_capacity_kwh) specs['battery_capacity_kwh'] = String(ev.battery_capacity_kwh);
    if (ev.range_km || ev.range_wltp_km) specs['range_wltp_km'] = String(ev.range_km || ev.range_wltp_km);
    if (ev.range_real_km) specs['range_real_km'] = String(ev.range_real_km);
    if (ev.efficiency_whkm) specs['efficiency_wh_km'] = String(ev.efficiency_whkm);
    if (ev.charging_speed_kw || ev.fast_charge_kw) specs['fast_charge_kw'] = String(ev.charging_speed_kw || ev.fast_charge_kw);
    if (ev.charge_time_hours || ev.charge_0_100_hours) specs['charge_time_hours'] = String(ev.charge_time_hours || ev.charge_0_100_hours);
    if (ev.charge_port) specs['charge_port'] = String(ev.charge_port);
    if (ev.acceleration_0_100) specs['acceleration_0_100'] = String(ev.acceleration_0_100);
    if (ev.top_speed_kmh) specs['top_speed_kmh'] = String(ev.top_speed_kmh);
    if (ev.power_hp || ev.power_kw) {
      if (ev.power_hp) specs['power_hp'] = String(ev.power_hp);
      if (ev.power_kw) specs['power_kw'] = String(ev.power_kw);
    }
    if (ev.torque_nm) specs['torque_nm'] = String(ev.torque_nm);
    if (ev.drivetrain || ev.drive) specs['drivetrain'] = String(ev.drivetrain || ev.drive);
    if (ev.weight_kg || ev.curb_weight_kg) specs['curb_weight_kg'] = String(ev.weight_kg || ev.curb_weight_kg);
    if (ev.trunk_volume_l || ev.cargo_volume_l) specs['trunk_volume_liters'] = String(ev.trunk_volume_l || ev.cargo_volume_l);
    if (ev.price_eur) specs['price_eur'] = String(ev.price_eur);

    for (const [specType, specValue] of Object.entries(specs)) {
      specsToInsert.push({
        generation_id: gen.id,
        spec_type: specType,
        spec_value: specValue,
        source: SOURCE,
      });
    }
  }

  console.log(`\n  Matched: ${matched} | Unmatched: ${unmatched}`);
  console.log(`  Specs to insert: ${specsToInsert.length}`);

  if (DRY_RUN) {
    console.log('  [DRY RUN] No writes performed.');
  } else if (specsToInsert.length > 0) {
    for (let i = 0; i < specsToInsert.length; i += 500) {
      const batch = specsToInsert.slice(i, i + 500);
      const { error } = await supabase.from('third_party_specs').insert(batch);
      if (error) {
        console.error(`  Insert error (batch ${i}): ${error.message}`);
      } else {
        totalInserted += batch.length;
      }
    }
    console.log(`  Inserted: ${totalInserted}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  EV import complete. ${totalInserted} rows inserted.`);
  console.log('='.repeat(60));
}

main().catch(console.error);
