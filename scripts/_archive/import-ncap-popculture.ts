/**
 * FLM AUTO - Import Euro NCAP + Pop Culture (fixed structure)
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
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id, name');
  
  return { brandMap, models, generations };
}

function findGeneration(brandId: string, modelName: string, models: any[], generations: any[]): string | null {
  const modelNameLower = modelName.toLowerCase()
    .replace(/_/g, ' ')
    .replace(/classe /g, '')
    .replace(/serie /g, '')
    .replace(/series/g, '')
    .replace(/-/g, ' ')
    .replace(/\d+/g, m => ` ${m} `)
    .trim();
  
  const brandModels = models?.filter(m => m.brand_id === brandId) || [];
  
  for (const model of brandModels) {
    const dbName = model.name.toLowerCase().replace(/-/g, ' ');
    
    // Extract key part (e.g., "3" from "3 series")
    const modelNum = modelNameLower.match(/\d+/)?.[0];
    const dbNum = dbName.match(/\d+/)?.[0];
    
    if (modelNum && dbNum && modelNum === dbNum) {
      const gens = generations?.filter(g => g.model_id === model.id) || [];
      if (gens.length > 0) return gens[0].id;
    }
    
    if (modelNameLower.includes(dbName) || dbName.includes(modelNameLower.split(' ')[0])) {
      const gens = generations?.filter(g => g.model_id === model.id) || [];
      if (gens.length > 0) return gens[0].id;
    }
  }
  return null;
}

async function importEuroNCAP() {
  console.log('\n⭐ Importing Euro NCAP Extended...\n');
  
  const file = '../data/EURONCAP_EXTENDED_DATABASE.json';
  if (!fs.existsSync(file)) {
    console.log('   ❌ File not found');
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  
  // Structure is: ratings_2024_2025.bmw.1_series_f40
  const ratings = data.ratings_2024_2025 || data.ratings || {};
  
  for (const [brandKey, brandData] of Object.entries(ratings)) {
    const brandId = brandMap.get(brandKey.toLowerCase());
    if (!brandId) {
      console.log(`   ⚠️ Brand not found: ${brandKey}`);
      continue;
    }
    
    for (const [modelKey, modelData] of Object.entries(brandData as any)) {
      const rating = modelData as any;
      
      const genId = findGeneration(brandId, rating.model || modelKey, models || [], generations || []);
      if (!genId) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'EuroNCAP',
        source_url: rating.url || '',
        spec_type: 'euroncap_rating',
        spec_value: rating.stars || 0,
        raw_data: {
          stars: rating.stars,
          year_tested: rating.year_tested,
          generation: rating.generation,
          adult_occupant_pct: rating.adult_occupant_pct,
          child_occupant_pct: rating.child_occupant_pct,
          pedestrian_pct: rating.pedestrian_pct,
          safety_assist_pct: rating.safety_assist_pct,
        },
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) {
        inserted++;
        console.log(`   ✅ ${rating.model || modelKey}`);
      }
    }
  }
  
  console.log(`\n   📊 Inserted ${inserted} Euro NCAP records`);
  return inserted;
}

async function importPopCulture() {
  console.log('\n🎬 Importing Pop Culture & Motorsport...\n');
  
  const file = '../data/POP_CULTURE_MOTORSPORT_DATABASE.json';
  if (!fs.existsSync(file)) {
    console.log('   ❌ File not found');
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  
  // TV Shows
  const tvShows = data.tv_shows || {};
  for (const [showKey, showData] of Object.entries(tvShows)) {
    const show = showData as any;
    const vehicle = show.primary_vehicle;
    
    if (!vehicle?.make) continue;
    
    const brandId = brandMap.get(vehicle.make.toLowerCase());
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, vehicle.model, models || [], generations || []);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'PopCulture',
      source_url: '',
      spec_type: `tv_${showKey}`,
      spec_value: parseInt(show.years?.split('-')[0]) || 1980,
      raw_data: {
        type: 'tv_show',
        title: show.title,
        years: show.years,
        network: show.network,
        character: show.character,
        lead_actor: show.lead_actor,
        vehicle_color: vehicle.color,
        license_plate: vehicle.license_plate,
        fun_facts: vehicle.fun_facts?.slice(0, 3),
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) {
      inserted++;
      console.log(`   ✅ ${show.title}: ${vehicle.make} ${vehicle.model}`);
    }
  }
  
  // Movies
  const movies = data.movies || {};
  for (const [movieKey, movieData] of Object.entries(movies)) {
    const movie = movieData as any;
    const vehicles = movie.vehicles || movie.primary_vehicles || [];
    
    for (const vehicle of (Array.isArray(vehicles) ? vehicles : [vehicles])) {
      if (!vehicle?.make) continue;
      
      const brandId = brandMap.get(vehicle.make.toLowerCase());
      if (!brandId) continue;
      
      const genId = findGeneration(brandId, vehicle.model, models || [], generations || []);
      if (!genId) continue;
      
      const { error } = await supabase.from('third_party_specs').upsert({
        generation_id: genId,
        source: 'PopCulture',
        source_url: movie.imdb_url || '',
        spec_type: `movie_${movieKey.substring(0, 30)}`,
        spec_value: movie.year || 2000,
        raw_data: {
          type: 'movie',
          title: movie.title,
          year: movie.year,
          role: vehicle.role,
          character: vehicle.character,
          iconic_scene: vehicle.iconic_scene,
        },
      }, { onConflict: 'generation_id,source,spec_type' });
      
      if (!error) {
        inserted++;
        console.log(`   ✅ ${movie.title}: ${vehicle.make} ${vehicle.model}`);
      }
    }
  }
  
  // Drag Racing Records
  const dragRacing = data.drag_racing || {};
  for (const [recordKey, recordData] of Object.entries(dragRacing)) {
    const record = recordData as any;
    
    if (!record.make) continue;
    
    const brandId = brandMap.get(record.make.toLowerCase());
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, record.model, models || [], generations || []);
    if (!genId) continue;
    
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'Motorsport',
      source_url: record.video_url || '',
      spec_type: `drag_${recordKey.substring(0, 30)}`,
      spec_value: record.quarter_mile_sec ? Math.round(record.quarter_mile_sec * 100) : 0,
      raw_data: {
        type: 'drag_racing',
        quarter_mile_sec: record.quarter_mile_sec,
        quarter_mile_mph: record.quarter_mile_mph,
        zero_to_sixty: record.zero_to_sixty,
        power_hp: record.power_hp,
        modifications: record.modifications,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) {
      inserted++;
      console.log(`   ✅ Drag: ${record.make} ${record.model}`);
    }
  }
  
  console.log(`\n   📊 Inserted ${inserted} pop culture records`);
  return inserted;
}

async function importDetailedSpecs() {
  console.log('\n📐 Importing Detailed Specs...\n');
  
  const file = '../data/detailed-specs.json';
  if (!fs.existsSync(file)) {
    console.log('   ❌ File not found');
    return 0;
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { brandMap, models, generations } = await getDbMaps();
  
  let inserted = 0;
  const specs = Array.isArray(data) ? data : data.specs || Object.values(data);
  
  for (const spec of specs) {
    if (!spec.brand) continue;
    
    const brandId = brandMap.get(spec.brand.toLowerCase());
    if (!brandId) continue;
    
    const genId = findGeneration(brandId, spec.model, models || [], generations || []);
    if (!genId) continue;
    
    // Insert key specs
    const keySpecs = ['length_mm', 'width_mm', 'height_mm', 'wheelbase_mm', 'weight_kg', 'fuel_tank_l', 'trunk_volume_l'];
    
    for (const key of keySpecs) {
      if (spec[key]) {
        const { error } = await supabase.from('third_party_specs').upsert({
          generation_id: genId,
          source: 'DetailedSpecs',
          source_url: spec.source_url || '',
          spec_type: key,
          spec_value: spec[key],
          raw_data: { [key]: spec[key], variant: spec.variant },
        }, { onConflict: 'generation_id,source,spec_type' });
        
        if (!error) inserted++;
      }
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} detailed spec records`);
  return inserted;
}

async function main() {
  console.log('🚀 FLM AUTO - Import Euro NCAP + Pop Culture + Specs\n');
  console.log('═'.repeat(50));
  
  let total = 0;
  
  total += await importEuroNCAP();
  total += await importPopCulture();
  total += await importDetailedSpecs();
  
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
