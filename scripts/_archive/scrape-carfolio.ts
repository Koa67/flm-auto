/**
 * FLM AUTO — Carfolio.com Scraper
 * Source : https://www.carfolio.com/
 * Data : Specs techniques mondiales, très structurées
 * 
 * Usage: npx ts-node scrape-carfolio.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    };
    
    https.get(url, options, (res) => {
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

interface CarfolioCar {
  make: string;
  model: string;
  year: number;
  variant: string;
  body_type: string;
  doors: number;
  engine_displacement: number;
  power_hp: number;
  power_kw: number;
  torque_nm: number;
  transmission: string;
  gears: number;
  drive_wheel: string;
  fuel_type: string;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  wheelbase_mm: number;
  weight_kg: number;
  top_speed_kmh: number;
  acceleration_0_100: number;
  fuel_consumption_combined: number;
  co2_emissions: number;
  source_url: string;
}

function parseCarfolioPage(html: string, url: string): Partial<CarfolioCar> | null {
  try {
    const car: Partial<CarfolioCar> = { source_url: url };
    
    // Extract make/model from breadcrumb or title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const parts = titleMatch[1].split(' - ')[0].split(' ');
      if (parts.length >= 2) {
        car.make = parts[0];
        car.model = parts.slice(1, -1).join(' ');
        const yearMatch = parts[parts.length - 1].match(/\d{4}/);
        if (yearMatch) car.year = parseInt(yearMatch[0]);
      }
    }

    // Extract specs from table rows
    const specPatterns: [RegExp, keyof CarfolioCar, (v: string) => any][] = [
      [/Body style[^<]*<\/td>\s*<td[^>]*>([^<]+)/i, 'body_type', (v) => v.trim()],
      [/Doors[^<]*<\/td>\s*<td[^>]*>(\d+)/i, 'doors', parseInt],
      [/Engine.*?(\d+)\s*(?:cc|cm)/i, 'engine_displacement', parseInt],
      [/Power.*?(\d+)\s*(?:hp|bhp|PS)/i, 'power_hp', parseInt],
      [/Power.*?(\d+)\s*kW/i, 'power_kw', parseInt],
      [/Torque.*?(\d+)\s*Nm/i, 'torque_nm', parseInt],
      [/Transmission[^<]*<\/td>\s*<td[^>]*>([^<]+)/i, 'transmission', (v) => v.trim()],
      [/Gears[^<]*<\/td>\s*<td[^>]*>(\d+)/i, 'gears', parseInt],
      [/Drive[^<]*<\/td>\s*<td[^>]*>([^<]+)/i, 'drive_wheel', (v) => v.trim()],
      [/Fuel[^<]*type[^<]*<\/td>\s*<td[^>]*>([^<]+)/i, 'fuel_type', (v) => v.trim()],
      [/Length[^<]*<\/td>\s*<td[^>]*>(\d+)\s*mm/i, 'length_mm', parseInt],
      [/Width[^<]*<\/td>\s*<td[^>]*>(\d+)\s*mm/i, 'width_mm', parseInt],
      [/Height[^<]*<\/td>\s*<td[^>]*>(\d+)\s*mm/i, 'height_mm', parseInt],
      [/Wheelbase[^<]*<\/td>\s*<td[^>]*>(\d+)\s*mm/i, 'wheelbase_mm', parseInt],
      [/(?:Kerb|Curb)\s*weight[^<]*<\/td>\s*<td[^>]*>(\d+)\s*kg/i, 'weight_kg', parseInt],
      [/Top\s*speed[^<]*<\/td>\s*<td[^>]*>(\d+)\s*km/i, 'top_speed_kmh', parseInt],
      [/0-100[^<]*<\/td>\s*<td[^>]*>(\d+\.?\d*)\s*s/i, 'acceleration_0_100', parseFloat],
      [/Combined[^<]*<\/td>\s*<td[^>]*>(\d+\.?\d*)\s*l/i, 'fuel_consumption_combined', parseFloat],
      [/CO2[^<]*<\/td>\s*<td[^>]*>(\d+)\s*g/i, 'co2_emissions', parseInt],
    ];

    for (const [pattern, field, transform] of specPatterns) {
      const match = html.match(pattern);
      if (match) {
        (car as any)[field] = transform(match[1]);
      }
    }

    return Object.keys(car).length > 3 ? car : null;
  } catch (e) {
    return null;
  }
}

async function getMakes(): Promise<string[]> {
  console.log('📋 Fetching makes list...');
  const html = await fetchPage('https://www.carfolio.com/specifications/');
  
  // Extract make links
  const makeLinks = html.match(/href="\/specifications\/models\/car\/\?man=([^"]+)"/gi) || [];
  const makes = makeLinks.map(link => {
    const match = link.match(/man=([^"]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }).filter(Boolean);
  
  return [...new Set(makes)];
}

async function getModelsForMake(make: string): Promise<string[]> {
  const url = `https://www.carfolio.com/specifications/models/car/?man=${encodeURIComponent(make)}`;
  const html = await fetchPage(url);
  
  // Extract model links
  const modelLinks = html.match(/href="\/specifications\/models\/([^"]+)"/gi) || [];
  const models = modelLinks.map(link => {
    const match = link.match(/\/models\/([^"\/]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }).filter(m => m && m !== 'car');
  
  return [...new Set(models)];
}

async function getSpecPages(make: string, model: string): Promise<string[]> {
  const url = `https://www.carfolio.com/specifications/models/${encodeURIComponent(make)}/${encodeURIComponent(model)}/`;
  const html = await fetchPage(url);
  
  // Extract individual spec page links
  const specLinks = html.match(/href="(\/specifications\/[^"]+)"/gi) || [];
  return specLinks.map(link => {
    const match = link.match(/href="([^"]+)"/);
    return match ? `https://www.carfolio.com${match[1]}` : '';
  }).filter(Boolean);
}

async function main() {
  console.log('🚗 FLM AUTO — Carfolio Scraper\n');
  
  let totalScraped = 0;
  let totalSaved = 0;

  try {
    // Get all makes
    const makes = await getMakes();
    console.log(`Found ${makes.length} makes\n`);

    // Priority makes (French market focus)
    const priorityMakes = [
      'Renault', 'Peugeot', 'Citroen', 'Dacia',
      'Volkswagen', 'Audi', 'BMW', 'Mercedes-Benz',
      'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia',
      'Ford', 'Fiat', 'Opel', 'Skoda', 'Seat'
    ];

    const sortedMakes = [
      ...priorityMakes.filter(m => makes.some(mk => mk.toLowerCase() === m.toLowerCase())),
      ...makes.filter(m => !priorityMakes.some(pm => pm.toLowerCase() === m.toLowerCase()))
    ];

    for (const make of sortedMakes.slice(0, 10)) { // Start with 10 makes for testing
      console.log(`\n🏷️  ${make}`);
      
      try {
        const models = await getModelsForMake(make);
        console.log(`   ${models.length} models found`);
        
        for (const model of models.slice(0, 5)) { // 5 models per make for testing
          try {
            const specPages = await getSpecPages(make, model);
            
            for (const pageUrl of specPages.slice(0, 3)) { // 3 variants per model
              try {
                const html = await fetchPage(pageUrl);
                const carData = parseCarfolioPage(html, pageUrl);
                
                if (carData && carData.make && carData.model) {
                  totalScraped++;
                  
                  // Save to Supabase
                  const { error } = await supabase.from('scraped_data').insert({
                    source: 'Carfolio',
                    source_url: pageUrl,
                    raw_data: carData,
                    scraped_at: new Date().toISOString()
                  });
                  
                  if (!error) {
                    totalSaved++;
                    process.stdout.write(`   ✓ ${carData.year || '?'} ${carData.model}\r`);
                  }
                }
                
                await delay(500); // Rate limiting
              } catch (e) {
                // Skip individual page errors
              }
            }
          } catch (e) {
            // Skip model errors
          }
          
          await delay(300);
        }
      } catch (e) {
        console.log(`   ⚠️ Error fetching models for ${make}`);
      }
      
      await delay(1000);
    }
  } catch (e: any) {
    console.log(`\n❌ Error: ${e.message}`);
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ Carfolio: ${totalScraped} scraped, ${totalSaved} saved`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
