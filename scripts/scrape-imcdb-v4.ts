/**
 * FLM AUTO - IMCDb Scraper v4 (Fixed)
 * Structure: Brand -> Models -> Vehicles in movies
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface MovieAppearance {
  brand: string;
  model: string;
  movie_title: string;
  movie_year: number | null;
  movie_url: string;
  vehicle_url: string;
  scraped_at: string;
}

const BRANDS = [
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
  { name: 'Cadillac', urlName: 'Cadillac' },
  { name: 'Toyota', urlName: 'Toyota' },
  { name: 'Nissan', urlName: 'Nissan' },
  { name: 'Honda', urlName: 'Honda' },
  { name: 'Volkswagen', urlName: 'Volkswagen' },
  { name: 'Volvo', urlName: 'Volvo' },
  { name: 'Peugeot', urlName: 'Peugeot' },
  { name: 'DeLorean', urlName: 'DeLorean' },
  { name: 'Tesla', urlName: 'Tesla' },
  { name: 'Land Rover', urlName: 'Land+Rover' },
  { name: 'Mini', urlName: 'Mini' },
  { name: 'McLaren', urlName: 'McLaren' },
  { name: 'Bugatti', urlName: 'Bugatti' },
  { name: 'Lotus', urlName: 'Lotus' },
];

async function scrapeBrand(page: Page, brand: { name: string; urlName: string }): Promise<MovieAppearance[]> {
  const appearances: MovieAppearance[] = [];
  
  try {
    // Go to brand page with all models
    const brandUrl = `https://www.imcdb.org/vehicles.php?make=${brand.urlName}&model=`;
    await page.goto(brandUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1500);
    
    // Extract vehicles and their movies
    const data = await page.evaluate((brandName: string) => {
      const results: any[] = [];
      
      // Find all table rows with vehicle data
      // IMCDb structure: each row has vehicle info + movie info
      document.querySelectorAll('table tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return;
        
        // Look for vehicle link (vehicle_XXXXX)
        const vehicleLink = row.querySelector('a[href*="vehicle_"]');
        // Look for movie link (movie_XXXXX or movie.php)
        const movieLink = row.querySelector('a[href*="movie"]');
        
        if (vehicleLink && movieLink) {
          const vehicleText = vehicleLink.textContent?.trim() || '';
          const movieText = movieLink.textContent?.trim() || '';
          const movieHref = (movieLink as HTMLAnchorElement).href;
          const vehicleHref = (vehicleLink as HTMLAnchorElement).href;
          
          // Extract year from movie text or nearby
          const rowText = row.textContent || '';
          const yearMatch = rowText.match(/\((\d{4})\)/);
          
          if (vehicleText && movieText) {
            results.push({
              brand: brandName,
              model: vehicleText,
              movie_title: movieText,
              movie_year: yearMatch ? parseInt(yearMatch[1]) : null,
              movie_url: movieHref,
              vehicle_url: vehicleHref,
            });
          }
        }
      });
      
      // Also try extracting from thumbnail grid format
      document.querySelectorAll('.th, .thumbnail, [class*="thumb"]').forEach(thumb => {
        const vehicleLink = thumb.querySelector('a[href*="vehicle_"]');
        const movieLink = thumb.querySelector('a[href*="movie"]');
        const img = thumb.querySelector('img');
        
        if (vehicleLink) {
          const vehicleText = vehicleLink.textContent?.trim() || img?.alt || '';
          const movieText = movieLink?.textContent?.trim() || '';
          const thumbText = thumb.textContent || '';
          const yearMatch = thumbText.match(/\((\d{4})\)/);
          
          if (vehicleText) {
            results.push({
              brand: brandName,
              model: vehicleText,
              movie_title: movieText || 'Unknown',
              movie_year: yearMatch ? parseInt(yearMatch[1]) : null,
              movie_url: movieLink ? (movieLink as HTMLAnchorElement).href : '',
              vehicle_url: (vehicleLink as HTMLAnchorElement).href,
            });
          }
        }
      });
      
      return results;
    }, brand.name);
    
    // Add scraped_at
    for (const d of data) {
      appearances.push({
        ...d,
        scraped_at: new Date().toISOString(),
      });
    }
    
    // If first page has results, try to get more pages
    if (appearances.length > 0) {
      // Check for pagination - try page 2
      try {
        await page.goto(`${brandUrl}&page=2`, { waitUntil: 'networkidle2', timeout: 20000 });
        await delay(1000);
        
        const page2Data = await page.evaluate((brandName: string) => {
          const results: any[] = [];
          document.querySelectorAll('table tr').forEach(row => {
            const vehicleLink = row.querySelector('a[href*="vehicle_"]');
            const movieLink = row.querySelector('a[href*="movie"]');
            if (vehicleLink && movieLink) {
              const rowText = row.textContent || '';
              const yearMatch = rowText.match(/\((\d{4})\)/);
              results.push({
                brand: brandName,
                model: vehicleLink.textContent?.trim() || '',
                movie_title: movieLink.textContent?.trim() || '',
                movie_year: yearMatch ? parseInt(yearMatch[1]) : null,
                movie_url: (movieLink as HTMLAnchorElement).href,
                vehicle_url: (vehicleLink as HTMLAnchorElement).href,
              });
            }
          });
          return results;
        }, brand.name);
        
        for (const d of page2Data) {
          appearances.push({ ...d, scraped_at: new Date().toISOString() });
        }
      } catch {}
    }
    
  } catch (err) {
    // Ignore errors
  }
  
  return appearances;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - IMCDb Scraper v4 (Fixed)                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const outputDir = path.join(__dirname, '../data/imcdb');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'appearances-v4.json');
  const allAppearances: MovieAppearance[] = [];
  const startTime = Date.now();

  let browser: Browser | null = null;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    for (let i = 0; i < BRANDS.length; i++) {
      const brand = BRANDS[i];
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const elapsedStr = `${Math.floor(elapsed / 60)}m${elapsed % 60}s`;
      
      process.stdout.write(`[${i + 1}/${BRANDS.length}] ${brand.name.padEnd(15)} (${elapsedStr})`);
      
      const appearances = await scrapeBrand(page, brand);
      allAppearances.push(...appearances);
      
      console.log(` → ${appearances.length} appearances ✅`);
      
      // Save progress
      if ((i + 1) % 5 === 0) {
        fs.writeFileSync(outputFile, JSON.stringify(allAppearances, null, 2));
      }
      
      await delay(2000);
    }

    await page.close();
    
  } finally {
    if (browser) {
      await browser.close();
    }
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
