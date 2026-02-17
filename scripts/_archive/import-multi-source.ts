/**
 * FLM AUTO - Import EV Database, Interior Dimensions, Nürburgring, CarSized
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getDbMaps() {
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace(/-/g, ''), b.id);
    brandMap.set(b.name.toLowerCase().replace(/ /g, ''), b.id);
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id, name');
  
  return { brandMap, models, generations };
}

function findGeneration(brandId: string, modelName: string, models: any[], generations: any[]): string | null {
  const modelLower = modelName.toLowerCase().replace(/-/g, ' ').replace(/_/g, ' ');
  const brandModels = models?.filter(m => m.brand_id === brandId) || [];
  
  for (const model of brandModels) {
    const dbName = model.name.toLowerCase().replace(/-/g, ' ');
    if (modelLower.includes(dbName) || dbName.includes(modelLower.split(' ')[0]) || 
        modelLower === dbName) {
      const gens = generations?.filter(g => g.model_id === model.id) || [];
      if (gens.length > 0) return gens[0].id;
    }
  }
  return null;
}

// ============================================================
// 1. EV Database Complete
// ============================================================
async function importEVDatabase() {
  console.log('\n⚡ Importing EV Database Complete...\n');
  
  const file = '../data/EV_DATABASE_COMPLETE.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  const vehicles = data.vehicles || data.evs || Object.values(data).filter(v => typeof v === 'object' && v !== null);
  
  for (const [key, vehicle] of Object.entries(data)) {
    if (key === 'metadata') continue;
    const v = vehicle as any;
    
    if (!v.brand) continue;
    const brandId = brandMap.get(v.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, v.model || key, models || [], generations || []);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'EVDatabase',
      source_url: v.url || '',
      spec_type: 'ev_complete',
      spec_value: v.range_wltp_km || v.battery_kwh || 0,
      raw_data: {
        battery_kwh: v.battery_kwh,
        range_wltp_km: v.range_wltp_km,
        range_real_km: v.range_real_km,
        efficiency_whkm: v.efficiency_whkm,
        charge_speed_dc_kw: v.charge_speed_dc_kw,
        charge_time_0_100_ac: v.charge_time_ac,
        charge_time_10_80_dc: v.charge_time_dc,
        power_hp: v.power_hp,
        torque_nm: v.torque_nm,
        acceleration_0_100: v.acceleration_0_100,
        top_speed_kmh: v.top_speed_kmh,
        drivetrain: v.drivetrain,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   ✅ Inserted ${inserted} EV records`);
  return inserted;
}

// ============================================================
// 2. Interior Dimensions Extended
// ============================================================
async function importInteriorDimensions() {
  console.log('\n📐 Importing Interior Dimensions Extended...\n');
  
  const file = '../data/INTERIOR_DIMENSIONS_EXTENDED.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  const vehicles = data.vehicles || data;
  
  for (const [key, vehicle] of Object.entries(vehicles)) {
    if (key === 'metadata') continue;
    const v = vehicle as any;
    
    if (!v.brand) continue;
    const brandId = brandMap.get(v.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, v.model || key, models || [], generations || []);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'InteriorDims',
      source_url: v.source_url || '',
      spec_type: 'interior_extended',
      spec_value: v.rear_shoulder_room_mm || v.rear_legroom_mm || 0,
      raw_data: {
        front_headroom_mm: v.front_headroom_mm,
        rear_headroom_mm: v.rear_headroom_mm,
        front_legroom_mm: v.front_legroom_mm,
        rear_legroom_mm: v.rear_legroom_mm,
        front_shoulder_room_mm: v.front_shoulder_room_mm,
        rear_shoulder_room_mm: v.rear_shoulder_room_mm,
        third_row_legroom_mm: v.third_row_legroom_mm,
        third_row_headroom_mm: v.third_row_headroom_mm,
        cargo_volume_l: v.cargo_volume_l,
        cargo_volume_max_l: v.cargo_volume_max_l,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   ✅ Inserted ${inserted} interior dimension records`);
  return inserted;
}

// ============================================================
// 3. Nürburgring Lap Times
// ============================================================
async function importNurburgring() {
  console.log('\n🏁 Importing Nürburgring Lap Times...\n');
  
  const file = '../data/NURBURGRING_LAP_TIMES.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  const laps = data.lap_times || data.records || data;
  
  for (const [key, lap] of Object.entries(laps)) {
    if (key === 'metadata') continue;
    const l = lap as any;
    
    if (!l.brand) continue;
    const brandId = brandMap.get(l.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, l.model || key, models || [], generations || []);
    if (!genId) continue;
    
    // Convert lap time to seconds
    let lapSeconds = 0;
    if (l.lap_time) {
      const match = l.lap_time.match(/(\d+):(\d+)\.?(\d*)/);
      if (match) {
        lapSeconds = parseInt(match[1]) * 60 + parseInt(match[2]) + (parseInt(match[3] || '0') / 100);
      }
    }
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'Nurburgring',
      source_url: l.video_url || '',
      spec_type: 'nurburgring_lap',
      spec_value: Math.round(lapSeconds * 100), // Store as centiseconds
      raw_data: {
        lap_time: l.lap_time,
        lap_seconds: lapSeconds,
        driver: l.driver,
        date: l.date,
        conditions: l.conditions,
        tires: l.tires,
        variant: l.variant,
        power_hp: l.power_hp,
        video_url: l.video_url,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   ✅ Inserted ${inserted} Nürburgring records`);
  return inserted;
}

// ============================================================
// 4. CarSized Dimensions
// ============================================================
async function importCarSized() {
  console.log('\n📏 Importing CarSized Dimensions...\n');
  
  const file = '../data/carsized-dimensions.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  const vehicles = Array.isArray(data) ? data : data.vehicles || Object.values(data);
  
  for (const v of vehicles) {
    if (!v.brand) continue;
    const brandId = brandMap.get(v.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, v.model, models || [], generations || []);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'CarSized',
      source_url: v.source_url || 'https://www.carsized.com',
      spec_type: 'carsized_dims',
      spec_value: v.length_mm || 0,
      raw_data: {
        length_mm: v.length_mm,
        width_mm: v.width_mm,
        height_mm: v.height_mm,
        wheelbase_mm: v.wheelbase_mm,
        front_track_mm: v.front_track_mm,
        rear_track_mm: v.rear_track_mm,
        ground_clearance_mm: v.ground_clearance_mm,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   ✅ Inserted ${inserted} CarSized records`);
  return inserted;
}

// ============================================================
// 5. ISOFIX Extended
// ============================================================
async function importISOFIX() {
  console.log('\n👶 Importing ISOFIX Extended...\n');
  
  const file = '../data/FAMILY_FIT_ISOFIX_EXTENDED.json';
  if (!fs.existsSync(file)) return 0;
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  const vehicles = data.vehicles || data;
  
  for (const [key, vehicle] of Object.entries(vehicles)) {
    if (key === 'metadata') continue;
    const v = vehicle as any;
    
    if (!v.brand) continue;
    const brandId = brandMap.get(v.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, v.model || key, models || [], generations || []);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'ISOFIX',
      source_url: '',
      spec_type: 'isofix_extended',
      spec_value: v.isofix_points || 2,
      raw_data: {
        isofix_points: v.isofix_points,
        isofix_row_2: v.isofix_row_2,
        isofix_row_3: v.isofix_row_3,
        top_tether: v.top_tether,
        three_across_possible: v.three_across_possible,
        rear_bench_width_mm: v.rear_bench_width_mm,
        center_seat_width_mm: v.center_seat_width_mm,
        notes: v.notes,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`   ✅ Inserted ${inserted} ISOFIX records`);
  return inserted;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🚀 FLM AUTO - Multi-Source Import\n');
  console.log('═'.repeat(50));
  
  let total = 0;
  
  total += await importEVDatabase();
  total += await importInteriorDimensions();
  total += await importNurburgring();
  total += await importCarSized();
  total += await importISOFIX();
  
  const { count: totalCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 IMPORT COMPLETE');
  console.log('═'.repeat(50));
  console.log(`   New records this run: ${total}`);
  console.log(`   Total third_party_specs: ${totalCount}`);
}

main().catch(console.error);
