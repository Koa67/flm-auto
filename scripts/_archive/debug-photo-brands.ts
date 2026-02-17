// Quick debug: compare photo brands vs DB brands
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function main() {
  const { data: brands } = await supabase.from('brands').select('name');
  const dbBrands = new Map((brands || []).map(b => [norm(b.name), b.name]));

  const photos = JSON.parse(fs.readFileSync('/Users/koa/Dev/flm-auto/data/photos-all-merged.json', 'utf-8'));
  const photoBrands = new Map<string, number>();
  for (const p of photos) {
    const b = p.brand || '?';
    photoBrands.set(b, (photoBrands.get(b) || 0) + 1);
  }

  console.log('BRAND MATCHING REPORT\n');
  console.log('Photo Brand'.padEnd(25), 'Norm'.padEnd(20), 'DB Match?');
  console.log('-'.repeat(70));

  let matchedPhotos = 0, unmatchedPhotos = 0;
  for (const [brand, count] of [...photoBrands.entries()].sort((a, b) => b[1] - a[1])) {
    const n = norm(brand);
    const dbMatch = dbBrands.get(n);
    const status = dbMatch ? `✅ → "${dbMatch}"` : '❌ NOT IN DB';
    console.log(brand.padEnd(25), n.padEnd(20), status, `(${count} photos)`);
    if (dbMatch) matchedPhotos += count; else unmatchedPhotos += count;
  }

  console.log(`\nPhotos with matching brand: ${matchedPhotos}/${photos.length}`);
  console.log(`Photos with NO brand match: ${unmatchedPhotos}/${photos.length}`);
}

main();
