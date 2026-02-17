/**
 * AUTO-DATA.NET MEGA SCRAPER
 * 
 * Structure:
 * - Brand page: /en/{brand}-brand-{id} -> liste des modèles
 * - Model page: /en/{brand}-{model}-model-{id} -> liste des générations
 * - Generation page: /en/{brand}-{model}-{body}-generation-{id} -> liste des versions
 * - Version page: /en/{brand}-{model}-{body}-{version}-{id} -> TOUTES LES SPECS
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const BASE_URL = 'https://www.auto-data.net';

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    https.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
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

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Parse specs table from version page
function parseSpecsTable(html: string): Record<string, string> {
  const specs: Record<string, string> = {};
  
  // Find all table rows with specs
  const tableRegex = /<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)/g;
  let match;
  
  while ((match = tableRegex.exec(html)) !== null) {
    let key = match[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    let value = match[2].trim();
    if (key && value && !key.includes('log_in')) {
      specs[key] = value;
    }
  }
  
  // Also parse from the main specs table with | separators
  const specLineRegex = /\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
  while ((match = specLineRegex.exec(html)) !== null) {
    let key = match[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    let value = match[2].trim();
    if (key && value && key.length > 2 && !key.includes('---')) {
      specs[key] = value;
    }
  }
  
  return specs;
}

// Extract version links from generation page
function extractVersionLinks(html: string): string[] {
  const links: string[] = [];
  const linkRegex = /href="(\/en\/[^"]+-([\d]+))"/g;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    // Filter for version pages (contain hp in URL usually)
    if (url.includes('hp-') || url.match(/-\d+hp-/i)) {
      links.push(url);
    }
  }
  
  return [...new Set(links)];
}

// Extract model/generation links
function extractModelLinks(html: string, pattern: string): string[] {
  const links: string[] = [];
  const regex = new RegExp(`href="(/en/[^"]*${pattern}[^"]*)"`, 'g');
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    links.push(match[1]);
  }
  
  return [...new Set(links)];
}

// Match scraped data to our generations
async function findMatchingGeneration(brand: string, model: string, genName: string): Promise<string | null> {
  // Normalize names
  const normBrand = brand.toLowerCase().replace(/-/g, ' ');
  const normModel = model.toLowerCase().replace(/-/g, ' ');
  
  const { data } = await supabase
    .from('generations')
    .select('id, name, model:models!inner(name, brand:brands!inner(name))')
    .ilike('models.brands.name', `%${normBrand}%`)
    .ilike('models.name', `%${normModel}%`)
    .limit(10);
  
  if (!data || data.length === 0) return null;
  
  // Try to match generation name
  for (const gen of data) {
    const genNameLower = gen.name.toLowerCase();
    const searchName = genName.toLowerCase();
    if (genNameLower.includes(searchName) || searchName.includes(genNameLower)) {
      return gen.id;
    }
  }
  
  // Return first match if no exact match
  return data[0]?.id || null;
}

// Main scraper
async function scrapeAutoData() {
  console.log('🚗 AUTO-DATA.NET MEGA SCRAPER\n');
  console.log('═'.repeat(60));
  
  // Our priority brands
  const brandSlugs = [
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
    { slug: 'ford', id: 72 },
    { slug: 'peugeot', id: 49 },
    { slug: 'renault', id: 99 },
    { slug: 'opel', id: 19 },
  ];
  
  let totalSpecs = 0;
  let totalVersions = 0;
  
  for (const brand of brandSlugs) {
    console.log(`\n📦 ${brand.slug.toUpperCase()}`);
    
    try {
      // Get brand page
      const brandUrl = `/en/${brand.slug}-brand-${brand.id}`;
      const brandHtml = await fetchPage(brandUrl);
      
      // Extract model links
      const modelLinks = extractModelLinks(brandHtml, 'model-');
      console.log(`   Models found: ${modelLinks.length}`);
      
      // Process each model (limit to avoid rate limiting)
      for (const modelLink of modelLinks.slice(0, 10)) {
        await sleep(500);
        
        try {
          const modelHtml = await fetchPage(modelLink);
          
          // Extract generation links
          const genLinks = extractModelLinks(modelHtml, 'generation-');
          
          for (const genLink of genLinks.slice(0, 5)) {
            await sleep(500);
            
            try {
              const genHtml = await fetchPage(genLink);
              
              // Extract version links
              const versionLinks = extractVersionLinks(genHtml);
              
              // Process versions (limit to top 3 per generation)
              for (const versionLink of versionLinks.slice(0, 3)) {
                await sleep(300);
                
                try {
                  const versionHtml = await fetchPage(versionLink);
                  const specs = parseSpecsTable(versionHtml);
                  
                  if (Object.keys(specs).length > 10) {
                    totalVersions++;
                    totalSpecs += Object.keys(specs).length;
                    
                    // Extract model/gen info from URL
                    const urlParts = versionLink.split('/').pop()?.split('-') || [];
                    const modelName = urlParts.slice(1, 3).join(' ');
                    
                    // Find matching generation in our DB
                    const genId = await findMatchingGeneration(brand.slug, modelName, '');
                    
                    if (genId) {
                      // Insert specs
                      const specsToInsert = Object.entries(specs).map(([key, value]) => ({
                        generation_id: genId,
                        source: 'Auto-Data.net',
                        spec_type: `autodata_${key}`,
                        spec_value: parseFloat(value) || 0,
                        raw_data: { 
                          key, 
                          value, 
                          url: versionLink,
                          scraped_at: new Date().toISOString()
                        },
                      }));
                      
                      const { error } = await supabase
                        .from('third_party_specs')
                        .upsert(specsToInsert, { onConflict: 'generation_id,source,spec_type' });
                      
                      if (!error) {
                        process.stdout.write('.');
                      }
                    }
                  }
                } catch (e) {
                  // Skip failed versions
                }
              }
            } catch (e) {
              // Skip failed generations
            }
          }
        } catch (e) {
          // Skip failed models
        }
      }
    } catch (e) {
      console.log(`   ❌ Failed: ${e}`);
    }
  }
  
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🚗 AUTO-DATA.NET SCRAPE COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Versions scraped: ${totalVersions}`);
  console.log(`   Total spec fields: ${totalSpecs}`);
  console.log(`   Total specs in DB: ${count}`);
}

scrapeAutoData().catch(console.error);
