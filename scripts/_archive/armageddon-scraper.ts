/**
 * ARMAGEDDON SCRAPER - Everything we can legally scrape
 * 
 * Sources:
 * 1. Euro NCAP API (crash tests)
 * 2. EV-Database.org (EV specs)
 * 3. Car.info (free API for basic specs)
 * 4. Autovista (residual values - public data)
 * 5. Government recall databases (NHTSA, EU RAPEX)
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

function fetch(url: string, options: any = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    const req = protocol.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; FLM-Auto-Research-Bot/1.0)',
        ...options.headers 
      }
    }, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================================
// NHTSA RECALLS (US Government - Public Domain)
// ============================================================
async function scrapeNHTSARecalls() {
  console.log('\n🚨 NHTSA RECALLS (US Government Data)...\n');
  
  const brands = ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Tesla', 'Toyota', 'Honda', 'Hyundai', 'Kia', 'Volvo', 'Ford', 'Nissan', 'Mazda'];
  const allRecalls: any[] = [];
  
  for (const brand of brands) {
    try {
      // NHTSA API is public
      const url = `https://api.nhtsa.gov/recalls/recallsByManufacturer?manufacturer=${encodeURIComponent(brand)}&sort=desc`;
      const data = await fetch(url);
      const json = JSON.parse(data);
      
      if (json.results && json.results.length > 0) {
        // Take last 5 years of recalls
        const recent = json.results.filter((r: any) => {
          const year = parseInt(r.ReportReceivedDate?.substring(0, 4) || '0');
          return year >= 2020;
        }).slice(0, 50);
        
        allRecalls.push({
          brand,
          total_recalls: json.results.length,
          recent_count: recent.length,
          recalls: recent.map((r: any) => ({
            campaign: r.NHTSACampaignNumber,
            date: r.ReportReceivedDate,
            component: r.Component,
            summary: r.Summary?.substring(0, 500),
            consequence: r.Consequence?.substring(0, 300),
            remedy: r.Remedy?.substring(0, 300),
            affected: r.PotentialNumberofUnitsAffected,
          })),
        });
        
        console.log(`   ✅ ${brand}: ${recent.length} recent recalls`);
      }
    } catch (e) {
      console.log(`   ⚠️ ${brand}: Failed`);
    }
    
    await sleep(500);
  }
  
  return allRecalls;
}

// ============================================================
// FUEL ECONOMY (US EPA - Public Domain)
// ============================================================
async function scrapeFuelEconomy() {
  console.log('\n⛽ EPA FUEL ECONOMY DATA...\n');
  
  // EPA provides CSV downloads, but also has an API
  const years = [2024, 2025];
  const allFuel: any[] = [];
  
  for (const year of years) {
    try {
      const url = `https://www.fueleconomy.gov/feg/ws/wbs?year=${year}&make=&model=&format=json`;
      const data = await fetch(url);
      
      // This endpoint returns a list of makes
      // We'd need to iterate through each make/model
      // For now, just log that it's accessible
      console.log(`   ✅ EPA ${year} data accessible`);
    } catch (e) {
      console.log(`   ⚠️ EPA ${year}: Failed`);
    }
  }
  
  return allFuel;
}

// ============================================================
// WIKIPEDIA INFOBOXES (Real specs from Wikipedia)
// ============================================================
async function scrapeWikipediaSpecs() {
  console.log('\n📖 WIKIPEDIA INFOBOXES...\n');
  
  const vehicles = [
    { brand: 'BMW', model: 'M3', wiki: 'BMW_M3' },
    { brand: 'BMW', model: 'M5', wiki: 'BMW_M5' },
    { brand: 'BMW', model: 'iX', wiki: 'BMW_iX' },
    { brand: 'BMW', model: 'i4', wiki: 'BMW_i4' },
    { brand: 'Porsche', model: '911', wiki: 'Porsche_911' },
    { brand: 'Porsche', model: 'Taycan', wiki: 'Porsche_Taycan' },
    { brand: 'Porsche', model: 'Cayenne', wiki: 'Porsche_Cayenne' },
    { brand: 'Tesla', model: 'Model 3', wiki: 'Tesla_Model_3' },
    { brand: 'Tesla', model: 'Model Y', wiki: 'Tesla_Model_Y' },
    { brand: 'Tesla', model: 'Model S', wiki: 'Tesla_Model_S' },
    { brand: 'Audi', model: 'e-tron GT', wiki: 'Audi_e-tron_GT' },
    { brand: 'Audi', model: 'RS6', wiki: 'Audi_RS_6' },
    { brand: 'Mercedes-Benz', model: 'EQS', wiki: 'Mercedes-Benz_EQS' },
    { brand: 'Mercedes-Benz', model: 'AMG GT', wiki: 'Mercedes-AMG_GT' },
    { brand: 'Volkswagen', model: 'ID.4', wiki: 'Volkswagen_ID.4' },
    { brand: 'Volkswagen', model: 'Golf R', wiki: 'Volkswagen_Golf_R' },
    { brand: 'Hyundai', model: 'Ioniq 5', wiki: 'Hyundai_Ioniq_5' },
    { brand: 'Hyundai', model: 'Ioniq 6', wiki: 'Hyundai_Ioniq_6' },
    { brand: 'Kia', model: 'EV6', wiki: 'Kia_EV6' },
    { brand: 'Volvo', model: 'EX30', wiki: 'Volvo_EX30' },
  ];
  
  const wikiSpecs: any[] = [];
  
  for (const v of vehicles) {
    try {
      // Use Wikipedia API to get parsed infobox
      const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${v.wiki}&prop=text&format=json&origin=*`;
      const data = await fetch(url);
      const json = JSON.parse(data);
      
      if (json.parse?.text) {
        const html = json.parse.text['*'];
        
        // Extract key specs from infobox
        const specs: any = {
          brand: v.brand,
          model: v.model,
          wiki_page: v.wiki,
        };
        
        // Production years
        const prodMatch = html.match(/Production<\/th>.*?<td[^>]*>([\s\S]*?)<\/td>/i);
        if (prodMatch) specs.production = prodMatch[1].replace(/<[^>]+>/g, '').trim();
        
        // Engine
        const engineMatch = html.match(/Engine<\/th>.*?<td[^>]*>([\s\S]*?)<\/td>/i);
        if (engineMatch) specs.engine = engineMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
        
        // Transmission
        const transMatch = html.match(/Transmission<\/th>.*?<td[^>]*>([\s\S]*?)<\/td>/i);
        if (transMatch) specs.transmission = transMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 300);
        
        // Dimensions
        const dimMatch = html.match(/Wheelbase<\/th>.*?<td[^>]*>([\s\S]*?)<\/td>/i);
        if (dimMatch) specs.wheelbase = dimMatch[1].replace(/<[^>]+>/g, '').trim();
        
        // Curb weight
        const weightMatch = html.match(/(Curb weight|Kerb weight)<\/th>.*?<td[^>]*>([\s\S]*?)<\/td>/i);
        if (weightMatch) specs.curb_weight = weightMatch[2].replace(/<[^>]+>/g, '').trim();
        
        wikiSpecs.push(specs);
        console.log(`   ✅ ${v.brand} ${v.model}`);
      }
    } catch (e) {
      console.log(`   ⚠️ ${v.brand} ${v.model}: Failed`);
    }
    
    await sleep(300);
  }
  
  return wikiSpecs;
}

// ============================================================
// MAIN
// ============================================================
async function armageddon() {
  console.log('💀 ARMAGEDDON SCRAPER\n');
  console.log('═'.repeat(60));
  console.log('   Extracting every last byte of public automotive data...\n');
  
  // Get all generations for matching
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
  console.log(`📊 ${allGens.length} generations in DB\n`);
  
  // Build lookup
  const genByBrandModel = new Map<string, any>();
  for (const gen of allGens) {
    const m = gen.model as any;
    if (!m?.brand) continue;
    const key = `${m.brand.name.toLowerCase()}|${m.name.toLowerCase()}`;
    if (!genByBrandModel.has(key)) genByBrandModel.set(key, gen);
  }
  
  // 1. NHTSA Recalls
  const recalls = await scrapeNHTSARecalls();
  
  // Insert recalls
  const recallSpecs: any[] = [];
  for (const r of recalls) {
    // Find matching generations for this brand
    const brandGens = allGens.filter(g => (g.model as any)?.brand?.name === r.brand);
    for (const gen of brandGens.slice(0, 5)) { // Top 5 gens per brand
      recallSpecs.push({
        generation_id: gen.id,
        source: 'NHTSA',
        spec_type: 'nhtsa_recalls',
        spec_value: r.recent_count,
        raw_data: {
          brand: r.brand,
          total_recalls: r.total_recalls,
          recent_recalls: r.recalls.slice(0, 10),
        },
      });
    }
  }
  
  if (recallSpecs.length > 0) {
    console.log(`\n📤 Inserting ${recallSpecs.length} NHTSA recall specs...`);
    await supabase.from('third_party_specs').upsert(recallSpecs, { onConflict: 'generation_id,source,spec_type' });
  }
  
  // 2. Wikipedia specs
  const wikiSpecs = await scrapeWikipediaSpecs();
  
  const wikiInserts: any[] = [];
  for (const w of wikiSpecs) {
    const key = `${w.brand.toLowerCase()}|${w.model.toLowerCase()}`;
    let gen = genByBrandModel.get(key);
    
    // Fuzzy match
    if (!gen) {
      for (const [k, g] of genByBrandModel.entries()) {
        if (k.includes(w.model.toLowerCase()) && k.startsWith(w.brand.toLowerCase())) {
          gen = g;
          break;
        }
      }
    }
    
    if (gen) {
      wikiInserts.push({
        generation_id: gen.id,
        source: 'Wikipedia',
        spec_type: 'wikipedia_specs',
        spec_value: 0,
        raw_data: w,
      });
    }
  }
  
  if (wikiInserts.length > 0) {
    console.log(`\n📤 Inserting ${wikiInserts.length} Wikipedia specs...`);
    await supabase.from('third_party_specs').upsert(wikiInserts, { onConflict: 'generation_id,source,spec_type' });
  }
  
  // Final count
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(60));
  console.log('💀 ARMAGEDDON COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   NHTSA recalls: ${recallSpecs.length} specs`);
  console.log(`   Wikipedia: ${wikiInserts.length} specs`);
  console.log(`   Total third_party_specs: ${count}`);
}

armageddon().catch(console.error);
