/**
 * FLM AUTO - ADAMANTIUM IMPORT 🔩
 * 
 * Import EVERYTHING from:
 * - UltimateSpecs (406k lines, 80+ brands)
 * - IMCDb (movie appearances)
 * - Raw EV Database
 * - Raw AutoData
 * - Raw Performance data
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

let brandMap: Map<string, string>;
let models: any[];
let generations: any[];

async function initDbMaps() {
  const { data: brands } = await supabase.from('brands').select('id, name');
  brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace(/-/g, ''), b.id);
    brandMap.set(b.name.toLowerCase().replace(/ /g, ''), b.id);
  });
  
  const { data: m } = await supabase.from('models').select('id, name, brand_id');
  models = m || [];
  const { data: g } = await supabase.from('generations').select('id, model_id, name');
  generations = g || [];
  
  console.log(`   📊 DB: ${brandMap.size} brands, ${models.length} models, ${generations.length} generations\n`);
}

function findGeneration(brandId: string, modelName: string): string | null {
  if (!modelName) return null;
  const modelLower = modelName.toLowerCase().replace(/-/g, '').replace(/ /g, '').replace(/_/g, '');
  const brandModels = models.filter(m => m.brand_id === brandId);
  
  for (const model of brandModels) {
    const dbName = model.name.toLowerCase().replace(/-/g, '').replace(/ /g, '');
    
    // Exact or contains match
    if (modelLower === dbName || modelLower.includes(dbName) || dbName.includes(modelLower.substring(0, 3))) {
      const gens = generations.filter(g => g.model_id === model.id);
      if (gens.length > 0) return gens[0].id;
    }
  }
  return null;
}

function extractModelFromVariant(variant: string, brandHint?: string): string | null {
  if (!variant) return null;
  
  // Remove brand prefix and year
  let clean = variant
    .replace(/mercedes[- ]?benz/gi, '')
    .replace(/volkswagen/gi, '')
    .replace(/alfa[- ]?romeo/gi, '')
    .replace(/aston[- ]?martin/gi, '')
    .replace(/land[- ]?rover/gi, '')
    .replace(/rolls[- ]?royce/gi, '')
    .replace(new RegExp(brandHint || '', 'gi'), '')
    .replace(/\d{4}/g, '')
    .replace(/specs$/i, '')
    .trim();
  
  // Get first meaningful word(s)
  const parts = clean.split(/\s+/);
  if (parts.length > 0) {
    // Handle numbered models (3 Series, A4, etc.)
    if (parts[0].match(/^[a-z]?\d+/i)) {
      return parts.slice(0, 2).join(' ').trim();
    }
    return parts[0];
  }
  return null;
}

// ============================================================
// 1. ULTIMATESPECS - All brands
// ============================================================
async function importUltimateSpecs() {
  console.log('\n🏭 Importing UltimateSpecs (ALL BRANDS)...\n');
  
  const dir = '../data/ultimatespecs';
  if (!fs.existsSync(dir)) return 0;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  console.log(`   Found ${files.length} brand files\n`);
  
  let totalInserted = 0;
  
  for (const file of files) {
    const brandName = file.replace('.json', '').replace(/-/g, ' ');
    const brandId = brandMap.get(brandName.toLowerCase().replace(/ /g, ''));
    
    if (!brandId) continue;
    
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    const specs = Array.isArray(data) ? data : data.vehicles || data.specs || [];
    
    let brandInserted = 0;
    const seenModels = new Set<string>();
    
    for (const spec of specs) {
      const modelName = extractModelFromVariant(spec.variant || spec.model, brandName);
      if (!modelName) continue;
      
      const genId = findGeneration(brandId, modelName);
      if (!genId) continue;
      
      // Only one spec per model to avoid bloat
      const modelKey = `${genId}`;
      if (seenModels.has(modelKey)) continue;
      seenModels.add(modelKey);
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'UltimateSpecs',
        source_url: spec.source_url || '',
        spec_type: 'full_specs',
        spec_value: spec.power_hp || spec.length_mm || 0,
        raw_data: {
          variant: spec.variant,
          length_mm: spec.length_mm,
          width_mm: spec.width_mm,
          height_mm: spec.height_mm,
          wheelbase_mm: spec.wheelbase_mm,
          curb_weight_kg: spec.curb_weight_kg,
          trunk_volume_l: spec.trunk_volume_l,
          fuel_tank_l: spec.fuel_tank_l,
          power_hp: spec.power_hp,
          torque_nm: spec.torque_nm,
          displacement_cc: spec.displacement_cc,
          acceleration_0_100: spec.acceleration_0_100,
          top_speed_kmh: spec.top_speed_kmh,
          transmission: spec.transmission,
          drivetrain: spec.drivetrain,
        },
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) brandInserted++;
    }
    
    if (brandInserted > 0) {
      console.log(`   ✅ ${brandName}: ${brandInserted} specs`);
      totalInserted += brandInserted;
    }
  }
  
  console.log(`\n   📊 Total UltimateSpecs: ${totalInserted}`);
  return totalInserted;
}

// ============================================================
// 2. IMCDb - Movie/TV Appearances
// ============================================================
async function importIMCDb() {
  console.log('\n🎬 Importing IMCDb (Movie Appearances)...\n');
  
  const allFile = '../data/raw/imcdb/_all_appearances.json';
  if (!fs.existsSync(allFile)) {
    // Try individual files
    const dir = '../data/raw/imcdb';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    
    let totalInserted = 0;
    
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      const appearances = Array.isArray(data) ? data : data.appearances || data.movies || [];
      
      for (const app of appearances.slice(0, 50)) { // Limit per brand
        if (!app.brand && !app.make) continue;
        
        const brand = app.brand || app.make;
        const brandId = brandMap.get(brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
        if (!brandId) continue;
        
        const modelName = app.model || app.vehicle;
        const genId = findGeneration(brandId, modelName);
        if (!genId) continue;
        
        const { error } = await supabase.from('third_party_specs').upsert({
          generation_id: genId,
          source: 'IMCDb',
          source_url: app.url || app.imcdb_url || '',
          spec_type: `movie_${(app.movie || app.title || 'unknown').substring(0, 25).replace(/\s+/g, '_')}`,
          spec_value: app.year || 2000,
          raw_data: {
            movie: app.movie || app.title,
            year: app.year,
            vehicle: `${brand} ${modelName}`,
            role: app.role,
            scene: app.scene,
          },
        }, { onConflict: 'generation_id,source,spec_type' });
        
        if (!error) totalInserted++;
      }
    }
    
    console.log(`   📊 Total IMCDb: ${totalInserted}`);
    return totalInserted;
  }
  
  // Use consolidated file
  const data = JSON.parse(fs.readFileSync(allFile, 'utf-8'));
  const appearances = Array.isArray(data) ? data : data.appearances || [];
  
  let inserted = 0;
  for (const app of appearances.slice(0, 500)) {
    if (!app.brand) continue;
    
    const brandId = brandMap.get(app.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, app.model);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'IMCDb',
      source_url: app.url || '',
      spec_type: `movie_${(app.movie || 'unknown').substring(0, 25).replace(/\s+/g, '_')}`,
      spec_value: app.year || 2000,
      raw_data: {
        movie: app.movie,
        year: app.year,
        vehicle: `${app.brand} ${app.model}`,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   📊 Total IMCDb: ${inserted}`);
  return inserted;
}

// ============================================================
// 3. Raw EV Database files
// ============================================================
async function importRawEV() {
  console.log('\n⚡ Importing Raw EV Database files...\n');
  
  const dir = '../data/raw/ev_database';
  if (!fs.existsSync(dir)) return 0;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let totalInserted = 0;
  
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    const vehicles = Array.isArray(data) ? data : data.vehicles || [data];
    
    for (const v of vehicles) {
      if (!v.brand) continue;
      
      const brandId = brandMap.get(v.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
      if (!brandId) continue;
      
      const genId = findGeneration(brandId, v.model);
      if (!genId) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'EVDatabaseRaw',
        source_url: v.url || '',
        spec_type: 'ev_full',
        spec_value: v.range_real_km || v.battery_kwh || 0,
        raw_data: {
          battery_kwh: v.battery_kwh,
          battery_usable_kwh: v.battery_usable_kwh,
          range_wltp_km: v.range_wltp_km,
          range_real_km: v.range_real_km,
          efficiency_whkm: v.efficiency_whkm,
          charge_port: v.charge_port,
          charge_speed_ac_kw: v.charge_speed_ac_kw,
          charge_speed_dc_kw: v.charge_speed_dc_kw,
          charge_time_ac: v.charge_time_ac,
          charge_time_dc_10_80: v.charge_time_dc_10_80,
          power_hp: v.power_hp,
          power_kw: v.power_kw,
          torque_nm: v.torque_nm,
          acceleration_0_100: v.acceleration_0_100,
          top_speed_kmh: v.top_speed_kmh,
          drivetrain: v.drivetrain,
          weight_kg: v.weight_kg,
          v2l: v.v2l,
          heat_pump: v.heat_pump,
        },
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) totalInserted++;
    }
  }
  
  console.log(`   📊 Total Raw EV: ${totalInserted}`);
  return totalInserted;
}

// ============================================================
// 4. AutoData specs
// ============================================================
async function importAutoData() {
  console.log('\n📋 Importing AutoData specs...\n');
  
  const dir = '../data/raw/autodata';
  if (!fs.existsSync(dir)) return 0;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let totalInserted = 0;
  
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      const vehicles = Array.isArray(data) ? data : data.vehicles || data.models || [];
      
      for (const v of vehicles.slice(0, 100)) {
        const brand = v.brand || v.make || file.replace('.json', '');
        const brandId = brandMap.get(brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
        if (!brandId) continue;
        
        const genId = findGeneration(brandId, v.model || v.name);
        if (!genId) continue;
        
        const { error } = await supabase.from('third_party_specs').upsert({
          generation_id: genId,
          source: 'AutoData',
          source_url: v.url || '',
          spec_type: 'autodata_specs',
          spec_value: v.power_hp || v.engine_power || 0,
          raw_data: v,
        }, { onConflict: 'generation_id,source,spec_type' });
        
        if (!error) totalInserted++;
      }
    } catch (e) {
      // Skip malformed files
    }
  }
  
  console.log(`   📊 Total AutoData: ${totalInserted}`);
  return totalInserted;
}

// ============================================================
// 5. Performance data (0-60, quarter mile)
// ============================================================
async function importPerformance() {
  console.log('\n🏎️ Importing Performance data...\n');
  
  const dir = '../data/raw/performance';
  if (!fs.existsSync(dir)) return 0;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let totalInserted = 0;
  
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      const records = Array.isArray(data) ? data : data.records || data.times || [];
      
      for (const r of records) {
        if (!r.brand && !r.make) continue;
        
        const brand = r.brand || r.make;
        const brandId = brandMap.get(brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
        if (!brandId) continue;
        
        const genId = findGeneration(brandId, r.model);
        if (!genId) continue;
        
        const { error } = await supabase.from('third_party_specs').upsert({
          generation_id: genId,
          source: 'Performance',
          source_url: r.url || '',
          spec_type: 'acceleration',
          spec_value: Math.round((r.zero_to_60 || r.acceleration_0_100 || 0) * 100),
          raw_data: {
            zero_to_60_mph: r.zero_to_60,
            zero_to_100_kmh: r.acceleration_0_100,
            quarter_mile_sec: r.quarter_mile,
            quarter_mile_mph: r.quarter_mile_mph,
            top_speed_kmh: r.top_speed,
            power_hp: r.power_hp,
          },
        }, { onConflict: 'generation_id,source,spec_type' });
        
        if (!error) totalInserted++;
      }
    } catch (e) {
      // Skip malformed files
    }
  }
  
  console.log(`   📊 Total Performance: ${totalInserted}`);
  return totalInserted;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🔩 FLM AUTO - ADAMANTIUM IMPORT\n');
  console.log('═'.repeat(60));
  
  await initDbMaps();
  
  let total = 0;
  
  total += await importUltimateSpecs();
  total += await importIMCDb();
  total += await importRawEV();
  total += await importAutoData();
  total += await importPerformance();
  
  const { count: totalCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(60));
  console.log('💎 ADAMANTIUM IMPORT COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   New records this run: ${total}`);
  console.log(`   Total third_party_specs: ${totalCount}`);
}

main().catch(console.error);
