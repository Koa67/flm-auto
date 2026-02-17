/**
 * ULTIMATESPECS.COM MEGA SCRAPER
 * 
 * Structure: /car-specs/{Brand}/{ID}/{Model}.html
 * ~40 specs par véhicule, HTML propre avec tables th/td
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
    const fullUrl = url.startsWith('http') ? url : `https://www.ultimatespecs.com${url}`;
    https.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
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

// Parse specs from UltimateSpecs HTML (th/td tables)
function parseSpecs(html: string): Record<string, string> {
  const specs: Record<string, string> = {};
  
  // Pattern: <th>Key :</th><td>Value</td> or just <th>Key</th><td>Value</td>
  const regex = /<tr[^>]*>\s*<t[hd][^>]*>([^<]+?)(?:\s*:)?\s*<\/t[hd]>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    let key = match[1].trim().replace(/\s+/g, ' ').replace(/:$/, '');
    let value = match[2]
      .replace(/<span[^>]*class="val2"[^>]*>[\s\S]*?<\/span>/gi, '') // Remove secondary values
      .replace(/<[^>]+>/g, ' ')  // Remove HTML tags
      .replace(/\s+/g, ' ')       // Collapse whitespace
      .trim();
    
    if (key && value && key.length < 80 && value.length < 500) {
      const normKey = key.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      
      if (normKey.length > 2) {
        specs[normKey] = value;
      }
    }
  }
  
  return specs;
}

// Extract version links from generation page
function extractVersionLinks(html: string): string[] {
  const links: string[] = [];
  const regex = /href="(\/car-specs\/[^"]+\.html)"/g;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    if (!match[1].includes('-models')) {
      links.push(match[1]);
    }
  }
  
  return [...new Set(links)];
}

async function scrapeUltimateSpecs() {
  console.log('🏎️  ULTIMATESPECS MEGA SCRAPER\n');
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
  
  // Build lookup: model → array of {genId, genName}
  const genLookup = new Map<string, {id: string, name: string}[]>();
  for (const g of ourGens) {
    const m = g.model as any;
    if (!m?.brand) continue;
    const brand = m.brand.name.toLowerCase().replace(/-/g, ' ');
    const model = m.name.toLowerCase().replace(/-/g, ' ');
    const key = `${brand}|${model}`;
    if (!genLookup.has(key)) genLookup.set(key, []);
    genLookup.get(key)!.push({ id: g.id, name: g.name.toLowerCase() });
  }
  
  // Priority brands
  const brands = [
    'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche',
    'Toyota', 'Honda', 'Mazda', 'Nissan', 'Hyundai', 'Kia',
    'Volvo', 'Ford', 'Peugeot', 'Renault', 'Skoda', 'Opel',
    'Tesla', 'Lexus', 'Jaguar', 'Land-Rover', 'Mini', 'Fiat'
  ];
  
  let totalVersions = 0;
  let totalSpecs = 0;
  let matchedGens = new Set<string>();
  
  for (const brand of brands) {
    console.log(`\n📦 ${brand.toUpperCase()}`);
    
    try {
      // Get brand page with all models
      const brandHtml = await fetchPage(`/car-specs/${brand}-models`);
      await sleep(500);
      
      // Extract model links
      const modelRegex = /href="(\/car-specs\/[^"]+\/M\d+\/[^"]+)"/g;
      const modelLinks: string[] = [];
      let m;
      while ((m = modelRegex.exec(brandHtml)) !== null) {
        modelLinks.push(m[1]);
      }
      
      console.log(`   Models: ${modelLinks.length}`);
      
      // Process top 15 models
      for (const modelLink of modelLinks.slice(0, 15)) {
        await sleep(300);
        
        try {
          const modelHtml = await fetchPage(modelLink);
          
          // Extract version links
          const versionLinks = extractVersionLinks(modelHtml);
          
          // Extract model name from URL
          const modelName = modelLink.split('/').pop()?.replace(/-/g, ' ') || '';
          
          // Process top 10 versions per model
          for (const versionLink of versionLinks.slice(0, 10)) {
            await sleep(200);
            
            try {
              const versionHtml = await fetchPage(versionLink);
              const specs = parseSpecs(versionHtml);
              
              if (Object.keys(specs).length > 15) {
                totalVersions++;
                totalSpecs += Object.keys(specs).length;
                
                // Match to our generation using aliases
                const brandNorm = brand.toLowerCase().replace(/-/g, ' ');
                const normalizedModel = normalizeModelName(brand, modelName).toLowerCase();
                
                // Extract version slug for chassis code matching
                const versionSlug = versionLink.split('/').pop()?.replace(/\.html$/, '').replace(/-/g, ' ').toLowerCase() || '';
                // Also use modelName slug for matching
                const modelSlug = modelLink.split('/').pop()?.replace(/-/g, ' ').toLowerCase() || '';
                const combinedSlug = modelSlug + ' ' + versionSlug;
                
                // Find all generations for this model
                const directKey = `${brandNorm}|${normalizedModel}`;
                let candidates = genLookup.get(directKey);
                
                // Fallback: fuzzy model match
                if (!candidates) {
                  for (const [key, gens] of genLookup) {
                    if (key.startsWith(brandNorm + '|')) {
                      const modelPart = key.split('|')[1];
                      if (normalizedModel.includes(modelPart) || modelPart.includes(normalizedModel)) {
                        candidates = gens;
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
                    const slugTokens = combinedSlug.split(/\s+/);
                    // Exact token match on chassis code
                    const exactToken = candidates.find(c =>
                      c.name !== 'default' && slugTokens.includes(c.name)
                    );
                    if (exactToken) {
                      genId = exactToken.id;
                    } else {
                      const substr = candidates.find(c =>
                        c.name !== 'default' && combinedSlug.includes(c.name)
                      );
                      genId = substr?.id || candidates.find(c => c.name !== 'default')?.id || candidates[0].id;
                    }
                  }
                }
                
                if (genId) {
                  matchedGens.add(genId);
                  
                  const specsToInsert = Object.entries(specs).map(([key, value]) => ({
                    generation_id: genId,
                    source: 'UltimateSpecs',
                    spec_type: `us_${key}`,
                    spec_value: parseFloat(value.replace(/[^\d.-]/g, '')) || 0,
                    raw_data: { value, url: versionLink },
                  }));
                  
                  await supabase.from('third_party_specs').upsert(specsToInsert, {
                    onConflict: 'generation_id,source,spec_type'
                  });
                  
                  process.stdout.write('.');
                }
              }
            } catch (e) { /* skip */ }
          }
        } catch (e) { /* skip */ }
      }
    } catch (e) {
      console.log(`   ❌ Error`);
    }
  }
  
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🏎️  ULTIMATESPECS COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Versions scraped: ${totalVersions}`);
  console.log(`   Specs extracted: ${totalSpecs}`);
  console.log(`   Generations matched: ${matchedGens.size}`);
  console.log(`   Total specs in DB: ${count}`);
}

scrapeUltimateSpecs().catch(console.error);
