/**
 * FLM AUTO — Carfolio Scraper v3
 * URLs correctes : /bmw/843/ et /bmw-320i-804485
 * 
 * Usage: npx ts-node scrape-carfolio-v3.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchPage(url: string): Promise<string> {
  const https = await import('https');
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `https://www.carfolio.com${redirectUrl}`;
          fetchPage(fullUrl).then(resolve).catch(reject);
          return;
        }
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

interface CarSpec {
  make: string;
  model: string;
  variant?: string;
  year?: number;
  body_type?: string;
  doors?: number;
  engine_cc?: number;
  power_bhp?: number;
  power_ps?: number;
  power_kw?: number;
  torque_nm?: number;
  transmission?: string;
  gears?: number;
  drive?: string;
  fuel?: string;
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  wheelbase_mm?: number;
  weight_kg?: number;
  top_speed_kmh?: number;
  accel_0_100?: number;
  consumption_combined?: number;
  co2_gkm?: number;
  source_url: string;
}

function parseSpecPage(html: string, url: string): CarSpec | null {
  const spec: CarSpec = { make: '', model: '', source_url: url };
  
  // Parse title: "2024 BMW 320i G20: detailed specifications..."
  const titleMatch = html.match(/<title>\s*(\d{4})?\s*([A-Za-z-]+)\s+([^:]+)/i);
  if (titleMatch) {
    if (titleMatch[1]) spec.year = parseInt(titleMatch[1]);
    spec.make = titleMatch[2].replace(/-/g, ' ').trim();
    spec.model = titleMatch[3].trim().split(':')[0].trim();
  }

  // Parse from text content
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  
  // Body type & doors
  const bodyMatch = text.match(/(\d)\s*door\s+(sedan|saloon|coupé|coupe|hatchback|suv|estate|wagon|convertible|cabriolet)/i);
  if (bodyMatch) {
    spec.doors = parseInt(bodyMatch[1]);
    spec.body_type = bodyMatch[2];
  }
  
  // Engine capacity
  const ccMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:litre|liter)|(\d{3,4})\s*cm3/i);
  if (ccMatch) {
    spec.engine_cc = ccMatch[1] ? Math.round(parseFloat(ccMatch[1]) * 1000) : parseInt(ccMatch[2]);
  }
  
  // Power
  const powerMatch = text.match(/(\d+(?:\.\d+)?)\s*bhp\s*\((\d+)\s*PS\/(\d+)\s*kW\)/i);
  if (powerMatch) {
    spec.power_bhp = parseFloat(powerMatch[1]);
    spec.power_ps = parseInt(powerMatch[2]);
    spec.power_kw = parseInt(powerMatch[3]);
  }
  
  // Torque
  const torqueMatch = text.match(/(\d+)\s*N·?m/i);
  if (torqueMatch) spec.torque_nm = parseInt(torqueMatch[1]);
  
  // Transmission
  const transMatch = text.match(/(\d)\s*speed\s*(manual|automatic)/i);
  if (transMatch) {
    spec.gears = parseInt(transMatch[1]);
    spec.transmission = transMatch[2];
  }
  
  // Drive
  if (/rear wheel drive/i.test(text)) spec.drive = 'RWD';
  else if (/front wheel drive/i.test(text)) spec.drive = 'FWD';
  else if (/all four wheels|all wheel drive|4wd|awd/i.test(text)) spec.drive = 'AWD';
  
  // Weight
  const weightMatch = text.match(/(?:kerb|curb|claimed)\s*(?:weight)?\s*(?:is|of)?\s*(\d+)\s*kg/i);
  if (weightMatch) spec.weight_kg = parseInt(weightMatch[1]);
  
  // Top speed
  const speedMatch = text.match(/(?:top|maximum)\s*(?:quoted|claimed|stated)?\s*speed\s*(?:is|of)?\s*(\d+)\s*km/i);
  if (speedMatch) spec.top_speed_kmh = parseInt(speedMatch[1]);
  
  // 0-100
  const accelMatch = text.match(/0-100\s*km\/h\s*(?:yardstick)?\s*(?:in)?\s*(\d+(?:\.\d+)?)\s*s/i);
  if (accelMatch) spec.accel_0_100 = parseFloat(accelMatch[1]);
  
  // Consumption
  const consumMatch = text.match(/(\d+(?:\.\d+)?)\s*l\/100km\s*(?:urban\/extra-urban\/)?combined/i);
  if (consumMatch) spec.consumption_combined = parseFloat(consumMatch[1]);
  
  // CO2
  const co2Match = text.match(/(\d+(?:\.\d+)?)\s*g\/km/i);
  if (co2Match) spec.co2_gkm = parseFloat(co2Match[1]);
  
  // Fuel type
  if (/petrol|gasoline/i.test(text)) spec.fuel = 'Petrol';
  else if (/diesel/i.test(text)) spec.fuel = 'Diesel';
  else if (/electric/i.test(text)) spec.fuel = 'Electric';
  else if (/hybrid/i.test(text)) spec.fuel = 'Hybrid';

  return (spec.make && spec.model) ? spec : null;
}

async function getCarLinks(makeUrl: string): Promise<string[]> {
  try {
    const html = await fetchPage(makeUrl);
    const links: string[] = [];
    
    // Pattern: href="/bmw-320i-804485"
    const linkRegex = /href="(\/[a-z]+-[a-z0-9]+-\d+)"/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      links.push(`https://www.carfolio.com${match[1]}`);
    }
    
    return [...new Set(links)];
  } catch (e) {
    return [];
  }
}

// Make codes from Carfolio (discovered via search)
const MAKES: Record<string, number> = {
  'BMW': 843,
  'Mercedes-Benz': 1117,
  'Audi': 815,
  'Volkswagen': 1252,
  'Porsche': 1164,
  'Toyota': 1235,
  'Honda': 1014,
  'Nissan': 1138,
  'Renault': 1176,
  'Peugeot': 1158,
  'Citroen': 888,
  'Ford': 971,
  'Hyundai': 1026,
  'Kia': 1062,
  'Mazda': 1108,
  'Volvo': 1256,
  'Fiat': 963,
  'Alfa Romeo': 803,
  'Opel': 1145,
  'Skoda': 1200,
  'Seat': 1192,
  'Ferrari': 960,
  'Lamborghini': 1073,
  'Jaguar': 1038,
  'Land Rover': 1079,
  'Lexus': 1086,
  'Tesla': 1220,
};

async function main() {
  console.log('🚗 FLM AUTO — Carfolio Scraper v3\n');
  
  let totalScraped = 0;
  let totalSaved = 0;
  let errors = 0;

  for (const [make, code] of Object.entries(MAKES)) {
    console.log(`\n🏷️  ${make}`);
    
    const listUrl = `https://www.carfolio.com/${make.toLowerCase().replace(/\s+/g, '-').replace('mercedes-benz', 'mercedes_benz')}/${code}/`;
    
    try {
      const carLinks = await getCarLinks(listUrl);
      console.log(`   Found ${carLinks.length} car pages`);
      
      // Scrape up to 30 cars per make
      for (const carUrl of carLinks.slice(0, 30)) {
        try {
          const html = await fetchPage(carUrl);
          const spec = parseSpecPage(html, carUrl);
          
          if (spec) {
            totalScraped++;
            
            const { error } = await supabase.from('scraped_data').insert({
              source: 'Carfolio',
              source_url: carUrl,
              raw_data: spec,
              scraped_at: new Date().toISOString()
            });
            
            if (!error) {
              totalSaved++;
              process.stdout.write(`   ✓ ${spec.year || ''} ${spec.model}`.padEnd(50) + '\r');
            }
          }
          
          await delay(200);
        } catch (e) {
          errors++;
        }
      }
      console.log(`   ✅ ${Math.min(30, carLinks.length)} processed`);
      
    } catch (e) {
      console.log(`   ⚠️ Failed to load make page`);
    }
    
    await delay(500);
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ Carfolio v3: ${totalScraped} scraped, ${totalSaved} saved, ${errors} errors`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
