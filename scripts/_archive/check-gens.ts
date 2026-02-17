import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);
(async () => {
  const { data } = await supabase.from('third_party_specs').select('generation_id').limit(100000);
  const uniqueGens = new Set(data?.map((d: any) => d.generation_id));
  console.log('Unique generation_ids with specs:', uniqueGens.size);

  const { data: gens } = await supabase.from('generations').select('id, name, model:models(name, brand:brands(name))').limit(2000);

  let withSpecs = 0;
  let without = 0;
  const missingByBrand: Record<string, string[]> = {};

  for (const g of gens || []) {
    if (uniqueGens.has(g.id)) {
      withSpecs++;
    } else {
      without++;
      const brand = (g.model as any)?.brand?.name || 'unknown';
      if (!missingByBrand[brand]) missingByBrand[brand] = [];
      missingByBrand[brand].push((g.model as any)?.name + ' | ' + g.name);
    }
  }

  console.log('With specs:', withSpecs);
  console.log('Without specs:', without);
  console.log('\nMissing by brand (first 5 each):');
  for (const [brand, models] of Object.entries(missingByBrand).sort()) {
    console.log(brand + ' (' + models.length + '):', models.slice(0, 5).join(', '));
  }
})();
