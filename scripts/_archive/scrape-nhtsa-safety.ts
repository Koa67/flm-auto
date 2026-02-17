/**
 * FLM AUTO — NHTSA Safety Ratings Scraper
 * Source: NHTSA 5-Star Safety Ratings API (public, no auth)
 * https://api.nhtsa.gov/SafetyRatings
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function paginate(table: string, select: string): Promise<any[]> {
  let all: any[] = [];
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

async function main() {
  console.log('🛡️  FLM AUTO — NHTSA Safety Ratings\n');

  // Get model years available
  const yearsData = await fetchJson('https://api.nhtsa.gov/SafetyRatings');
  const years = yearsData?.Results?.map((r: any) => r.ModelYear) || [];
  console.log(`Available years: ${years.slice(0, 10).join(', ')}...`);

  // Load our generations
  const brands = await paginate('brands', 'id, name');
  const models = await paginate('models', 'id, name, brand_id');
  const generations = await paginate('generations', 'id, name, model_id, year_start, year_end');

  console.log(`Our brands: ${brands.length}`);
  console.log(`Our generations: ${generations.length}`);

  // Build lookup
  const brandById = new Map(brands.map(b => [b.id, b.name]));
  const modelById = new Map(models.map(m => [m.id, { name: m.name, brandId: m.brand_id }]));

  // Brand name mapping (our names -> NHTSA names)
  const brandMapping: Record<string, string> = {
    'Mercedes-Benz': 'MERCEDES-BENZ',
    'BMW': 'BMW',
    'Audi': 'AUDI',
    'Volkswagen': 'VOLKSWAGEN',
    'Toyota': 'TOYOTA',
    'Honda': 'HONDA',
    'Nissan': 'NISSAN',
    'Hyundai': 'HYUNDAI',
    'Kia': 'KIA',
    'Ford': 'FORD',
    'Tesla': 'TESLA',
    'Volvo': 'VOLVO',
    'Mazda': 'MAZDA',
    'Lexus': 'LEXUS',
    'Porsche': 'PORSCHE',
    'Alfa Romeo': 'ALFA ROMEO',
    'Fiat': 'FIAT',
    'Jaguar': 'JAGUAR',
    'Land Rover': 'LAND ROVER',
    'Mini': 'MINI',
  };

  let totalMatched = 0;
  let totalSpecs = 0;

  // Process recent years (2015-2025)
  for (const year of years.filter((y: number) => y >= 2015 && y <= 2025)) {
    console.log(`\n📅 Year ${year}`);

    // Get makes for this year
    const makesData = await fetchJson(`https://api.nhtsa.gov/SafetyRatings/modelyear/${year}`);
    const makes = makesData?.Results || [];

    for (const make of makes) {
      const makeName = make.Make;
      const ourBrandName = Object.entries(brandMapping).find(([_, nhtsa]) => 
        nhtsa.toLowerCase() === makeName.toLowerCase()
      )?.[0];

      if (!ourBrandName) continue;

      // Get models for this make/year
      const modelsData = await fetchJson(`https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(makeName)}`);
      const nhtsaModels = modelsData?.Results || [];

      for (const nhtsaModel of nhtsaModels) {
        const modelName = nhtsaModel.Model;

        // Get ratings for this vehicle
        const ratingsUrl = `https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(makeName)}/model/${encodeURIComponent(modelName)}`;
        const ratingsData = await fetchJson(ratingsUrl);
        const vehicles = ratingsData?.Results || [];

        for (const vehicle of vehicles) {
          if (!vehicle.VehicleId) continue;

          // Get detailed ratings
          const detailData = await fetchJson(`https://api.nhtsa.gov/SafetyRatings/VehicleId/${vehicle.VehicleId}`);
          const detail = detailData?.Results?.[0];
          if (!detail) continue;

          // Find matching generation in our DB
          const ourBrand = brands.find(b => b.name === ourBrandName);
          if (!ourBrand) continue;

          const ourModel = models.find(m => 
            m.brand_id === ourBrand.id && 
            m.name.toLowerCase().includes(modelName.toLowerCase().split(' ')[0])
          );
          if (!ourModel) continue;

          const ourGen = generations.find(g => 
            g.model_id === ourModel.id &&
            (!g.year_start || g.year_start <= year) &&
            (!g.year_end || g.year_end >= year)
          );
          if (!ourGen) continue;

          // Insert safety data
          const specs = [
            { type: 'nhtsa_overall', value: detail.OverallRating },
            { type: 'nhtsa_frontal', value: detail.OverallFrontCrashRating },
            { type: 'nhtsa_side', value: detail.OverallSideCrashRating },
            { type: 'nhtsa_rollover', value: detail.RolloverRating },
          ].filter(s => s.value && s.value !== 'Not Rated');

          for (const spec of specs) {
            const { error } = await supabase.from('third_party_specs').upsert({
              generation_id: ourGen.id,
              source: 'NHTSA',
              spec_type: spec.type,
              spec_value: spec.value,
              spec_unit: 'stars',
            }, { onConflict: 'generation_id,source,spec_type' });
            
            if (!error) totalSpecs++;
          }

          totalMatched++;
          process.stdout.write(`  ${ourBrandName} ${modelName} ${year} → ${detail.OverallRating}★\r`);
        }

        await delay(50); // Rate limit
      }
    }
  }

  console.log(`\n\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ NHTSA Safety: ${totalMatched} vehicles, ${totalSpecs} specs`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
