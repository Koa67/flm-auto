/**
 * FLM AUTO - EV Database Scraper v6
 * Fixed: Škoda with accent
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '../data/raw/ev_database';

interface EvData {
  brand: string;
  model: string;
  variant: string;
  range_real_km: number | null;
  efficiency_whkm: number | null;
  battery_kwh: number | null;
  fastcharge_kw: number | null;
  acceleration_sec: number | null;
  top_speed_kmh: number | null;
  price_germany_eur: number | null;
  seats: number | null;
  segment: string | null;
  drive: string | null;
  v2l: boolean;
  heat_pump: boolean;
  url: string | null;
}

async function main() {
  console.log('🚀 FLM AUTO - EV Database Scraper v6');
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const cachePath = path.join(OUTPUT_DIR, 'debug_list.html');
  let html: string;
  
  if (fs.existsSync(cachePath)) {
    html = fs.readFileSync(cachePath, 'utf-8');
  } else {
    console.log('📥 Fetching...');
    const response = await fetch('https://ev-database.org/', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    html = await response.text();
    fs.writeFileSync(cachePath, html);
  }
  
  console.log(`  HTML size: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
  
  const evData: EvData[] = [];
  const items = html.split(/class="list-item"/);
  console.log(`  Found ${items.length - 1} list items`);
  
  for (let i = 1; i < items.length; i++) {
    const item = items[i].substring(0, 8000);
    
    // Extract brand - handle various cases:
    // 1. <span class="bmw">BMW</span>
    // 2. <span class="mercedes_benz">Mercedes-Benz</span>
    // 3. <span class="skoda">Škoda</span> (with accent!)
    
    let brand = '';
    let modelPart = '';
    
    // Check for each target brand
    if (item.match(/<span class="bmw"[^>]*>BMW<\/span>/i)) {
      brand = 'BMW';
    } else if (item.match(/<span class="mercedes_benz"[^>]*>Mercedes-Benz<\/span>/i)) {
      brand = 'Mercedes-Benz';
    } else if (item.match(/<span class="audi"[^>]*>Audi<\/span>/i)) {
      brand = 'Audi';
    } else if (item.match(/<span class="volkswagen"[^>]*>Volkswagen<\/span>/i)) {
      brand = 'Volkswagen';
    } else if (item.match(/<span class="porsche"[^>]*>Porsche<\/span>/i)) {
      brand = 'Porsche';
    } else if (item.match(/<span class="skoda"[^>]*>[ŠS]koda<\/span>/i)) {
      brand = 'Skoda';
    }
    
    if (!brand) continue;
    
    // Extract model from <span class="model">...</span>
    const modelMatch = item.match(/<span class="model">([^<]+)/);
    modelPart = modelMatch ? modelMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    
    // Clean up model year suffix like "(MY25)"
    modelPart = modelPart.replace(/\s*\(MY\d+\)\s*$/, '').trim();
    
    const fullModel = `${brand} ${modelPart}`.trim();
    
    // Extract URL
    const urlMatch = item.match(/href="(\/car\/\d+\/[^"]+)"/);
    const url = urlMatch ? `https://ev-database.org${urlMatch[1]}` : null;
    
    const ev: EvData = {
      brand,
      model: fullModel,
      variant: modelPart,
      range_real_km: null,
      efficiency_whkm: null,
      battery_kwh: null,
      fastcharge_kw: null,
      acceleration_sec: null,
      top_speed_kmh: null,
      price_germany_eur: null,
      seats: null,
      segment: null,
      drive: null,
      v2l: false,
      heat_pump: false,
      url,
    };
    
    // Extract specs
    const rangeMatch = item.match(/class="erange_real"[^>]*>(\d+)\s*km/);
    if (rangeMatch) ev.range_real_km = parseInt(rangeMatch[1]);
    
    const effMatch = item.match(/class="efficiency"[^>]*>(\d+)\s*Wh\/km/);
    if (effMatch) ev.efficiency_whkm = parseInt(effMatch[1]);
    
    const battMatch = item.match(/(\d+(?:\.\d+)?)\s*kWh/);
    if (battMatch) ev.battery_kwh = parseFloat(battMatch[1]);
    
    const chargeMatch = item.match(/class="[^"]*fastcharge[^"]*"[^>]*>(\d+)\s*kW/);
    if (chargeMatch) ev.fastcharge_kw = parseInt(chargeMatch[1]);
    
    const accelMatch = item.match(/(\d+(?:\.\d+)?)\s*sec/);
    if (accelMatch) ev.acceleration_sec = parseFloat(accelMatch[1]);
    
    const seatsMatch = item.match(/seats-(\d)/);
    if (seatsMatch) ev.seats = parseInt(seatsMatch[1]);
    
    const segmentMatch = item.match(/class="size-([a-z])"/i);
    if (segmentMatch) ev.segment = segmentMatch[1].toUpperCase();
    
    if (item.includes('All Wheel Drive') || item.includes('class="awd')) {
      ev.drive = 'AWD';
    } else if (item.includes('Rear Wheel Drive')) {
      ev.drive = 'RWD';
    } else if (item.includes('Front Wheel Drive')) {
      ev.drive = 'FWD';
    }
    
    ev.v2l = item.includes('Vehicle-2-Load');
    ev.heat_pump = item.includes('Heat pump') || item.includes('heatpump');
    
    const priceMatch = item.match(/€\s*([\d,.]+)/) || item.match(/([\d,.]+)\s*€/);
    if (priceMatch) {
      const price = parseInt(priceMatch[1].replace(/[,.]/g, ''));
      if (price > 10000 && price < 500000) {
        ev.price_germany_eur = price;
      }
    }
    
    evData.push(ev);
  }
  
  console.log(`  Parsed ${evData.length} EVs from target brands`);
  
  // Remove duplicates
  const seen = new Set<string>();
  const unique = evData.filter(ev => {
    if (seen.has(ev.model)) return false;
    seen.add(ev.model);
    return true;
  });
  
  console.log(`  Unique: ${unique.length}`);
  
  // Save all
  fs.writeFileSync(path.join(OUTPUT_DIR, 'all_ev_specs.json'), JSON.stringify(unique, null, 2));
  
  // By brand
  console.log('\n📊 By brand:');
  for (const brand of ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Skoda']) {
    const brandEvs = unique.filter(e => e.brand === brand);
    console.log(`  ${brand}: ${brandEvs.length}`);
    
    if (brandEvs.length > 0) {
      const slug = brand.toLowerCase().replace('-', '_');
      fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}_ev.json`), JSON.stringify(brandEvs, null, 2));
    }
  }
  
  console.log('\n📝 Samples:');
  unique.filter(e => e.brand === 'Skoda').slice(0, 5).forEach(ev => {
    console.log(`  ${ev.model}: ${ev.range_real_km}km, ${ev.battery_kwh}kWh, ${ev.drive}`);
  });
  
  console.log(`\n✅ Total: ${unique.length} EVs saved`);
}

main().catch(console.error);
