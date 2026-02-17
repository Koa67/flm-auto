/**
 * FLM AUTO - IMCDB Scraper v3
 * Fixed regex patterns based on actual HTML structure
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data/imcdb');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface ChassisCode {
  code: string;
  count: number;
  url: string;
}

interface ModelName {
  name: string;
  count: number;
  url: string;
}

const BRANDS = [
  { name: 'BMW', urlName: 'BMW' },
  { name: 'Mercedes-Benz', urlName: 'Mercedes-Benz' },
  { name: 'Lamborghini', urlName: 'Lamborghini' }
];

const PRIORITY_CHASSIS: Record<string, string[]> = {
  'BMW': ['E30', 'E36', 'E46', 'E39', 'E38', 'E34', 'E60', 'E90', 'E92', 'F80', 'G80', 'E52', 'E36/7', 'I12'],
  'Mercedes-Benz': ['W140', 'W126', 'W124', 'W123', 'W463', 'W220', 'W221', 'W222', 'R107', 'R129', 'C197', 'W198', 'W100'],
  'Lamborghini': ['Countach', 'Miura', 'Diablo', 'Murciélago', 'Aventador', 'Huracán', 'Gallardo', 'Urus']
};

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  console.log(`  Fetching: ${url}`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.text();
}

function parseChassisCodesFromHTML(html: string): ChassisCode[] {
  const codes: ChassisCode[] = [];
  
  // Actual format: <a href="vehicles.php?make=BMW&amp;model=E46&amp;modelMatch=2&modelInclChassis=on">E46</a> (2950)
  // Note: &modelInclChassis (no amp; before modelInclChassis)
  const pattern = /<a\s+href="(vehicles\.php\?make=[^"]+modelMatch=2[^"]*modelInclChassis[^"]*)"[^>]*>([^<]+)<\/a>\s*\((\d+)\)/gi;
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1].replace(/&amp;/g, '&');
    const code = match[2].trim();
    const count = parseInt(match[3], 10);
    
    if (code !== '(none)' && code !== '') {
      codes.push({ code, count, url: `https://www.imcdb.org/${url}` });
    }
  }
  
  return codes;
}

function parseModelNamesFromHTML(html: string): ModelName[] {
  const models: ModelName[] = [];
  
  // Format: <a href="vehicles.php?make=BMW&amp;model=M3&amp;modelMatch=1&modelInclModel=on">M3</a> (394)
  const pattern = /<a\s+href="(vehicles\.php\?make=[^"]+modelMatch=1[^"]*modelInclModel[^"]*)"[^>]*>([^<]+)<\/a>\s*\((\d+)\)/gi;
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1].replace(/&amp;/g, '&');
    const name = match[2].trim();
    const count = parseInt(match[3], 10);
    
    if (name !== '(none)' && name !== '(unknown)' && name !== '') {
      models.push({ name, count, url: `https://www.imcdb.org/${url}` });
    }
  }
  
  return models;
}

async function scrapeBrand(brand: typeof BRANDS[0]): Promise<{
  chassisCodes: ChassisCode[];
  modelNames: ModelName[];
}> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping ${brand.name}`);
  console.log('='.repeat(60));
  
  const url = `https://www.imcdb.org/vehicles_make-${encodeURIComponent(brand.urlName)}.html`;
  const html = await fetchPage(url);
  
  // Parse chassis codes
  const chassisCodes = parseChassisCodesFromHTML(html);
  console.log(`Found ${chassisCodes.length} chassis codes for ${brand.name}`);
  
  // Show top 10
  const sortedChassis = [...chassisCodes].sort((a, b) => b.count - a.count);
  if (sortedChassis.length > 0) {
    console.log('Top 10 chassis by appearances:');
    sortedChassis.slice(0, 10).forEach(c => {
      console.log(`  ${c.code}: ${c.count.toLocaleString()}`);
    });
  }
  
  // Parse model names
  const modelNames = parseModelNamesFromHTML(html);
  console.log(`Found ${modelNames.length} model names for ${brand.name}`);
  
  const sortedModels = [...modelNames].sort((a, b) => b.count - a.count);
  if (sortedModels.length > 0) {
    console.log('Top 10 models by appearances:');
    sortedModels.slice(0, 10).forEach(m => {
      console.log(`  ${m.name}: ${m.count.toLocaleString()}`);
    });
  }
  
  // Check priority vehicles
  const priorities = PRIORITY_CHASSIS[brand.name] || [];
  console.log(`\nPriority vehicle check:`);
  
  for (const priority of priorities) {
    const chassisMatch = chassisCodes.find(c => 
      c.code.toLowerCase() === priority.toLowerCase()
    );
    const modelMatch = modelNames.find(m => 
      m.name.toLowerCase() === priority.toLowerCase()
    );
    
    if (chassisMatch) {
      console.log(`  ✓ ${priority}: ${chassisMatch.count.toLocaleString()} (chassis)`);
    } else if (modelMatch) {
      console.log(`  ✓ ${priority}: ${modelMatch.count.toLocaleString()} (model)`);
    } else {
      console.log(`  ⚠️ ${priority}: not found`);
    }
  }
  
  // Save data
  const chassisFile = path.join(DATA_DIR, `${brand.name.toLowerCase().replace(/[^a-z]/g, '-')}_chassis_codes.json`);
  fs.writeFileSync(chassisFile, JSON.stringify(chassisCodes, null, 2));
  
  const modelsFile = path.join(DATA_DIR, `${brand.name.toLowerCase().replace(/[^a-z]/g, '-')}_models.json`);
  fs.writeFileSync(modelsFile, JSON.stringify(modelNames, null, 2));
  
  return { chassisCodes, modelNames };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           FLM AUTO - IMCDB SCRAPER v3                      ║');
  console.log('║           Mercedes-Benz | BMW | Lamborghini                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results: Record<string, { chassisCodes: ChassisCode[]; modelNames: ModelName[] }> = {};
  
  for (const brand of BRANDS) {
    try {
      results[brand.name] = await scrapeBrand(brand);
      await delay(1000);
    } catch (error) {
      console.error(`Error scraping ${brand.name}:`, error);
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  let totalAppearances = 0;
  for (const brand of BRANDS) {
    const data = results[brand.name];
    if (data) {
      const brandTotal = data.chassisCodes.reduce((sum, c) => sum + c.count, 0);
      totalAppearances += brandTotal;
      console.log(`${brand.name}: ${data.chassisCodes.length} chassis, ${data.modelNames.length} models, ~${brandTotal.toLocaleString()} appearances`);
    }
  }
  console.log(`\nTotal: ~${totalAppearances.toLocaleString()} vehicle appearances across all brands`);
  
  // Save summary
  const summaryFile = path.join(DATA_DIR, 'imcdb_summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify({
    scraped_at: new Date().toISOString(),
    total_appearances: totalAppearances,
    brands: BRANDS.map(b => ({
      name: b.name,
      chassis_count: results[b.name]?.chassisCodes.length || 0,
      model_count: results[b.name]?.modelNames.length || 0,
      total: results[b.name]?.chassisCodes.reduce((s, c) => s + c.count, 0) || 0,
      top_5_chassis: results[b.name]?.chassisCodes.sort((a, b) => b.count - a.count).slice(0, 5) || []
    }))
  }, null, 2));
  
  console.log('\n✓ Done!');
}

main().catch(console.error);
