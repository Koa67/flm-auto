/**
 * AUTO-DATA.NET SCRAPER v2 - Fixed regex
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
    const fullUrl = url.startsWith('http') ? url : `https://www.auto-data.net${url}`;
    https.get(fullUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// FIXED: Parse <tr><th>key</th><td>value</td></tr>
function parseSpecs(html: string): Record<string, string> {
  const specs: Record<string, string> = {};
  
  // Match <tr><th>Key</th><td>Value</td></tr>
  const regex = /<tr[^>]*>\s*<th[^>]*>([^<]+)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    let key = match[1].trim().replace(/\s+/g, ' ');
    let value = match[2]
      .replace(/<[^>]+>/g, ' ')  // Remove HTML tags
      .replace(/\s+/g, ' ')       // Collapse whitespace
      .trim();
    
    if (key && value && key.length < 60 && !key.includes('Log in')) {
      // Normalize key
      const normKey = key.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      
      specs[normKey] = value;
    }
  }
  
  return specs;
}

async function scrape() {
  console.log('🚗 AUTO-DATA.NET SCRAPER v2\n');
  console.log('═'.repeat(60));
  
  const brands = [
    { slug: 'bmw', id: 86 },
    { slug: 'mercedes-benz', id: 138 },
    { slug: 'audi', id: 41 },
    { slug: 'volkswagen', id: 80 },
    { slug: 'porsche', id: 64 },
    { slug: 'toyota', id: 40 },
    { slug: 'hyundai', id: 147 },
    { slug: 'kia', id: 23 },
    { slug: 'volvo', id: 85 },
    { slug: 'skoda', id: 154 },
    { slug: 'tesla', id: 197 },
    { slug: 'honda', id: 127 },
    { slug: 'mazda', id: 118 },
    { slug: 'nissan', id: 4 },
    { slug: 'peugeot', id: 49 },
    { slug: 'renault', id: 99 },
  ];
  
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
  
  // Build lookup map: model → array of {genId, genName}
  const genLookup = new Map<string, {id: string, name: string}[]>();
  for (const g of ourGens) {
    const m = g.model as any;
    if (!m?.brand) continue;
    const brand = m.brand.name.toLowerCase();
    const model = m.name.toLowerCase();
    const key = `${brand}|${model}`;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push({ id: g.id, name: g.name.toLowerCase() });
  }
  
  let totalVersions = 0;
  let totalSpecs = 0;
  let matchedGens = new Set<string>();
  let missCount = 0;
  
  for (const brand of brands) {
    console.log(`\n📦 ${brand.slug.toUpperCase()}`);
    
    try {
      // Get brand page
      const brandHtml = await fetchPage(`/en/${brand.slug}-brand-${brand.id}`);
      
      // Extract model links
      const modelRegex = new RegExp(`href="(/en/${brand.slug}-[^"]*-model-\\d+)"`, 'g');
      const models = [...new Set([...brandHtml.matchAll(modelRegex)].map(m => m[1]))];
      console.log(`   Models: ${models.length}`);
      
      // Process top 15 models per brand
      for (const modelUrl of models.slice(0, 15)) {
        await sleep(300);
        
        const modelHtml = await fetchPage(modelUrl);
        
        // Extract model name from URL
        const modelName = modelUrl.split('/').pop()?.replace(/-model-\d+$/, '').replace(/-/g, ' ') || '';
        
        // Extract generation links
        const genRegex = /href="(\/en\/[^"]*-generation-\d+)"/g;
        const gens = [...new Set([...modelHtml.matchAll(genRegex)].map(m => m[1]))];
        
        // Process top 5 generations per model
        for (const genUrl of gens.slice(0, 5)) {
          await sleep(300);
          
          const genHtml = await fetchPage(genUrl);
          
          // Extract version links (end with number, not generation/model)
          const versionRegex = new RegExp(`href="(/en/${brand.slug}-[^"]*-\\d+)"`, 'g');
          const versions = [...new Set([...genHtml.matchAll(versionRegex)]
            .map(m => m[1])
            .filter(v => !v.includes('generation') && !v.includes('model')))];
          
          // Process top 5 versions per generation
          for (const versionUrl of versions.slice(0, 5)) {
            await sleep(200);
            
            try {
              const versionHtml = await fetchPage(versionUrl);
              const specs = parseSpecs(versionHtml);
              
              if (Object.keys(specs).length > 20) {
                totalVersions++;
                totalSpecs += Object.keys(specs).length;
                
                // Try to match to our generation
                const brandName = brand.slug.replace(/-/g, ' ');
                const brandKey = brand.slug === 'mercedes-benz' ? 'Mercedes-Benz' : brand.slug.charAt(0).toUpperCase() + brand.slug.slice(1);
                const normalizedModel = normalizeModelName(brandKey, modelName).toLowerCase();
                
                // Extract gen slug from URL for chassis code matching
                const genSlug = genUrl.split('/').pop()?.replace(/-generation-\d+$/, '').replace(/-/g, ' ').toLowerCase() || '';
                
                // Find all generations for this model
                let lookupKey = `${brandName}|${normalizedModel}`;
                let candidates = genLookup.get(lookupKey);
                
                // Fallback: fuzzy model match
                if (!candidates) {
                  for (const [key, gens] of genLookup) {
                    if (key.startsWith(brandName + '|')) {
                      const modelPart = key.split('|')[1];
                      if (normalizedModel.includes(modelPart) || modelPart.includes(normalizedModel)) {
                        candidates = gens;
                        lookupKey = key;
                        break;
                      }
                    }
                  }
                }
                
                let genId: string | undefined;
                if (candidates) {
                  if (candidates.length === 1) {
                    genId = candidates[0].id;
                  } else {
                    // Extract chassis code tokens from genSlug (e.g. f70, g20, w206)
                    const slugTokens = genSlug.split(/\s+/);
                    
                    // Match: find candidate whose name appears as exact token in slug
                    const exactToken = candidates.find(c =>
                      c.name !== 'default' && slugTokens.includes(c.name)
                    );
                    if (exactToken) {
                      genId = exactToken.id;
                    } else {
                      // Substring match (skip 'default')
                      const substr = candidates.find(c =>
                        c.name !== 'default' && genSlug.includes(c.name)
                      );
                      genId = substr?.id || candidates.find(c => c.name !== 'default')?.id || candidates[0].id;
                    }
                  }
                }
                
                if (!genId && !candidates) {
                  process.stdout.write('X');
                  // Log first 20 misses
                  if (matchedGens.size + missCount < 20) {
                    console.log(`\n  MISS: brand="${brandName}" model="${modelName}" norm="${normalizedModel}" key="${lookupKey}"`);
                  }
                  missCount++;
                }
                if (genId) {
                  matchedGens.add(genId);
                  
                  // Prepare specs for insert
                  const specsToInsert = Object.entries(specs).map(([key, value]) => ({
                    generation_id: genId,
                    source: 'Auto-Data.net',
                    spec_type: key,
                    spec_value: parseFloat(value.replace(/[^\d.-]/g, '')) || 0,
                    raw_data: { value, url: versionUrl },
                  }));
                  
                  await supabase.from('third_party_specs').upsert(specsToInsert, {
                    onConflict: 'generation_id,source,spec_type'
                  });
                  
                  process.stdout.write('.');
                }
              }
            } catch (e) { /* skip */ }
          }
        }
      }
    } catch (e) {
      console.log(`   ❌ Error`);
    }
  }
  
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🚗 SCRAPE COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Versions scraped: ${totalVersions}`);
  console.log(`   Specs extracted: ${totalSpecs}`);
  console.log(`   Generations matched: ${matchedGens.size}
   Misses (no candidates): ${missCount}`);
  console.log(`   Total specs in DB: ${count}`);
}

scrape().catch(console.error);
