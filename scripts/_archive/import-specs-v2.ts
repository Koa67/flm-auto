/**
 * FLM AUTO - Import Wikipedia specs & NHTSA safety data
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function importWikipediaSpecs() {
  console.log('\n📖 Importing Wikipedia Specs...\n');
  
  const specsFile = '../data/raw/specs_v2/wikipedia_specs.json';
  if (!fs.existsSync(specsFile)) {
    console.log('   ❌ File not found');
    return 0;
  }
  
  const specs = JSON.parse(fs.readFileSync(specsFile, 'utf-8'));
  console.log(`   Loaded ${specs.length} specs`);
  
  // Get DB data
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace('-', ''), b.id);
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id, name');
  
  let inserted = 0;
  
  for (const spec of specs) {
    // Parse brand and model from title
    // e.g. "BMW 3 Series (E90)" -> brand=BMW, model=3 Series, gen=E90
    const title = spec.title || spec.wiki_title?.replace(/_/g, ' ') || '';
    
    // Try to match brand
    let brandId: string | null = null;
    let brandName = '';
    
    for (const [name, id] of brandMap) {
      if (title.toLowerCase().startsWith(name)) {
        brandId = id;
        brandName = name;
        break;
      }
    }
    
    if (!brandId) continue;
    
    // Find model
    const brandModels = models?.filter(m => m.brand_id === brandId) || [];
    let matchedModel: any = null;
    
    for (const model of brandModels) {
      if (title.toLowerCase().includes(model.name.toLowerCase())) {
        matchedModel = model;
        break;
      }
    }
    
    if (!matchedModel) continue;
    
    // Find generation (prefer matching chassis code like E90, F30, W205)
    const modelGens = generations?.filter(g => g.model_id === matchedModel.id) || [];
    let matchedGen = modelGens[0]; // Default to first
    
    // Try to match chassis code from title
    const chassisMatch = title.match(/\(([A-Z]\d+)\)/i);
    if (chassisMatch) {
      const chassis = chassisMatch[1].toUpperCase();
      const genMatch = modelGens.find(g => g.name.toUpperCase().includes(chassis));
      if (genMatch) matchedGen = genMatch;
    }
    
    if (!matchedGen) continue;
    
    // Insert specs
    const specFields = [
      'engine', 'transmission', 'wheelbase', 'length', 'width', 'height',
      'curb_weight', 'body_style', 'layout', 'platform', 'related',
      'designer', 'production', 'assembly', 'class', 'fuel_capacity',
    ];
    
    for (const field of specFields) {
      if (spec[field]) {
        const { error } = await supabase
          .from('third_party_specs')
          .upsert({
            generation_id: matchedGen.id,
            source: 'Wikipedia',
            source_url: `https://en.wikipedia.org/wiki/${spec.wiki_title || ''}`,
            spec_type: `wiki_${field}`,
            spec_value: 1,
            raw_data: { [field]: spec[field], title: spec.title },
          }, { onConflict: 'generation_id,source,spec_type' });
        
        if (!error) inserted++;
      }
    }
    
    console.log(`   ✅ ${title}: matched to ${matchedModel.name}`);
  }
  
  return inserted;
}

async function importNHTSASafety() {
  console.log('\n🛡️ Importing NHTSA Safety Data...\n');
  
  // Re-fetch NHTSA data with full details this time
  const makes = ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Tesla', 'Toyota', 'Honda', 'Ford', 'Hyundai', 'Volvo'];
  const years = [2020, 2021, 2022, 2023, 2024];
  
  // Get DB data
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace('-', ''), b.id);
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id, name, production_start');
  
  let inserted = 0;
  let fetched = 0;
  
  for (const make of makes) {
    const brandId = brandMap.get(make.toLowerCase()) || brandMap.get(make.toLowerCase().replace('-', ''));
    if (!brandId) {
      console.log(`   ⚠️ Brand not in DB: ${make}`);
      continue;
    }
    
    for (const year of years) {
      try {
        // Get models for this make/year
        const url = `https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(make)}?format=json`;
        const response = await fetch(url);
        if (!response.ok) continue;
        
        const data = await response.json();
        if (!data.Results || data.Results.length === 0) continue;
        
        for (const vehicle of data.Results) {
          fetched++;
          
          // Get detailed ratings
          const detailUrl = `https://api.nhtsa.gov/SafetyRatings/VehicleId/${vehicle.VehicleId}?format=json`;
          const detailResponse = await fetch(detailUrl);
          if (!detailResponse.ok) continue;
          
          const detail = await detailResponse.json();
          const result = detail.Results?.[0];
          if (!result) continue;
          
          // Find matching model in DB
          const brandModels = models?.filter(m => m.brand_id === brandId) || [];
          let matchedModel: any = null;
          
          const vehicleModel = vehicle.Model.toLowerCase();
          for (const model of brandModels) {
            const modelName = model.name.toLowerCase();
            if (vehicleModel.includes(modelName) || modelName.includes(vehicleModel.split(' ')[0])) {
              matchedModel = model;
              break;
            }
          }
          
          if (!matchedModel) continue;
          
          // Find generation closest to year
          const modelGens = generations?.filter(g => g.model_id === matchedModel.id) || [];
          let matchedGen = modelGens[0];
          
          for (const gen of modelGens) {
            if (gen.production_start) {
              const genYear = new Date(gen.production_start).getFullYear();
              if (genYear <= year) matchedGen = gen;
            }
          }
          
          if (!matchedGen) continue;
          
          // Insert safety ratings
          const ratings = [
            { type: 'nhtsa_overall', value: result.OverallRating },
            { type: 'nhtsa_frontal', value: result.OverallFrontCrashRating },
            { type: 'nhtsa_side', value: result.OverallSideCrashRating },
            { type: 'nhtsa_rollover', value: result.RolloverRating },
          ];
          
          for (const rating of ratings) {
            if (rating.value && rating.value !== 'Not Rated') {
              const numValue = parseInt(rating.value) || 0;
              
              const { error } = await supabase
                .from('third_party_specs')
                .upsert({
                  generation_id: matchedGen.id,
                  source: 'NHTSA',
                  source_url: `https://www.nhtsa.gov/vehicle/${year}/${make}/${vehicle.Model}`,
                  spec_type: `${rating.type}_${year}`,
                  spec_value: numValue,
                  raw_data: {
                    year,
                    make,
                    model: vehicle.Model,
                    vehicle_id: vehicle.VehicleId,
                    complaints: result.ComplaintsCount,
                    recalls: result.RecallsCount,
                  },
                }, { onConflict: 'generation_id,source,spec_type' });
              
              if (!error) inserted++;
            }
          }
        }
        
        console.log(`   ✅ ${make} ${year}: processed`);
        
        // Small delay to be nice to API
        await new Promise(r => setTimeout(r, 100));
        
      } catch (e) {
        // Skip errors
      }
    }
  }
  
  console.log(`\n   📊 Fetched ${fetched} vehicles, inserted ${inserted} ratings`);
  return inserted;
}

async function main() {
  console.log('🚀 FLM AUTO - Import Specs V2 Data\n');
  
  const wikiInserted = await importWikipediaSpecs();
  const nhtsaInserted = await importNHTSASafety();
  
  // Final counts
  const { count: specCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  const { count: nhtsaCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'NHTSA');
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Import Complete:');
  console.log('═'.repeat(50));
  console.log(`   Wikipedia specs inserted: ${wikiInserted}`);
  console.log(`   NHTSA ratings inserted: ${nhtsaInserted}`);
  console.log(`\n📊 DB Totals:`);
  console.log(`   Total third_party_specs: ${specCount}`);
  console.log(`   NHTSA records: ${nhtsaCount}`);
}

main().catch(console.error);
