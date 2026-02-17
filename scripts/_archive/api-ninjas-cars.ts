/**
 * API NINJAS CARS SCRAPER
 * 
 * Free tier: 10,000 requests/month
 * Endpoints: /carmakes, /carmodels, /cartrims, /cars (full specs)
 * 
 * Usage: NINJAS_API_KEY=xxx npx ts-node api-ninjas-cars.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const API_KEY = process.env.NINJAS_API_KEY;

if (!API_KEY) {
  console.log('❌ Missing NINJAS_API_KEY');
  console.log('   Get free key at: https://api-ninjas.com/register');
  console.log('   Usage: NINJAS_API_KEY=xxx npx ts-node api-ninjas-cars.ts');
  process.exit(1);
}

function apiCall(endpoint: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://api.api-ninjas.com/v1/${endpoint}`;
    https.get(url, {
      headers: {
        'X-Api-Key': API_KEY!,
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeNinjas() {
  console.log('🥷 API NINJAS CARS SCRAPER\n');
  console.log('═'.repeat(60));
  
  // Get our generations for matching
  let ourGens: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .range(page * 500, (page + 1) * 500 - 1);
    if (!data || data.length === 0) break;
    ourGens.push(...data);
    if (data.length < 500) break;
    page++;
  }
  console.log(`Our generations: ${ourGens.length}\n`);
  
  // Build lookup
  const genLookup = new Map<string, string>();
  for (const g of ourGens) {
    const m = g.model as any;
    if (!m?.brand) continue;
    const key = `${m.brand.name.toLowerCase()}|${m.name.toLowerCase()}`;
    genLookup.set(key, g.id);
  }
  
  // Our priority makes
  const makes = [
    'bmw', 'mercedes-benz', 'audi', 'volkswagen', 'porsche',
    'toyota', 'honda', 'mazda', 'nissan', 'hyundai', 'kia',
    'volvo', 'ford', 'chevrolet', 'tesla', 'lexus', 'jaguar',
    'land rover', 'mini', 'alfa romeo', 'fiat', 'peugeot', 'renault'
  ];
  
  let totalCars = 0;
  let totalSpecs = 0;
  let matchedGens = new Set<string>();
  let apiCalls = 0;
  
  for (const make of makes) {
    console.log(`\n📦 ${make.toUpperCase()}`);
    
    // Get models for this make
    const models = await apiCall(`carmodels?make=${encodeURIComponent(make)}`);
    apiCalls++;
    
    if (!Array.isArray(models) || models.length === 0) {
      console.log('   No models found');
      continue;
    }
    
    console.log(`   Models: ${models.length}`);
    
    // Process top 10 models
    for (const model of models.slice(0, 10)) {
      await sleep(200); // Rate limiting
      
      // Get car specs
      const cars = await apiCall(`cars?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&limit=5`);
      apiCalls++;
      
      if (!Array.isArray(cars) || cars.length === 0) continue;
      
      for (const car of cars) {
        totalCars++;
        
        // Find matching generation
        const lookupKey = `${make.toLowerCase()}|${model.toLowerCase()}`;
        let genId = genLookup.get(lookupKey);
        
        // Fuzzy match
        if (!genId) {
          for (const [key, id] of genLookup) {
            if (key.startsWith(make.toLowerCase()) && key.includes(model.toLowerCase().split(' ')[0])) {
              genId = id;
              break;
            }
          }
        }
        
        if (genId) {
          matchedGens.add(genId);
          
          // Map car specs to our format
          const specs: any[] = [];
          
          if (car.city_mpg) specs.push({ generation_id: genId, source: 'API Ninjas', spec_type: 'fuel_economy_city_mpg', spec_value: car.city_mpg, raw_data: car });
          if (car.highway_mpg) specs.push({ generation_id: genId, source: 'API Ninjas', spec_type: 'fuel_economy_highway_mpg', spec_value: car.highway_mpg, raw_data: {} });
          if (car.combination_mpg) specs.push({ generation_id: genId, source: 'API Ninjas', spec_type: 'fuel_economy_combined_mpg', spec_value: car.combination_mpg, raw_data: {} });
          if (car.cylinders) specs.push({ generation_id: genId, source: 'API Ninjas', spec_type: 'engine_cylinders', spec_value: car.cylinders, raw_data: {} });
          if (car.displacement) specs.push({ generation_id: genId, source: 'API Ninjas', spec_type: 'engine_displacement_l', spec_value: car.displacement, raw_data: {} });
          if (car.drive) specs.push({ generation_id: genId, source: 'API Ninjas', spec_type: 'drivetrain', spec_value: 0, raw_data: { drive: car.drive } });
          if (car.fuel_type) specs.push({ generation_id: genId, source: 'API Ninjas', spec_type: 'fuel_type', spec_value: 0, raw_data: { fuel_type: car.fuel_type } });
          if (car.transmission) specs.push({ generation_id: genId, source: 'API Ninjas', spec_type: 'transmission_type', spec_value: 0, raw_data: { transmission: car.transmission } });
          if (car.year) specs.push({ generation_id: genId, source: 'API Ninjas', spec_type: 'model_year', spec_value: car.year, raw_data: {} });
          if (car.class) specs.push({ generation_id: genId, source: 'API Ninjas', spec_type: 'vehicle_class', spec_value: 0, raw_data: { class: car.class } });
          
          if (specs.length > 0) {
            await supabase.from('third_party_specs').upsert(specs, { onConflict: 'generation_id,source,spec_type' });
            totalSpecs += specs.length;
            process.stdout.write('.');
          }
        }
      }
      
      // Check API quota
      if (apiCalls >= 500) {
        console.log(`\n⚠️ Approaching rate limit (${apiCalls} calls), stopping...`);
        break;
      }
    }
    
    if (apiCalls >= 500) break;
  }
  
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🥷 API NINJAS COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   API calls: ${apiCalls}`);
  console.log(`   Cars found: ${totalCars}`);
  console.log(`   Specs added: ${totalSpecs}`);
  console.log(`   Generations matched: ${matchedGens.size}`);
  console.log(`   Total specs in DB: ${count}`);
}

scrapeNinjas().catch(console.error);
