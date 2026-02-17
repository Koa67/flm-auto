require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function paginateAll(table: string, select: string) {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function main() {
  const gens = await paginateAll('generations', 'id, name, slug, model:models(name, brand:brands(name))');
  console.log('Total gens:', gens.length);

  const imgs = await paginateAll('vehicle_images', 'generation_id');
  const gensWithPhotos = new Set(imgs.map((r: any) => r.generation_id));
  console.log('Gens with photos:', gensWithPhotos.size);
  console.log('Gens WITHOUT photos:', gens.length - gensWithPhotos.size);

  const missing = gens.filter((g: any) => !gensWithPhotos.has(g.id));
  const brands: Record<string, number> = {};
  for (const g of missing) {
    const b = (g.model as any)?.brand?.name || 'unknown';
    brands[b] = (brands[b] || 0) + 1;
  }
  const sorted = Object.entries(brands).sort((a, b) => (b[1] as number) - (a[1] as number));
  console.log('\nMissing by brand:');
  sorted.forEach(([b, c]) => console.log('  ' + b + ': ' + c));

  console.log('\nSample missing gens (first 20):');
  for (const g of missing.slice(0, 20)) {
    const m = g.model as any;
    console.log('  ' + (m?.brand?.name || '?') + ' ' + (m?.name || '?') + ' ' + g.name);
  }
}

main().catch(console.error);
