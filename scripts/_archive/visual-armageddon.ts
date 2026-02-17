/**
 * VISUAL ARMAGEDDON 🎨
 * 
 * Sources pour visuels techniques:
 * 1. Wikimedia Commons - Blueprints, technical drawings, cutaways
 * 2. Pexels - Photos supplémentaires (interior, engine, details)
 * 3. Unsplash - High-res lifestyle shots
 * 4. Wikipedia SVG diagrams
 * 5. Patent drawings (Google Patents - public domain after 20 years)
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || 'H2AOu3UIjVVx2ASLCSV80nk1AgMMHA8jVp6o3bmGNiw9UmGf1vQbPokM';

function fetchJSON(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { 
      headers: { 'User-Agent': 'FLM-Auto-Bot/1.0', ...headers }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { 
      headers: { 'User-Agent': 'FLM-Auto-Bot/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.setTimeout(15000, () => { req.destroy(); resolve(''); });
  });
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================================
// WIKIMEDIA TECHNICAL DRAWINGS & BLUEPRINTS
// ============================================================
async function searchWikimediaTechnical(query: string, category: string): Promise<any[]> {
  // Search specifically for technical content
  const searchTerms = [
    `${query} blueprint`,
    `${query} technical drawing`,
    `${query} cutaway`,
    `${query} diagram`,
    `${query} schematic`,
    `${query} cross section`,
    `${query} engine`,
    `${query} interior`,
    `${query} dashboard`,
  ];
  
  const results: any[] = [];
  
  for (const term of searchTerms.slice(0, 3)) { // Limit to avoid rate limits
    const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srnamespace=6&srlimit=3&format=json`;
    
    try {
      const data = await fetchJSON(url);
      const items = data?.query?.search || [];
      
      for (const item of items) {
        const title = item.title;
        if (!title.match(/\.(jpg|jpeg|png|svg)$/i)) continue;
        
        // Get image details
        const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|extmetadata&format=json`;
        const infoData = await fetchJSON(infoUrl);
        
        const pages = infoData?.query?.pages || {};
        const page = Object.values(pages)[0] as any;
        const imageInfo = page?.imageinfo?.[0];
        
        if (imageInfo?.url) {
          results.push({
            url: imageInfo.url,
            thumbnail_url: imageInfo.thumburl || imageInfo.url,
            width: imageInfo.width,
            height: imageInfo.height,
            type: category,
            source: 'Wikimedia Commons',
            license: imageInfo.extmetadata?.LicenseShortName?.value || 'Unknown',
            title: title.replace('File:', ''),
          });
        }
      }
      
      await sleep(200);
    } catch (e) {
      // Continue on error
    }
  }
  
  return results;
}

// ============================================================
// PEXELS DETAILED SHOTS
// ============================================================
async function searchPexelsDetailed(brand: string, model: string): Promise<any[]> {
  const queries = [
    `${brand} ${model} interior`,
    `${brand} ${model} engine`,
    `${brand} ${model} dashboard`,
    `${brand} car interior`,
    `car engine detail`,
  ];
  
  const results: any[] = [];
  
  for (const query of queries.slice(0, 2)) {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3`;
    
    try {
      const data = await fetchJSON(url, { 'Authorization': PEXELS_API_KEY });
      
      for (const photo of (data?.photos || [])) {
        results.push({
          url: photo.src.original,
          thumbnail_url: photo.src.medium,
          width: photo.width,
          height: photo.height,
          type: query.includes('interior') ? 'interior' : (query.includes('engine') ? 'engine' : 'detail'),
          source: 'Pexels',
          photographer: photo.photographer,
        });
      }
      
      await sleep(200);
    } catch (e) {
      // Continue
    }
  }
  
  return results;
}

// ============================================================
// GENERIC TECHNICAL ILLUSTRATIONS BY SEGMENT
// ============================================================
function getGenericTechnicalIllustrations(segment: string, bodyType: string): any[] {
  // URLs to common technical diagrams (public domain / CC)
  const genericDiagrams: Record<string, any[]> = {
    'sedan': [
      { type: 'chassis_diagram', description: 'Monocoque chassis layout' },
      { type: 'suspension_diagram', description: 'MacPherson strut front / Multi-link rear' },
      { type: 'drivetrain_diagram', description: 'Front-engine RWD/AWD layout' },
    ],
    'suv': [
      { type: 'chassis_diagram', description: 'Body-on-frame or Unibody construction' },
      { type: 'suspension_diagram', description: 'Independent front / Multi-link rear with lift' },
      { type: 'drivetrain_diagram', description: 'AWD system with transfer case' },
    ],
    'electric': [
      { type: 'battery_layout', description: 'Skateboard platform with floor-mounted battery' },
      { type: 'motor_diagram', description: 'Permanent magnet synchronous motor' },
      { type: 'charging_diagram', description: 'CCS2 / Type 2 charging system' },
    ],
    'sports': [
      { type: 'chassis_diagram', description: 'Lightweight aluminum/carbon chassis' },
      { type: 'suspension_diagram', description: 'Double wishbone / Multi-link sport' },
      { type: 'aero_diagram', description: 'Active aerodynamics system' },
    ],
  };
  
  return genericDiagrams[segment] || genericDiagrams['sedan'];
}

// ============================================================
// MAIN VISUAL HUNTER
// ============================================================
async function visualArmageddon() {
  console.log('🎨 VISUAL ARMAGEDDON - EVERY IMAGE POSSIBLE\n');
  console.log('═'.repeat(60));
  
  // Get all generations
  let allGens: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('generations')
      .select('id, name, model:models(name, brand:brands(name))')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allGens = [...allGens, ...data];
    if (data.length < 1000) break;
    page++;
  }
  
  console.log(`📊 ${allGens.length} generations to process\n`);
  
  // Priority brands first
  const priorityBrands = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Tesla', 'Volkswagen', 'Toyota', 'Hyundai', 'Volvo', 'Kia'];
  
  const sortedGens = allGens.sort((a, b) => {
    const brandA = (a.model as any)?.brand?.name || '';
    const brandB = (b.model as any)?.brand?.name || '';
    const idxA = priorityBrands.indexOf(brandA);
    const idxB = priorityBrands.indexOf(brandB);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });
  
  let processed = 0;
  let totalImages = 0;
  const specsToInsert: any[] = [];
  
  for (const gen of sortedGens) {
    const model = gen.model as any;
    if (!model?.brand) continue;
    
    const brand = model.brand.name;
    const modelName = model.name;
    const query = `${brand} ${modelName}`;
    
    // Determine segment
    const nameLower = modelName.toLowerCase();
    let segment = 'sedan';
    if (nameLower.includes('model') || nameLower.includes('ioniq') || nameLower.includes('id.') || nameLower.includes('taycan') || nameLower.includes('eq')) {
      segment = 'electric';
    } else if (nameLower.includes('x') || nameLower.includes('gl') || nameLower.includes('q') || nameLower.includes('cayenne') || nameLower.includes('macan')) {
      segment = 'suv';
    } else if (nameLower.includes('911') || nameLower.includes('m3') || nameLower.includes('m4') || nameLower.includes('amg') || nameLower.includes('rs')) {
      segment = 'sports';
    }
    
    // Collect all visuals
    const allVisuals: any[] = [];
    
    // 1. Wikimedia technical drawings
    const wikiTech = await searchWikimediaTechnical(query, 'technical');
    allVisuals.push(...wikiTech);
    
    // 2. Pexels detailed shots (interior, engine)
    const pexelsDetail = await searchPexelsDetailed(brand, modelName);
    allVisuals.push(...pexelsDetail);
    
    // 3. Generic technical diagrams
    const genericDiagrams = getGenericTechnicalIllustrations(segment, 'sedan');
    allVisuals.push(...genericDiagrams.map(d => ({
      type: d.type,
      description: d.description,
      source: 'Technical Reference',
      generic: true,
    })));
    
    if (allVisuals.length > 0) {
      specsToInsert.push({
        generation_id: gen.id,
        source: 'Visual Database',
        spec_type: 'technical_visuals',
        spec_value: allVisuals.length,
        raw_data: {
          total_visuals: allVisuals.length,
          visuals: allVisuals,
          categories: {
            photos: allVisuals.filter(v => v.source === 'Pexels').length,
            technical: allVisuals.filter(v => v.source === 'Wikimedia Commons').length,
            diagrams: allVisuals.filter(v => v.generic).length,
          },
        },
      });
      
      totalImages += allVisuals.length;
    }
    
    processed++;
    const pct = ((processed / sortedGens.length) * 100).toFixed(1);
    process.stdout.write(`\r   [${pct}%] ${processed}/${sortedGens.length} | Images: ${totalImages} | Current: ${brand} ${modelName}        `);
    
    // Batch insert every 50
    if (specsToInsert.length >= 50) {
      const batch = specsToInsert.splice(0, 50);
      await supabase.from('third_party_specs').upsert(batch, { onConflict: 'generation_id,source,spec_type' });
    }
    
    // Rate limiting
    await sleep(300);
  }
  
  // Final batch
  if (specsToInsert.length > 0) {
    await supabase.from('third_party_specs').upsert(specsToInsert, { onConflict: 'generation_id,source,spec_type' });
  }
  
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🎨 VISUAL ARMAGEDDON COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Generations processed: ${processed}`);
  console.log(`   Total images found: ${totalImages}`);
  console.log(`   Total third_party_specs: ${count}`);
}

visualArmageddon().catch(console.error);
