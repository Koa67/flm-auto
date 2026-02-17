/**
 * FLM AUTO — Carfolio Scraper v4 (Puppeteer)
 * Les sites modernes rendent via JS. On a besoin d'un vrai browser.
 * 
 * npm install puppeteer
 * npx ts-node scrape-carfolio-v4.ts
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  weight_kg?: number;
  top_speed_kmh?: number;
  accel_0_100?: number;
  consumption?: number;
  co2?: number;
  source_url: string;
}

async function main() {
  console.log('🚗 FLM AUTO — Carfolio Scraper v4 (Puppeteer)\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  let totalScraped = 0;
  let totalSaved = 0;

  // URLs directes des fiches (découvertes via search)
  const carUrls = [
    'https://www.carfolio.com/bmw-320i-804485',
    'https://www.carfolio.com/bmw-318i-804375',
    'https://www.carfolio.com/bmw-318d-257103',
    'https://www.carfolio.com/bmw-420i-802032',
    'https://www.carfolio.com/bmw-640i-xdrive-508937',
  ];

  // D'abord, récupérer les liens depuis une page de liste
  const makeCodes: Record<string, number> = {
    'BMW': 843,
    'Audi': 815,
    'Mercedes-Benz': 1117,
    'Volkswagen': 1252,
    'Toyota': 1235,
    'Honda': 1014,
    'Renault': 1176,
    'Peugeot': 1158,
  };

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    for (const [make, code] of Object.entries(makeCodes)) {
      console.log(`\n🏷️  ${make}`);
      
      // Page de liste pour cette marque
      const listUrl = `https://www.carfolio.com/${make.toLowerCase().replace(/[\s-]+/g, '_')}/${code}/`;
      
      try {
        await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(1000);
        
        // Extraire les liens vers les fiches individuelles
        const links = await page.evaluate(() => {
          const anchors = document.querySelectorAll('a[href*="-"]');
          const urls: string[] = [];
          anchors.forEach(a => {
            const href = a.getAttribute('href');
            // Pattern: /make-model-123456
            if (href && /^\/[a-z]+-[a-z0-9]+-\d+$/i.test(href)) {
              urls.push(`https://www.carfolio.com${href}`);
            }
          });
          return [...new Set(urls)];
        });
        
        console.log(`   Found ${links.length} car links`);
        
        // Scraper chaque fiche (max 20 par marque)
        for (const carUrl of links.slice(0, 20)) {
          try {
            await page.goto(carUrl, { waitUntil: 'networkidle2', timeout: 20000 });
            await delay(500);
            
            const spec = await page.evaluate((url) => {
              const text = document.body.innerText;
              const spec: any = { source_url: url };
              
              // Title
              const title = document.title;
              const titleMatch = title.match(/(\d{4})?\s*([A-Za-z-]+)\s+([^:]+)/);
              if (titleMatch) {
                if (titleMatch[1]) spec.year = parseInt(titleMatch[1]);
                spec.make = titleMatch[2].replace(/-/g, ' ');
                spec.model = titleMatch[3].split(':')[0].trim();
              }
              
              // Power
              const powerMatch = text.match(/(\d+(?:\.\d+)?)\s*bhp\s*\((\d+)\s*PS\/(\d+)\s*kW\)/);
              if (powerMatch) {
                spec.power_bhp = parseFloat(powerMatch[1]);
                spec.power_ps = parseInt(powerMatch[2]);
                spec.power_kw = parseInt(powerMatch[3]);
              }
              
              // Torque
              const torqueMatch = text.match(/(\d+)\s*N·?m/);
              if (torqueMatch) spec.torque_nm = parseInt(torqueMatch[1]);
              
              // Weight
              const weightMatch = text.match(/(?:kerb|curb)\s*(?:weight)?\s*(?:is|of)?\s*(\d+)\s*kg/i);
              if (weightMatch) spec.weight_kg = parseInt(weightMatch[1]);
              
              // Top speed
              const speedMatch = text.match(/(?:top|maximum)\s*(?:speed)?\s*(?:is)?\s*(\d+)\s*km\/h/i);
              if (speedMatch) spec.top_speed_kmh = parseInt(speedMatch[1]);
              
              // 0-100
              const accelMatch = text.match(/0-100\s*km\/h[^0-9]*(\d+(?:\.\d+)?)\s*s/i);
              if (accelMatch) spec.accel_0_100 = parseFloat(accelMatch[1]);
              
              // Drive
              if (/rear wheel drive/i.test(text)) spec.drive = 'RWD';
              else if (/front wheel drive/i.test(text)) spec.drive = 'FWD';
              else if (/all.*(wheel|four)/i.test(text)) spec.drive = 'AWD';
              
              // Transmission
              const transMatch = text.match(/(\d)\s*speed\s*(manual|automatic)/i);
              if (transMatch) {
                spec.gears = parseInt(transMatch[1]);
                spec.transmission = transMatch[2];
              }
              
              // Engine
              const ccMatch = text.match(/(\d+(?:\.\d+)?)\s*litre/i);
              if (ccMatch) spec.engine_cc = Math.round(parseFloat(ccMatch[1]) * 1000);
              
              return spec;
            }, carUrl);
            
            if (spec.make && spec.model) {
              totalScraped++;
              
              const { error } = await supabase.from('scraped_data').insert({
                source: 'Carfolio',
                source_url: carUrl,
                raw_data: spec,
                scraped_at: new Date().toISOString()
              });
              
              if (!error) {
                totalSaved++;
                console.log(`   ✓ ${spec.year || ''} ${spec.model}`);
              }
            }
            
          } catch (e) {
            // Skip errors
          }
        }
        
      } catch (e) {
        console.log(`   ⚠️ Failed: ${(e as Error).message.slice(0, 50)}`);
      }
      
      await delay(1000);
    }
    
  } finally {
    await browser.close();
  }

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  ✅ Carfolio v4: ${totalScraped} scraped, ${totalSaved} saved`);
  console.log(`════════════════════════════════════════════════════════\n`);
}

main().catch(console.error);
