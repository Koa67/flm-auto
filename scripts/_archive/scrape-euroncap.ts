/**
 * EURO NCAP CRASH TEST SCRAPER
 * Source: euroncap.com - Données safety officielles
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import { normalizeModelName } from './model-aliases';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchPage(res.headers.location!).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeEuroNCAP() {
  console.log('🛡️  EURO NCAP CRASH TEST SCRAPER\n');
  console.log('═'.repeat(60));
  
  // Get our generations
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
    const brand = m.brand.name.toLowerCase().replace(/-/g, ' ');
    const model = m.name.toLowerCase();
    genLookup.set(`${brand}|${model}`, g.id);
  }
  
  // Euro NCAP ratings page
  const baseUrl = 'https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/';
  
  let matched = 0;
  let total = 0;
  
  try {
    const html = await fetchPage(baseUrl);
    
    // Extract car entries - pattern: brand, model, year, stars
    const carRegex = /<div[^>]*class="[^"]*rating[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?(\d+)\s*Stars?/gi;
    const brandModelRegex = /([A-Za-z-]+)\s+(.+)/;
    
    // Alternative: look for rating cards
    const cardRegex = /data-brand="([^"]+)"[^>]*data-model="([^"]+)"[^>]*data-stars="(\d+)"/gi;
    let match;
    
    while ((match = cardRegex.exec(html)) !== null) {
      const [, brand, model, stars] = match;
      total++;
      
      const brandNorm = brand.toLowerCase().replace(/-/g, ' ');
      const modelNorm = normalizeModelName(brand, model).toLowerCase();
      
      // Try to match
      let genId: string | undefined;
      const directKey = `${brandNorm}|${modelNorm}`;
      
      if (genLookup.has(directKey)) {
        genId = genLookup.get(directKey);
      } else {
        for (const [key, id] of genLookup) {
          if (key.startsWith(brandNorm)) {
            const dbModel = key.split('|')[1];
            if (modelNorm.includes(dbModel) || dbModel.includes(modelNorm)) {
              genId = id;
              break;
            }
          }
        }
      }
      
      if (genId) {
        matched++;
        
        await supabase.from('third_party_specs').upsert({
          generation_id: genId,
          source: 'EuroNCAP',
          spec_type: 'ncap_stars',
          spec_value: parseInt(stars),
          raw_data: { brand, model, stars, url: baseUrl }
        }, { onConflict: 'generation_id,source,spec_type' });
        
        process.stdout.write('★');
      }
    }
    
    // Try scraping individual brand pages
    const brands = ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Volvo', 'Toyota', 'Tesla', 'Hyundai', 'Kia'];
    
    for (const brand of brands) {
      await sleep(500);
      const brandSlug = brand.toLowerCase().replace(/\s+/g, '-');
      
      try {
        const brandUrl = `https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/?selectedMake=${encodeURIComponent(brand)}`;
        const brandHtml = await fetchPage(brandUrl);
        
        // Extract star ratings
        const ratingRegex = /class="[^"]*stars[^"]*"[^>]*>(\d+)/gi;
        const modelRegex = /<h\d[^>]*class="[^"]*model[^"]*"[^>]*>([^<]+)/gi;
        
        let starMatch;
        while ((starMatch = ratingRegex.exec(brandHtml)) !== null) {
          total++;
        }
        
        console.log(`\n   ${brand}: scanned`);
      } catch (e) {
        // Skip
      }
    }
    
  } catch (e) {
    console.log('Error fetching Euro NCAP:', e);
  }
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🛡️  EURO NCAP COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Cars found: ${total}`);
  console.log(`   Matched: ${matched}`);
}

scrapeEuroNCAP().catch(console.error);
