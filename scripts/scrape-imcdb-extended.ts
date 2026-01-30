/**
 * FLM AUTO - IMCDB Scraper (Extended brands)
 * Scrape movie/TV appearances for all major brands
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data/imcdb');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface MovieAppearance {
  brand: string;
  model: string;
  movie_title: string;
  movie_year: number | null;
  movie_url: string;
  vehicle_url: string;
  image_url: string | null;
}

// Extended brand list
const BRANDS = [
  // Already done (skip)
  // { name: 'BMW', urlName: 'BMW' },
  // { name: 'Mercedes-Benz', urlName: 'Mercedes-Benz' },
  // { name: 'Lamborghini', urlName: 'Lamborghini' },
  
  // New brands to scrape
  { name: 'Ferrari', urlName: 'Ferrari' },
  { name: 'Porsche', urlName: 'Porsche' },
  { name: 'Audi', urlName: 'Audi' },
  { name: 'Aston Martin', urlName: 'Aston+Martin' },
  { name: 'Jaguar', urlName: 'Jaguar' },
  { name: 'Rolls-Royce', urlName: 'Rolls-Royce' },
  { name: 'Bentley', urlName: 'Bentley' },
  { name: 'Maserati', urlName: 'Maserati' },
  { name: 'Ford', urlName: 'Ford' },
  { name: 'Chevrolet', urlName: 'Chevrolet' },
  { name: 'Dodge', urlName: 'Dodge' },
  { name: 'Pontiac', urlName: 'Pontiac' },
  { name: 'Cadillac', urlName: 'Cadillac' },
  { name: 'Lincoln', urlName: 'Lincoln' },
  { name: 'Toyota', urlName: 'Toyota' },
  { name: 'Nissan', urlName: 'Nissan' },
  { name: 'Honda', urlName: 'Honda' },
  { name: 'Mazda', urlName: 'Mazda' },
  { name: 'Subaru', urlName: 'Subaru' },
  { name: 'Mitsubishi', urlName: 'Mitsubishi' },
  { name: 'Volkswagen', urlName: 'Volkswagen' },
  { name: 'Volvo', urlName: 'Volvo' },
  { name: 'Peugeot', urlName: 'Peugeot' },
  { name: 'Renault', urlName: 'Renault' },
  { name: 'Citroën', urlName: 'Citro%EBn' },
  { name: 'Alfa Romeo', urlName: 'Alfa+Romeo' },
  { name: 'Fiat', urlName: 'Fiat' },
  { name: 'Lancia', urlName: 'Lancia' },
  { name: 'DeLorean', urlName: 'DeLorean' },
  { name: 'Tesla', urlName: 'Tesla' },
  { name: 'Land Rover', urlName: 'Land+Rover' },
  { name: 'Jeep', urlName: 'Jeep' },
  { name: 'Mini', urlName: 'Mini' },
  { name: 'McLaren', urlName: 'McLaren' },
  { name: 'Bugatti', urlName: 'Bugatti' },
  { name: 'Lotus', urlName: 'Lotus' },
  { name: 'TVR', urlName: 'TVR' },
];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
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

function parseVehiclesFromHTML(html: string, brand: string): MovieAppearance[] {
  const appearances: MovieAppearance[] = [];
  
  // Pattern for vehicle entries with movie info
  // Looking for: vehicle link, movie title, year
  const vehiclePattern = /<a\s+href="(vehicle_\d+[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  const moviePattern = /<a\s+href="(movie\.php\?id=\d+)"[^>]*>([^<]+)<\/a>\s*\((\d{4})\)/gi;
  
  // Split by vehicle entries
  const sections = html.split(/<tr[^>]*>/i);
  
  for (const section of sections) {
    // Find vehicle
    const vehicleMatch = /<a\s+href="(vehicle_\d+[^"]*)"[^>]*>([^<]+)<\/a>/i.exec(section);
    if (!vehicleMatch) continue;
    
    const vehicleUrl = `https://www.imcdb.org/${vehicleMatch[1]}`;
    const model = vehicleMatch[2].trim();
    
    // Find movie in same section
    const movieMatch = /<a\s+href="(movie\.php\?id=\d+)"[^>]*>([^<]+)<\/a>/i.exec(section);
    const yearMatch = /\((\d{4})\)/.exec(section);
    
    // Find image
    const imgMatch = /<img[^>]+src="([^"]+)"/i.exec(section);
    
    if (movieMatch) {
      appearances.push({
        brand,
        model,
        movie_title: movieMatch[2].trim(),
        movie_year: yearMatch ? parseInt(yearMatch[1]) : null,
        movie_url: `https://www.imcdb.org/${movieMatch[1]}`,
        vehicle_url: vehicleUrl,
        image_url: imgMatch ? (imgMatch[1].startsWith('http') ? imgMatch[1] : `https://www.imcdb.org/${imgMatch[1]}`) : null,
      });
    }
  }
  
  return appearances;
}

async function scrapeBrand(brand: { name: string; urlName: string }, limit: number = 500): Promise<MovieAppearance[]> {
  const allAppearances: MovieAppearance[] = [];
  
  try {
    // Get main vehicle list page
    const url = `https://www.imcdb.org/vehicles.php?make=${brand.urlName}`;
    const html = await fetchPage(url);
    
    // Parse appearances from list
    const appearances = parseVehiclesFromHTML(html, brand.name);
    allAppearances.push(...appearances.slice(0, limit));
    
    // If we need more, paginate
    if (appearances.length >= limit) {
      // Try page 2
      await delay(500);
      try {
        const page2Html = await fetchPage(`${url}&page=2`);
        const page2Appearances = parseVehiclesFromHTML(page2Html, brand.name);
        allAppearances.push(...page2Appearances.slice(0, limit - allAppearances.length));
      } catch {}
    }
    
  } catch (err) {
    // Ignore errors
  }
  
  return allAppearances;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - IMCDb Scraper (Movie Appearances)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputFile = path.join(DATA_DIR, 'appearances-extended.json');
  const allAppearances: MovieAppearance[] = [];
  const startTime = Date.now();

  // Load existing
  if (fs.existsSync(outputFile)) {
    const existing = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    allAppearances.push(...existing);
    console.log(`Loaded ${existing.length} existing appearances\n`);
  }

  const processedBrands = new Set(allAppearances.map(a => a.brand));

  for (let i = 0; i < BRANDS.length; i++) {
    const brand = BRANDS[i];
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const elapsedStr = `${Math.floor(elapsed / 60)}m${elapsed % 60}s`;
    
    process.stdout.write(`[${i + 1}/${BRANDS.length}] ${brand.name.padEnd(15)} (${elapsedStr})`);
    
    if (processedBrands.has(brand.name)) {
      console.log(` → SKIP (already done) ⏭️`);
      continue;
    }

    const appearances = await scrapeBrand(brand, 300);
    allAppearances.push(...appearances);
    
    console.log(` → ${appearances.length} appearances ✅`);
    
    // Save progress
    if ((i + 1) % 5 === 0) {
      fs.writeFileSync(outputFile, JSON.stringify(allAppearances, null, 2));
    }
    
    await delay(1000); // Be nice to IMCDb
  }

  // Final save
  fs.writeFileSync(outputFile, JSON.stringify(allAppearances, null, 2));

  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log(`Total appearances: ${allAppearances.length}`);
  console.log(`Time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
  console.log(`Output: ${outputFile}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
