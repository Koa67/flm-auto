/**
 * FLM AUTO - Import NHTSA Safety Data (Fixed)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('🛡️ FLM AUTO - Import NHTSA Safety Data\n');
  
  const makes = ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Tesla', 'Toyota', 'Honda', 'Ford', 'Hyundai', 'Volvo', 'Nissan', 'Mazda', 'Kia', 'Lexus', 'Jaguar'];
  const years = [2020, 2021, 2022, 2023, 2024];
  
  // Get DB data
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace(/-/g, ''), b.id);
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id, name, production_start');
  
  let totalInserted = 0;
  let totalFetched = 0;
  
  for (const make of makes) {
    const brandId = brandMap.get(make.toLowerCase()) || brandMap.get(make.toLowerCase().replace(/-/g, ''));
    if (!brandId) {
      console.log(`   ⚠️ Brand not in DB: ${make}`);
      continue;
    }
    
    let makeInserted = 0;
    
    for (const year of years) {
      try {
        const url = `https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(make)}?format=json`;
        const response = await fetch(url);
        if (!response.ok) continue;
        
        const data = await response.json();
        if (!data.Results || data.Results.length === 0) continue;
        
        for (const vehicle of data.Results) {
          totalFetched++;
          
          await delay(50); // Rate limit
          
          // Get detailed ratings
          const detailUrl = `https://api.nhtsa.gov/SafetyRatings/VehicleId/${vehicle.VehicleId}?format=json`;
          const detailResponse = await fetch(detailUrl);
          if (!detailResponse.ok) continue;
          
          const detail = await detailResponse.json();
          const result = detail.Results?.[0];
          if (!result) continue;
          
          // Find matching model
          const brandModels = models?.filter(m => m.brand_id === brandId) || [];
          let matchedModel: any = null;
          
          const vehicleModelLower = vehicle.Model.toLowerCase();
          for (const model of brandModels) {
            const modelNameLower = model.name.toLowerCase();
            if (vehicleModelLower.includes(modelNameLower) || 
                vehicleModelLower.split(' ')[0] === modelNameLower ||
                modelNameLower.includes(vehicleModelLower.split(' ')[0])) {
              matchedModel = model;
              break;
            }
          }
          
          if (!matchedModel) continue;
          
          // Find generation
          const modelGens = generations?.filter(g => g.model_id === matchedModel.id) || [];
          if (modelGens.length === 0) continue;
          
          let matchedGen = modelGens[0];
          for (const gen of modelGens) {
            if (gen.production_start) {
              const genYear = new Date(gen.production_start).getFullYear();
              if (genYear <= year) matchedGen = gen;
            }
          }
          
          // Parse ratings - they come as strings like "5" or "Not Rated"
          const parseRating = (val: any): number | null => {
            if (!val || val === 'Not Rated' || val === '') return null;
            const num = parseInt(String(val));
            return isNaN(num) ? null : num;
          };
          
          const overall = parseRating(result.OverallRating);
          const frontal = parseRating(result.OverallFrontCrashRating);
          const side = parseRating(result.OverallSideCrashRating);
          const rollover = parseRating(result.RolloverRating);
          
          // Insert one combined record per vehicle/year
          if (overall !== null || frontal !== null || side !== null) {
            const { error } = await supabase
              .from('third_party_specs')
              .upsert({
                generation_id: matchedGen.id,
                source: 'NHTSA',
                source_url: `https://www.nhtsa.gov/vehicle/${year}/${encodeURIComponent(make)}/${encodeURIComponent(vehicle.Model)}`,
                spec_type: `nhtsa_safety_${year}`,
                spec_value: overall || frontal || side || 0,
                raw_data: {
                  year,
                  make,
                  model: vehicle.Model,
                  vehicle_id: vehicle.VehicleId,
                  overall_rating: overall,
                  frontal_crash: frontal,
                  side_crash: side,
                  rollover: rollover,
                  complaints: result.ComplaintsCount,
                  recalls: result.RecallsCount,
                  investigations: result.InvestigationCount,
                },
              }, { onConflict: 'generation_id,source,spec_type' });
            
            if (!error) {
              makeInserted++;
              totalInserted++;
            }
          }
        }
        
      } catch (e: any) {
        console.log(`   ❌ Error ${make} ${year}: ${e.message}`);
      }
    }
    
    console.log(`   ✅ ${make}: ${makeInserted} ratings inserted`);
  }
  
  // Final counts
  const { count: nhtsaCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'NHTSA');
  
  const { count: totalCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 NHTSA Import Complete:');
  console.log('═'.repeat(50));
  console.log(`   Vehicles fetched: ${totalFetched}`);
  console.log(`   Ratings inserted: ${totalInserted}`);
  console.log(`\n📊 DB Totals:`);
  console.log(`   NHTSA records: ${nhtsaCount}`);
  console.log(`   Total third_party_specs: ${totalCount}`);
}

main().catch(console.error);
