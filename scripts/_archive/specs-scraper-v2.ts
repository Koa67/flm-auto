/**
 * FLM AUTO - SPECS SCRAPER V2
 * 
 * Sources qui fonctionnent vraiment:
 * 1. Wikipedia API (structuré, pas de block)
 * 2. DBpedia (données structurées de Wikipedia)
 * 3. Open Data sources
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '../data/raw/specs_v2';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// 1. WIKIPEDIA API - Infobox data via API
// ============================================================
async function scrapeWikipediaAPI() {
  console.log('\n📖 WIKIPEDIA API - Structured Infobox Data\n');
  
  const vehicles = [
    // BMW
    'BMW_3_Series_(E90)', 'BMW_3_Series_(F30)', 'BMW_3_Series_(G20)',
    'BMW_5_Series_(E60)', 'BMW_5_Series_(F10)', 'BMW_5_Series_(G30)',
    'BMW_7_Series_(E65)', 'BMW_7_Series_(F01)', 'BMW_7_Series_(G11)',
    'BMW_X1_(E84)', 'BMW_X1_(F48)', 'BMW_X3_(E83)', 'BMW_X3_(F25)', 'BMW_X3_(G01)',
    'BMW_X5_(E53)', 'BMW_X5_(E70)', 'BMW_X5_(F15)', 'BMW_X5_(G05)',
    'BMW_M3', 'BMW_M5', 'BMW_i3', 'BMW_i4', 'BMW_iX',
    // Mercedes
    'Mercedes-Benz_C-Class_(W204)', 'Mercedes-Benz_C-Class_(W205)', 'Mercedes-Benz_C-Class_(W206)',
    'Mercedes-Benz_E-Class_(W211)', 'Mercedes-Benz_E-Class_(W212)', 'Mercedes-Benz_E-Class_(W213)',
    'Mercedes-Benz_S-Class_(W221)', 'Mercedes-Benz_S-Class_(W222)', 'Mercedes-Benz_S-Class_(W223)',
    'Mercedes-Benz_GLC-Class', 'Mercedes-Benz_GLE-Class', 'Mercedes-Benz_GLS-Class',
    'Mercedes-AMG_GT', 'Mercedes-Benz_EQS', 'Mercedes-Benz_EQE',
    // Audi
    'Audi_A3', 'Audi_A4_(B8)', 'Audi_A4_(B9)', 'Audi_A6_(C7)', 'Audi_A6_(C8)',
    'Audi_A8_(D4)', 'Audi_A8_(D5)', 'Audi_Q3', 'Audi_Q5', 'Audi_Q7', 'Audi_Q8',
    'Audi_e-tron_(brand)', 'Audi_R8', 'Audi_TT',
    // VW
    'Volkswagen_Golf_Mk7', 'Volkswagen_Golf_Mk8', 'Volkswagen_Passat_(B8)',
    'Volkswagen_Tiguan', 'Volkswagen_Touareg', 'Volkswagen_ID.3', 'Volkswagen_ID.4', 'Volkswagen_ID.Buzz',
    // Porsche
    'Porsche_911_(991)', 'Porsche_911_(992)', 'Porsche_Cayenne', 'Porsche_Macan',
    'Porsche_Panamera', 'Porsche_Taycan', 'Porsche_718_Cayman',
    // Tesla
    'Tesla_Model_3', 'Tesla_Model_S', 'Tesla_Model_X', 'Tesla_Model_Y',
    // Others
    'Toyota_Corolla_(E210)', 'Toyota_RAV4_(XA50)', 'Honda_Civic_(eleventh_generation)',
    'Ford_Mustang_(sixth_generation)', 'Hyundai_Ioniq_5', 'Volvo_XC60', 'Volvo_XC90',
    'Ferrari_296_GTB', 'Ferrari_SF90_Stradale', 'Lamborghini_Huracán', 'Lamborghini_Urus',
  ];
  
  const results: any[] = [];
  
  for (const vehicle of vehicles) {
    await delay(200); // Be nice to Wikipedia
    
    try {
      // Get parsed wikitext with infobox
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(vehicle)}&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'FLM-Auto/1.0 (contact@flm-auto.com)' }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const page = data.query?.pages?.[0];
      
      if (!page || page.missing) continue;
      
      const content = page.revisions?.[0]?.slots?.main?.content || '';
      
      // Parse infobox
      const specs = parseWikipediaInfobox(content, vehicle);
      
      if (Object.keys(specs).length > 3) {
        results.push({
          title: vehicle.replace(/_/g, ' '),
          wiki_title: vehicle,
          ...specs,
          scraped_at: new Date().toISOString(),
        });
        console.log(`   ✅ ${vehicle.replace(/_/g, ' ')}: ${Object.keys(specs).length} fields`);
      } else {
        console.log(`   ⚠️ ${vehicle.replace(/_/g, ' ')}: insufficient data`);
      }
      
    } catch (e) {
      console.log(`   ❌ ${vehicle}: error`);
    }
  }
  
  return results;
}

function parseWikipediaInfobox(content: string, title: string): any {
  const specs: any = {};
  
  // Find infobox
  const infoboxMatch = content.match(/\{\{Infobox automobile[\s\S]*?\n\}\}/i) ||
                       content.match(/\{\{Infobox car[\s\S]*?\n\}\}/i);
  
  if (!infoboxMatch) return specs;
  
  const infobox = infoboxMatch[0];
  
  // Parse fields
  const fieldRegex = /\|\s*([a-z_]+)\s*=\s*([^\n|{}]+)/gi;
  let match;
  
  while ((match = fieldRegex.exec(infobox)) !== null) {
    const key = match[1].trim().toLowerCase();
    let value = match[2].trim();
    
    // Clean up wiki markup
    value = value
      .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, '$2$1') // Links
      .replace(/\{\{[^}]+\}\}/g, '') // Templates
      .replace(/<[^>]+>/g, '') // HTML
      .replace(/'''?/g, '') // Bold/italic
      .replace(/&nbsp;/g, ' ')
      .trim();
    
    if (value && value.length > 0 && value.length < 500) {
      specs[key] = value;
    }
  }
  
  // Also try to get specs table
  const specTableMatch = content.match(/\{\{specs[\s\S]*?\}\}/i);
  if (specTableMatch) {
    const specTable = specTableMatch[0];
    const specFieldRegex = /\|\s*([a-z_]+)\s*=\s*([^\n|{}]+)/gi;
    
    while ((match = specFieldRegex.exec(specTable)) !== null) {
      const key = 'spec_' + match[1].trim().toLowerCase();
      const value = match[2].trim().replace(/\[\[|\]\]/g, '');
      if (value && value.length > 0) {
        specs[key] = value;
      }
    }
  }
  
  return specs;
}

// ============================================================
// 2. NHTSA API - US Safety Data (Free, no auth)
// ============================================================
async function scrapeNHTSA() {
  console.log('\n🛡️ NHTSA API - US Safety Ratings\n');
  
  const years = [2020, 2021, 2022, 2023, 2024];
  const makes = ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Tesla', 'Toyota', 'Honda', 'Ford', 'Hyundai', 'Volvo'];
  
  const results: any[] = [];
  
  for (const make of makes) {
    for (const year of years) {
      await delay(300);
      
      try {
        const url = `https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(make)}?format=json`;
        
        const response = await fetch(url);
        if (!response.ok) continue;
        
        const data = await response.json();
        
        if (data.Results && data.Results.length > 0) {
          for (const model of data.Results) {
            // Get detailed ratings
            const detailUrl = `https://api.nhtsa.gov/SafetyRatings/VehicleId/${model.VehicleId}?format=json`;
            await delay(200);
            
            const detailResponse = await fetch(detailUrl);
            if (!detailResponse.ok) continue;
            
            const detail = await detailResponse.json();
            const result = detail.Results?.[0];
            
            if (result) {
              results.push({
                make,
                model: model.Model,
                year,
                vehicle_id: model.VehicleId,
                overall_rating: result.OverallRating,
                frontal_crash: result.OverallFrontCrashRating,
                side_crash: result.OverallSideCrashRating,
                rollover: result.RolloverRating,
                complaints_count: result.ComplaintsCount,
                recalls_count: result.RecallsCount,
                investigation_count: result.InvestigationCount,
                scraped_at: new Date().toISOString(),
              });
            }
          }
          
          console.log(`   ✅ ${make} ${year}: ${data.Results.length} models`);
        }
        
      } catch (e) {
        // Skip errors
      }
    }
  }
  
  return results;
}

// ============================================================
// 3. EPA Fuel Economy API (Free, no auth)
// ============================================================
async function scrapeEPA() {
  console.log('\n⛽ EPA Fuel Economy Data\n');
  
  const results: any[] = [];
  const years = [2020, 2021, 2022, 2023, 2024];
  
  for (const year of years) {
    await delay(500);
    
    try {
      // EPA provides CSV downloads
      const url = `https://www.fueleconomy.gov/feg/epadata/vehicles.csv`;
      
      // For demo, we'll use the API endpoint
      const apiUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/menu/year`;
      
      const response = await fetch(apiUrl, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   📊 EPA API available: ${JSON.stringify(data).substring(0, 100)}...`);
      }
      
    } catch (e) {
      console.log(`   ⚠️ EPA API not directly accessible, would need CSV download`);
    }
  }
  
  return results;
}

// ============================================================
// 4. Euro NCAP (scrape results page)
// ============================================================
async function scrapeEuroNCAP() {
  console.log('\n⭐ Euro NCAP Safety Ratings\n');
  
  const results: any[] = [];
  
  // Euro NCAP has a JSON API for their results
  try {
    const url = 'https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      }
    });
    
    if (response.ok) {
      const html = await response.text();
      
      // Parse ratings from HTML
      const ratingRegex = /<div[^>]*class="[^"]*rating-card[^"]*"[^>]*>[\s\S]*?<h\d[^>]*>([^<]+)<\/h\d>[\s\S]*?(\d+)%[\s\S]*?<\/div>/gi;
      let match;
      
      while ((match = ratingRegex.exec(html)) !== null) {
        results.push({
          vehicle: match[1].trim(),
          rating_percent: parseInt(match[2]),
          source: 'Euro NCAP',
          scraped_at: new Date().toISOString(),
        });
      }
      
      console.log(`   ✅ Found ${results.length} ratings`);
    }
    
  } catch (e) {
    console.log(`   ⚠️ Euro NCAP scraping limited`);
  }
  
  return results;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('═'.repeat(60));
  console.log('   FLM AUTO - SPECS SCRAPER V2');
  console.log('   Using APIs and structured data sources');
  console.log('═'.repeat(60));
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const allData: any = {
    wikipedia: [],
    nhtsa: [],
    euro_ncap: [],
  };
  
  // 1. Wikipedia API
  allData.wikipedia = await scrapeWikipediaAPI();
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'wikipedia_specs.json'),
    JSON.stringify(allData.wikipedia, null, 2)
  );
  
  // 2. NHTSA
  allData.nhtsa = await scrapeNHTSA();
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'nhtsa_safety.json'),
    JSON.stringify(allData.nhtsa, null, 2)
  );
  
  // 3. Euro NCAP
  allData.euro_ncap = await scrapeEuroNCAP();
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'euro_ncap.json'),
    JSON.stringify(allData.euro_ncap, null, 2)
  );
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('   SCRAPING COMPLETE');
  console.log('═'.repeat(60));
  console.log(`\n📊 Results:`);
  console.log(`   Wikipedia specs: ${allData.wikipedia.length}`);
  console.log(`   NHTSA safety: ${allData.nhtsa.length}`);
  console.log(`   Euro NCAP: ${allData.euro_ncap.length}`);
  console.log(`\n📁 Data saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
