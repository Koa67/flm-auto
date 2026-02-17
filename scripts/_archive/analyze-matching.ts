import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function analyzeMatching() {
  // Get our generations
  let gens: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .range(page * 500, (page + 1) * 500 - 1);
    if (!data || data.length === 0) break;
    gens.push(...data);
    if (data.length < 500) break;
    page++;
  }
  
  console.log('📊 MATCHING ANALYSIS\n');
  console.log('Sample of our generations:');
  
  gens.slice(0, 20).forEach(g => {
    const m = g.model as any;
    if (m?.brand) {
      console.log(`  ${m.brand.name} | ${m.name} | ${g.name}`);
    }
  });
  
  // Count by brand
  const byBrand: Record<string, number> = {};
  gens.forEach(g => {
    const m = g.model as any;
    if (m?.brand) {
      byBrand[m.brand.name] = (byBrand[m.brand.name] || 0) + 1;
    }
  });
  
  console.log('\n\nGenerations by brand:');
  Object.entries(byBrand).sort((a, b) => b[1] - a[1]).forEach(([brand, count]) => {
    console.log(`  ${brand}: ${count}`);
  });
}

analyzeMatching();
