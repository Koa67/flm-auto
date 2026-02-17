/**
 * Scrape Mercedes models missing from our DB
 * Target: A-Class, B-Class, GLA, GLB, GLE, CLA, EQ series, T-Class
 */

import * as fs from 'fs';
import * as path from 'path';

const MISSING_MODELS = [
  // A-Class generations
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M6383/A-Class-(W176)', name: 'A-Class', gen: 'W176' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M12157/A-Class-(W177)', name: 'A-Class', gen: 'W177' },
  // B-Class
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M2589/B-Class-(W245)', name: 'B-Class', gen: 'W245' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M6590/B-Class-(W246)', name: 'B-Class', gen: 'W246' },
  // GLA
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M8170/GLA-(X156)', name: 'GLA', gen: 'X156' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M12556/GLA-(H247)', name: 'GLA', gen: 'H247' },
  // GLB
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M12370/GLB-(X247)', name: 'GLB', gen: 'X247' },
  // GLE
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M9430/GLE-(W166)', name: 'GLE', gen: 'W166' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M12260/GLE-(W167)', name: 'GLE', gen: 'W167' },
  // CLA
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M7465/CLA-(C117)', name: 'CLA', gen: 'C117' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M12197/CLA-(C118)', name: 'CLA', gen: 'C118' },
  // EQ Series
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M11627/EQC-(N293)', name: 'EQC', gen: 'N293' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M13030/EQA-(H243)', name: 'EQA', gen: 'H243' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M13148/EQB-(X243)', name: 'EQB', gen: 'X243' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M13228/EQE-(V295)', name: 'EQE', gen: 'V295' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M12901/EQS-(V297)', name: 'EQS', gen: 'V297' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M13469/EQE-SUV-(X294)', name: 'EQE SUV', gen: 'X294' },
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M13303/EQS-SUV-(X296)', name: 'EQS SUV', gen: 'X296' },
  // T-Class
  { url: 'https://www.ultimatespecs.com/car-specs/Mercedes-Benz/M13411/T-Class-(W420)', name: 'T-Class', gen: 'W420' },
];

const DELAY_MS = 1500;

interface VehicleSpec {
  brand: string;
  model: string;
  generation: string;
  variant: string;
  year_start: number | null;
  year_end: number | null;
  body_type: string | null;
  engine_type: string | null;
  displacement_cc: number | null;
  power_hp: number | null;
  torque_nm: number | null;
  transmission: string | null;
  drivetrain: string | null;
  fuel_type: string | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
  weight_kg: number | null;
  top_speed_kmh: number | null;
  acceleration_0_100: number | null;
  source_url: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'FLM-AUTO-Research/1.0 (Educational project)',
      'Accept': 'text/html',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  
  return response.text();
}

function parseNumber(str: string | undefined): number | null {
  if (!str) return null;
  const clean = str.replace(/[^0-9.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function extractYears(text: string): { start: number | null; end: number | null } {
  // Pattern: "2018 - 2023" or "2018 -" or "from 2018"
  const rangeMatch = text.match(/(\d{4})\s*[-–]\s*(\d{4})?/);
  if (rangeMatch) {
    return {
      start: parseInt(rangeMatch[1]),
      end: rangeMatch[2] ? parseInt(rangeMatch[2]) : null
    };
  }
  const singleMatch = text.match(/\b(19|20)\d{2}\b/);
  return {
    start: singleMatch ? parseInt(singleMatch[0]) : null,
    end: null
  };
}

async function scrapeGenerationPage(url: string, modelName: string, genCode: string): Promise<VehicleSpec[]> {
  const specs: VehicleSpec[] = [];
  
  try {
    const html = await fetchPage(url);
    
    // Find all variant links on the generation page
    // Pattern: /car-specs/Mercedes-Benz/XXXXX/Name.html
    const variantRegex = /href="(\/car-specs\/Mercedes-Benz\/\d+\/[^"]+\.html)"/g;
    const variantUrls: string[] = [];
    let match;
    
    while ((match = variantRegex.exec(html)) !== null) {
      const variantUrl = `https://www.ultimatespecs.com${match[1]}`;
      if (!variantUrls.includes(variantUrl)) {
        variantUrls.push(variantUrl);
      }
    }
    
    console.log(`  Found ${variantUrls.length} variants for ${modelName} ${genCode}`);
    
    // Limit to first 20 variants per generation to avoid rate limiting
    const limitedUrls = variantUrls.slice(0, 20);
    
    for (const variantUrl of limitedUrls) {
      try {
        await delay(DELAY_MS);
        const variantHtml = await fetchPage(variantUrl);
        
        // Extract variant name from title
        const titleMatch = variantHtml.match(/<title>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : '';
        const variantName = title.replace(/\s*Specs.*$/i, '').replace(/^Mercedes[- ]?Benz\s*/i, '').trim();
        
        // Extract specs from the page
        const spec: VehicleSpec = {
          brand: 'Mercedes-Benz',
          model: modelName,
          generation: genCode,
          variant: variantName,
          year_start: null,
          year_end: null,
          body_type: null,
          engine_type: null,
          displacement_cc: null,
          power_hp: null,
          torque_nm: null,
          transmission: null,
          drivetrain: null,
          fuel_type: null,
          length_mm: null,
          width_mm: null,
          height_mm: null,
          wheelbase_mm: null,
          weight_kg: null,
          top_speed_kmh: null,
          acceleration_0_100: null,
          source_url: variantUrl,
        };
        
        // Years
        const yearsMatch = variantHtml.match(/Production years?:?\s*([^<\n]+)/i) ||
                          variantHtml.match(/((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})?/);
        if (yearsMatch) {
          const years = extractYears(yearsMatch[1] || yearsMatch[0]);
          spec.year_start = years.start;
          spec.year_end = years.end;
        }
        
        // Engine displacement
        const dispMatch = variantHtml.match(/(\d+)\s*cm[³3]|(\d+)\s*cc/i);
        if (dispMatch) {
          spec.displacement_cc = parseInt(dispMatch[1] || dispMatch[2]);
        }
        
        // Power (HP/PS)
        const powerMatch = variantHtml.match(/(\d+)\s*(?:HP|PS|bhp)/i);
        if (powerMatch) {
          spec.power_hp = parseInt(powerMatch[1]);
        }
        
        // Torque
        const torqueMatch = variantHtml.match(/(\d+)\s*Nm/i);
        if (torqueMatch) {
          spec.torque_nm = parseInt(torqueMatch[1]);
        }
        
        // Top speed
        const speedMatch = variantHtml.match(/top speed[:\s]*(\d+)\s*(?:km\/h|Km\/h)/i) ||
                          variantHtml.match(/(\d+)\s*Km\/h\s*\/\s*\d+\s*mph/i);
        if (speedMatch) {
          spec.top_speed_kmh = parseInt(speedMatch[1]);
        }
        
        // 0-100 acceleration
        const accelMatch = variantHtml.match(/0[- ](?:to[- ])?100[^:]*:\s*(\d+\.?\d*)\s*s/i) ||
                          variantHtml.match(/(\d+\.?\d*)\s*seconds?.*0[- ]100/i);
        if (accelMatch) {
          spec.acceleration_0_100 = parseFloat(accelMatch[1]);
        }
        
        // Weight
        const weightMatch = variantHtml.match(/(\d{3,4})\s*(?:Kg|kg)/);
        if (weightMatch) {
          spec.weight_kg = parseInt(weightMatch[1]);
        }
        
        // Dimensions
        const lengthMatch = variantHtml.match(/length[:\s]*(\d+\.?\d*)\s*(?:mm|inches)/i);
        if (lengthMatch) {
          const val = parseFloat(lengthMatch[1]);
          spec.length_mm = val > 100 ? Math.round(val) : Math.round(val * 25.4); // Convert inches to mm if needed
        }
        
        // Drivetrain
        if (/4MATIC|AWD|All Wheel Drive/i.test(variantHtml)) {
          spec.drivetrain = 'AWD';
        } else if (/FWD|Front Wheel Drive/i.test(variantHtml)) {
          spec.drivetrain = 'FWD';
        } else if (/RWD|Rear Wheel Drive/i.test(variantHtml)) {
          spec.drivetrain = 'RWD';
        }
        
        // Fuel type
        if (/electric|EQ[A-Z]/i.test(variantName)) {
          spec.fuel_type = 'Electric';
        } else if (/CDI|diesel/i.test(variantName)) {
          spec.fuel_type = 'Diesel';
        } else if (/hybrid/i.test(variantName)) {
          spec.fuel_type = 'Hybrid';
        } else {
          spec.fuel_type = 'Petrol';
        }
        
        // Transmission
        if (/DCT|7G-DCT|8G-DCT/i.test(variantHtml)) {
          spec.transmission = 'DCT';
        } else if (/9G-TRONIC|auto/i.test(variantHtml)) {
          spec.transmission = 'Automatic';
        } else {
          spec.transmission = 'Manual';
        }
        
        specs.push(spec);
        process.stdout.write('.');
        
      } catch (variantError) {
        console.error(`\n  Error on variant: ${variantError}`);
      }
    }
    
    console.log('');
    
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
  }
  
  return specs;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Scrape Missing Mercedes Models              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const outputDir = path.join(__dirname, '../data/ultimatespecs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const allSpecs: VehicleSpec[] = [];
  
  for (const model of MISSING_MODELS) {
    console.log(`\nScraping ${model.name} (${model.gen})...`);
    
    try {
      const specs = await scrapeGenerationPage(model.url, model.name, model.gen);
      allSpecs.push(...specs);
      console.log(`  → ${specs.length} variants scraped`);
      
      // Save incrementally
      fs.writeFileSync(
        path.join(outputDir, 'mercedes_missing.json'),
        JSON.stringify(allSpecs, null, 2)
      );
      
    } catch (error) {
      console.error(`Error on ${model.name}:`, error);
    }
    
    await delay(2000); // Extra pause between models
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total variants scraped: ${allSpecs.length}`);
  
  // Stats by model
  const byModel = allSpecs.reduce((acc, s) => {
    const key = `${s.model} ${s.generation}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\nBy model:');
  Object.entries(byModel).forEach(([model, count]) => {
    console.log(`  ${model}: ${count}`);
  });
  
  console.log(`\n✓ Saved to data/ultimatespecs/mercedes_missing.json`);
}

main().catch(console.error);
