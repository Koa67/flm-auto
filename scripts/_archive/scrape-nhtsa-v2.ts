import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function paginate(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + step - 1);
    if (error) { console.log(`Pagination error: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return all;
}

async function main() {
  console.log('🛡️  FLM AUTO — NHTSA Safety Ratings v2\n');

  // Load our data
  const brands = await paginate('brands', 'id, name');
  const models = await paginate('models', 'id, name, brand_id');
  const generations = await paginate('generations', 'id, name, model_id');

  console.log(`Brands: ${brands.length}, Models: ${models.length}, Generations: ${generations.length}`);

  if (generations.length === 0) {
    console.log('ERROR: No generations loaded!');
    return;
  }

  // Build lookups
  const brandById = new Map(brands.map(b => [b.id, b.name]));
  const brandByName = new Map(brands.map(b => [b.name.toLowerCase(), b.id]));
  const modelsByBrand = new Map<string, any[]>();
  for (const m of models) {
    if (!modelsByBrand.has(m.brand_id)) modelsByBrand.set(m.brand_id, []);
    modelsByBrand.get(m.brand_id)!.push(m);
  }
  const gensByModel = new Map<string, any[]>();
  for (const g of generations) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Brand mapping
  const nhtsaBrands = ['BMW', 'MERCEDES-BENZ', 'AUDI', 'VOLKSWAGEN', 'TOYOTA', 'HONDA', 
    'NISSAN', 'HYUNDAI', 'KIA', 'FORD', 'TESLA', 'VOLVO', 'MAZDA', 'LEXUS', 'PORSCHE'];

  const brandMap: Record<string, string> = {
    'BMW': 'BMW', 'MERCEDES-BENZ': 'Mercedes-Benz', 'AUDI': 'Audi', 'VOLKSWAGEN': 'Volkswagen',
    'TOYOTA': 'Toyota', 'HONDA': 'Honda', 'NISSAN': 'Nissan', 'HYUNDAI': 'Hyundai',
    'KIA': 'Kia', 'FORD': 'Ford', 'TESLA': 'Tesla', 'VOLVO': 'Volvo', 'MAZDA': 'Mazda',
    'LEXUS': 'Lexus', 'PORSCHE': 'Porsche',
  };

  let matched = 0, specs = 0;

  for (const year of [2024, 2023, 2022, 2021, 2020]) {
    console.log(`\n📅 ${year}`);

    for (const nhtsaBrand of nhtsaBrands) {
      const ourBrand = brandMap[nhtsaBrand];
      const brandId = brandByName.get(ourBrand?.toLowerCase() || '');
      if (!brandId) continue;

      const brandModels = modelsByBrand.get(brandId) || [];
      
      // Get NHTSA models
      const data = await fetchJson(`https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(nhtsaBrand)}`);
      if (!data?.Results) continue;

      for (const nhtsaModel of data.Results) {
        const modelName = nhtsaModel.Model?.toLowerCase() || '';
        
        // Find our model
        const ourModel = brandModels.find(m => 
          modelName.includes(m.name.toLowerCase()) || 
          m.name.toLowerCase().includes(modelName.split(' ')[0])
        );
        if (!ourModel) continue;

        const modelGens = gensByModel.get(ourModel.id) || [];
        if (modelGens.length === 0) continue;

        // Get vehicles with ratings
        const vehiclesData = await fetchJson(
          `https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(nhtsaBrand)}/model/${encodeURIComponent(nhtsaModel.Model)}`
        );
        
        for (const v of vehiclesData?.Results || []) {
          if (!v.VehicleId) continue;

          const detail = await fetchJson(`https://api.nhtsa.gov/SafetyRatings/VehicleId/${v.VehicleId}`);
          const r = detail?.Results?.[0];
          if (!r || r.OverallRating === 'Not Rated') continue;

          // Insert for first generation
          const gen = modelGens[0];
          const specData = [
            { spec_type: 'safety_overall', spec_value: r.OverallRating },
            { spec_type: 'safety_frontal', spec_value: r.OverallFrontCrashRating },
            { spec_type: 'safety_side', spec_value: r.OverallSideCrashRating },
            { spec_type: 'safety_rollover', spec_value: r.RolloverRating },
          ].filter(s => s.spec_value && s.spec_value !== 'Not Rated');

          for (const s of specData) {
            await supabase.from('third_party_specs').upsert({
              generation_id: gen.id,
              source: 'NHTSA',
              ...s,
              spec_unit: 'stars'
            }, { onConflict: 'generation_id,source,spec_type' });
            specs++;
          }
          matched++;
          console.log(`  ✓ ${ourBrand} ${ourModel.name} → ${r.OverallRating}★`);
          break; // One per model
        }
        await delay(100);
      }
    }
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ NHTSA: ${matched} vehicles, ${specs} specs inserted`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
