/**
 * FLM AUTO - IMCDB Detail Scraper v2
 * Fixed regex to match actual HTML structure
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../data/imcdb');

interface MovieAppearance {
  vehicle_id: string;
  vehicle_model: string;
  chassis_code: string;
  movie_id: string;
  movie_title: string;
  movie_year: string | null;
  stars: number; // 1-5 importance rating
  vehicle_url: string;
  movie_url: string;
  thumbnail_url: string;
}

interface ChassisDetail {
  brand: string;
  chassis_code: string;
  total_count: number;
  pages_scraped: number;
  appearances: MovieAppearance[];
  scraped_at: string;
}

// Top chassis to scrape
const TOP_CHASSIS = [
  // BMW - Top 15
  { brand: 'BMW', code: 'E46', count: 2950 },
  { brand: 'BMW', code: 'E30', count: 2946 },
  { brand: 'BMW', code: 'E36', count: 2539 },
  { brand: 'BMW', code: 'E39', count: 2192 },
  { brand: 'BMW', code: 'E34', count: 2012 },
  { brand: 'BMW', code: 'E60', count: 1430 },
  { brand: 'BMW', code: 'E21', count: 1335 },
  { brand: 'BMW', code: 'E90', count: 1271 },
  { brand: 'BMW', code: 'E53', count: 1208 },
  { brand: 'BMW', code: 'F10', count: 1051 },
  { brand: 'BMW', code: 'E38', count: 990 },
  { brand: 'BMW', code: 'E32', count: 936 },
  { brand: 'BMW', code: 'E12', count: 879 },
  { brand: 'BMW', code: 'E36/7', count: 558 },
  { brand: 'BMW', code: 'E52', count: 51 },
  
  // Mercedes - Top 15
  { brand: 'Mercedes-Benz', code: 'W123', count: 5080 },
  { brand: 'Mercedes-Benz', code: 'W124', count: 3449 },
  { brand: 'Mercedes-Benz', code: 'W126', count: 2999 },
  { brand: 'Mercedes-Benz', code: 'W115', count: 2724 },
  { brand: 'Mercedes-Benz', code: 'W210', count: 2485 },
  { brand: 'Mercedes-Benz', code: 'W211', count: 2056 },
  { brand: 'Mercedes-Benz', code: 'W111', count: 1887 },
  { brand: 'Mercedes-Benz', code: 'R107', count: 1773 },
  { brand: 'Mercedes-Benz', code: 'W140', count: 1488 },
  { brand: 'Mercedes-Benz', code: 'W463', count: 1407 },
  { brand: 'Mercedes-Benz', code: 'W221', count: 1406 },
  { brand: 'Mercedes-Benz', code: 'W220', count: 1223 },
  { brand: 'Mercedes-Benz', code: 'W116', count: 1101 },
  { brand: 'Mercedes-Benz', code: 'R129', count: 818 },
  { brand: 'Mercedes-Benz', code: 'W222', count: 723 },
  
  // Lamborghini - Top models
  { brand: 'Lamborghini', code: 'Gallardo', count: 185, isModel: true },
  { brand: 'Lamborghini', code: 'Huracán LP 610-4', count: 121, isModel: true },
  { brand: 'Lamborghini', code: 'Aventador LP 700-4', count: 120, isModel: true },
  { brand: 'Lamborghini', code: 'Murciélago', count: 103, isModel: true },
  { brand: 'Lamborghini', code: 'Urus', count: 80, isModel: true },
  { brand: 'Lamborghini', code: 'Diablo', count: 78, isModel: true },
  { brand: 'Lamborghini', code: 'Countach', count: 50, isModel: true },
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

function parseVehicleListPage(html: string, chassisCode: string): MovieAppearance[] {
  const appearances: MovieAppearance[] = [];
  
  // Each vehicle entry is in a ThumbnailBox div
  // Pattern: <div class="ThumbnailBox WithTitle">
  //   <a href="vehicle_89288-BMW-3-E46.html" class="Thumbnail">
  //   <img src="/t089288.jpg" ...>
  //   BMW 3 [E46] in <a href="movie_304391-La-mentale.html">La mentale</a>, 2002
  //   <span class="Stars">...</span>
  // </div>
  
  const boxPattern = /<div class="ThumbnailBox[^"]*">([\s\S]*?)<\/div>\s*(?=<div class="ThumbnailBox|<\/div><div class="GalleryFooter)/gi;
  
  let boxMatch;
  while ((boxMatch = boxPattern.exec(html)) !== null) {
    const box = boxMatch[1];
    
    // Extract vehicle link and ID
    const vehicleMatch = box.match(/href="(vehicle_(\d+)[^"]+\.html)"/i);
    if (!vehicleMatch) continue;
    
    const vehicleUrl = vehicleMatch[1];
    const vehicleId = vehicleMatch[2];
    
    // Extract thumbnail
    const thumbMatch = box.match(/src="(\/t\d+\.jpg)"/i);
    const thumbnailUrl = thumbMatch ? `https://www.imcdb.org${thumbMatch[1]}` : '';
    
    // Extract vehicle model (e.g., "BMW 3 [E46]" or "BMW M3 [E46]")
    const modelMatch = box.match(/>([^<]+)<\/a>\s*\[/);
    const vehicleModel = modelMatch ? modelMatch[1].trim() : '';
    
    // Extract movie link, title and year
    const movieMatch = box.match(/href="(movie_(\d+)[^"]+\.html)"[^>]*>([^<]+)<\/a>(?:,\s*(\d{4}(?:-\d{4})?)?)?/i);
    if (!movieMatch) continue;
    
    const movieUrl = movieMatch[1];
    const movieId = movieMatch[2];
    const movieTitle = movieMatch[3].trim();
    
    // Year might be after the movie link
    const yearMatch = box.match(/movie_[^"]+\.html"[^>]*>[^<]+<\/a>,?\s*(\d{4}(?:-\d{4})?)/i);
    const movieYear = yearMatch ? yearMatch[1] : null;
    
    // Count stars (importance rating)
    const starsMatch = box.match(/star\.png/gi);
    const stars = starsMatch ? starsMatch.length : 0;
    
    appearances.push({
      vehicle_id: vehicleId,
      vehicle_model: vehicleModel,
      chassis_code: chassisCode,
      movie_id: movieId,
      movie_title: movieTitle,
      movie_year: movieYear,
      stars: stars,
      vehicle_url: `https://www.imcdb.org/${vehicleUrl}`,
      movie_url: `https://www.imcdb.org/${movieUrl}`,
      thumbnail_url: thumbnailUrl
    });
  }
  
  return appearances;
}

function getTotalPages(html: string): number {
  // Look for "Page 1/99" in title
  const pageMatch = html.match(/Page\s+\d+\/(\d+)/i);
  if (pageMatch) {
    return parseInt(pageMatch[1], 10);
  }
  return 1;
}

async function scrapeChassisDetail(brand: string, code: string, isModel: boolean = false): Promise<ChassisDetail> {
  const encodedCode = encodeURIComponent(code);
  const encodedBrand = encodeURIComponent(brand);
  
  let baseUrl: string;
  if (isModel) {
    baseUrl = `https://www.imcdb.org/vehicles.php?make=${encodedBrand}&model=${encodedCode}&modelMatch=1&modelInclModel=on`;
  } else {
    baseUrl = `https://www.imcdb.org/vehicles.php?make=${encodedBrand}&model=${encodedCode}&modelMatch=2&modelInclChassis=on`;
  }
  
  console.log(`  Fetching page 1...`);
  const firstPageHtml = await fetchPage(baseUrl);
  
  const totalPages = getTotalPages(firstPageHtml);
  console.log(`    Found ${totalPages} pages`);
  
  let allAppearances = parseVehicleListPage(firstPageHtml, code);
  console.log(`    Page 1: ${allAppearances.length} entries`);
  
  // Scrape remaining pages (limit to first 10 pages for speed)
  const maxPages = Math.min(totalPages, 10);
  
  for (let page = 2; page <= maxPages; page++) {
    await delay(300); // Polite delay
    
    const pageUrl = `${baseUrl}&page=${page}`;
    try {
      const pageHtml = await fetchPage(pageUrl);
      const pageAppearances = parseVehicleListPage(pageHtml, code);
      allAppearances.push(...pageAppearances);
      
      if (page % 5 === 0 || page === maxPages) {
        console.log(`    Page ${page}/${maxPages}: total ${allAppearances.length} entries`);
      }
    } catch (error) {
      console.log(`    Error on page ${page}: ${error}`);
      break;
    }
  }
  
  return {
    brand,
    chassis_code: code,
    total_count: allAppearances.length,
    pages_scraped: maxPages,
    appearances: allAppearances,
    scraped_at: new Date().toISOString()
  };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       FLM AUTO - IMCDB DETAIL SCRAPER v2                   ║');
  console.log('║       Scraping movie appearances for top chassis           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log(`\nWill scrape ${TOP_CHASSIS.length} chassis/models (first 10 pages each)\n`);
  
  const allDetails: ChassisDetail[] = [];
  let totalAppearances = 0;
  
  for (let i = 0; i < TOP_CHASSIS.length; i++) {
    const chassis = TOP_CHASSIS[i];
    console.log(`\n[${i + 1}/${TOP_CHASSIS.length}] ${chassis.brand} ${chassis.code} (expected: ~${chassis.count})`);
    
    try {
      const detail = await scrapeChassisDetail(chassis.brand, chassis.code, (chassis as any).isModel);
      allDetails.push(detail);
      totalAppearances += detail.total_count;
      
      console.log(`  ✓ Scraped ${detail.total_count} appearances from ${detail.pages_scraped} pages`);
      
      // Show sample
      if (detail.appearances.length > 0) {
        const samples = detail.appearances.slice(0, 3);
        samples.forEach(a => {
          const stars = '★'.repeat(a.stars) + '☆'.repeat(5 - a.stars);
          console.log(`    ${stars} "${a.movie_title}" (${a.movie_year || '?'})`);
        });
      }
      
      // Save individual file
      const filename = `${chassis.brand.toLowerCase().replace(/[^a-z]/g, '-')}_${chassis.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}_detail.json`;
      fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(detail, null, 2));
      
      // Polite delay between chassis
      await delay(500);
      
    } catch (error) {
      console.log(`  ✗ Error: ${error}`);
    }
  }
  
  // Save combined file
  const combinedFile = path.join(DATA_DIR, 'all_chassis_details.json');
  fs.writeFileSync(combinedFile, JSON.stringify({
    scraped_at: new Date().toISOString(),
    total_chassis: allDetails.length,
    total_appearances: totalAppearances,
    details: allDetails
  }, null, 2));
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SCRAPE COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total chassis scraped: ${allDetails.length}`);
  console.log(`Total appearances: ${totalAppearances.toLocaleString()}`);
  
  // By brand
  const byBrand: Record<string, number> = {};
  allDetails.forEach(d => {
    byBrand[d.brand] = (byBrand[d.brand] || 0) + d.total_count;
  });
  console.log('\nBy brand:');
  Object.entries(byBrand).forEach(([brand, count]) => {
    console.log(`  ${brand}: ${count.toLocaleString()}`);
  });
  
  // Top movies
  const movieCounts: Record<string, { title: string; year: string | null; count: number }> = {};
  allDetails.forEach(d => {
    d.appearances.forEach(a => {
      const key = a.movie_id;
      if (!movieCounts[key]) {
        movieCounts[key] = { title: a.movie_title, year: a.movie_year, count: 0 };
      }
      movieCounts[key].count++;
    });
  });
  
  const topMovies = Object.values(movieCounts).sort((a, b) => b.count - a.count).slice(0, 10);
  console.log('\nTop 10 movies by vehicle count:');
  topMovies.forEach((m, i) => {
    console.log(`  ${i + 1}. "${m.title}" (${m.year || '?'}): ${m.count} vehicles`);
  });
  
  console.log(`\nData saved to: ${DATA_DIR}`);
  console.log('✓ Done!');
}

main().catch(console.error);
