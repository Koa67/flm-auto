/**
 * FLM AUTO - Euro NCAP Safety Ratings Scraper v2
 * Fixed parsing for actual HTML structure
 */

import * as fs from 'fs';
import * as path from 'path';

interface EuroNCAPRating {
  euroncap_id: string;
  make: string;
  model: string;
  year: number;
  stars: number;
  adult_occupant_pct: number | null;
  child_occupant_pct: number | null;
  pedestrian_pct: number | null;
  safety_assist_pct: number | null;
  test_year: number;
  url: string;
}

// Known Euro NCAP result pages
const KNOWN_RESULTS: { make: string; model: string; id: string }[] = [
  // BMW
  { make: 'BMW', model: '1 Series', id: '56148' },
  { make: 'BMW', model: '2 Series Gran Coupe', id: '40387' },
  { make: 'BMW', model: '3 Series', id: '35258' },
  { make: 'BMW', model: '5 Series', id: '50186' },
  { make: 'BMW', model: '7 Series', id: '51911' },
  { make: 'BMW', model: 'X1', id: '47128' },
  { make: 'BMW', model: 'X2', id: '51929' },
  { make: 'BMW', model: 'X3', id: '44198' },
  { make: 'BMW', model: 'X5', id: '35262' },
  { make: 'BMW', model: 'i3', id: '8863' },
  { make: 'BMW', model: 'i4', id: '46241' },
  { make: 'BMW', model: 'iX', id: '44196' },
  { make: 'BMW', model: 'iX1', id: '47130' },
  { make: 'BMW', model: 'iX3', id: '42037' },
  // Mercedes-Benz
  { make: 'Mercedes-Benz', model: 'A-Class', id: '34567' },
  { make: 'Mercedes-Benz', model: 'B-Class', id: '37570' },
  { make: 'Mercedes-Benz', model: 'C-Class', id: '35259' },
  { make: 'Mercedes-Benz', model: 'E-Class', id: '51910' },
  { make: 'Mercedes-Benz', model: 'S-Class', id: '44195' },
  { make: 'Mercedes-Benz', model: 'CLA', id: '58934' },
  { make: 'Mercedes-Benz', model: 'GLA', id: '35265' },
  { make: 'Mercedes-Benz', model: 'GLB', id: '39457' },
  { make: 'Mercedes-Benz', model: 'GLE', id: '35263' },
  { make: 'Mercedes-Benz', model: 'EQA', id: '43281' },
  { make: 'Mercedes-Benz', model: 'EQB', id: '44197' },
  { make: 'Mercedes-Benz', model: 'EQC', id: '38546' },
  { make: 'Mercedes-Benz', model: 'EQE', id: '46237' },
  { make: 'Mercedes-Benz', model: 'EQE SUV', id: '50192' },
  { make: 'Mercedes-Benz', model: 'EQS', id: '44194' },
  { make: 'Mercedes-Benz', model: 'EQS SUV', id: '47127' },
  { make: 'Mercedes-Benz', model: 'T-Class', id: '47129' },
  { make: 'Mercedes-Benz', model: 'V-Class', id: '7875' },
];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function parseRatings(html: string, make: string, model: string, id: string): EuroNCAPRating | null {
  try {
    // Extract test year
    let testYear = 2020;
    const pubMatch = html.match(/Publication[:\s]*(\w+\s+)?(\d{4})/i);
    if (pubMatch) testYear = parseInt(pubMatch[2]);
    
    // Extract star rating
    let stars = 5;
    const starsMatch = html.match(/(\d)\s*star/i);
    if (starsMatch) stars = parseInt(starsMatch[1]);
    
    // The HTML has patterns like:
    // "Total 35.6 Pts / 89%" for Adult
    // "Total 42.0 Pts / 85%" for Child
    // etc.
    
    // Also look for patterns like:
    // "89%" right after "Adult Occupant" or in rating sections
    
    // Pattern 1: "Total X.X Pts / XX%"
    const totalPtsMatches = html.matchAll(/Total\s+([\d.]+)\s*Pts\s*\/\s*(\d+)%/gi);
    const scores: number[] = [];
    for (const match of totalPtsMatches) {
      scores.push(parseInt(match[2]));
    }
    
    // Pattern 2: Look in structured sections
    // The HTML has sections with adult-occupant, child-occupant, pedestrian, safety-assist
    const adultMatch = html.match(/adult[^%]*?(\d{2})%/i) || 
                       html.match(/Adult Occupant[^0-9]*(\d{2})%/i);
    const childMatch = html.match(/child[^%]*?(\d{2})%/i) ||
                       html.match(/Child Occupant[^0-9]*(\d{2})%/i);
    const vruMatch = html.match(/(?:pedestrian|vulnerable|vru)[^%]*?(\d{2})%/i) ||
                     html.match(/Vulnerable Road User[^0-9]*(\d{2})%/i);
    const safetyMatch = html.match(/safety.?assist[^%]*?(\d{2})%/i) ||
                        html.match(/Safety Assist[^0-9]*(\d{2})%/i);
    
    // Use the scores array if we found 4 scores in order
    let adultPct = adultMatch ? parseInt(adultMatch[1]) : (scores[0] || null);
    let childPct = childMatch ? parseInt(childMatch[1]) : (scores[1] || null);
    let pedPct = vruMatch ? parseInt(vruMatch[1]) : (scores[2] || null);
    let safetyPct = safetyMatch ? parseInt(safetyMatch[1]) : (scores[3] || null);
    
    // Validate scores are realistic (50-100%)
    if (adultPct && (adultPct < 50 || adultPct > 100)) adultPct = null;
    if (childPct && (childPct < 50 || childPct > 100)) childPct = null;
    if (pedPct && (pedPct < 50 || pedPct > 100)) pedPct = null;
    if (safetyPct && (safetyPct < 50 || safetyPct > 100)) safetyPct = null;
    
    const modelSlug = model.toLowerCase().replace(/\s+/g, '+');
    const makeSlug = make.toLowerCase().replace(/\s+/g, '-');
    
    return {
      euroncap_id: id,
      make,
      model,
      year: testYear,
      stars,
      adult_occupant_pct: adultPct,
      child_occupant_pct: childPct,
      pedestrian_pct: pedPct,
      safety_assist_pct: safetyPct,
      test_year: testYear,
      url: `https://www.euroncap.com/en/results/${makeSlug}/${modelSlug}/${id}`
    };
  } catch {
    return null;
  }
}

async function scrapeAllRatings(): Promise<EuroNCAPRating[]> {
  const ratings: EuroNCAPRating[] = [];
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       FLM AUTO - Euro NCAP Safety Ratings Scraper v2       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Scraping ${KNOWN_RESULTS.length} known result pages...\n`);
  
  for (const result of KNOWN_RESULTS) {
    const modelSlug = result.model.toLowerCase().replace(/\s+/g, '+');
    const makeSlug = result.make.toLowerCase().replace(/\s+/g, '-');
    const url = `https://www.euroncap.com/en/results/${makeSlug}/${modelSlug}/${result.id}`;
    
    process.stdout.write(`${result.make} ${result.model}... `);
    
    const html = await fetchPage(url);
    if (html) {
      const rating = parseRatings(html, result.make, result.model, result.id);
      if (rating) {
        ratings.push(rating);
        const a = rating.adult_occupant_pct ?? '?';
        const c = rating.child_occupant_pct ?? '?';
        const p = rating.pedestrian_pct ?? '?';
        const s = rating.safety_assist_pct ?? '?';
        console.log(`✓ ${rating.stars}★ | ${a}% | ${c}% | ${p}% | ${s}%`);
      } else {
        console.log('✗ Parse failed');
      }
    } else {
      console.log('✗ 404');
    }
    
    await delay(350);
  }
  
  return ratings;
}

async function saveToFile(ratings: EuroNCAPRating[]): Promise<void> {
  const outputDir = path.join(process.cwd(), 'data', 'euroncap');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'safety_ratings.json');
  fs.writeFileSync(outputPath, JSON.stringify(ratings, null, 2));
  console.log(`\nSaved ${ratings.length} ratings to ${outputPath}`);
}

async function main(): Promise<void> {
  const ratings = await scrapeAllRatings();
  
  console.log('\n============================================================');
  console.log('SCRAPE COMPLETE');
  console.log('============================================================');
  console.log(`Total ratings: ${ratings.length}`);
  
  const byMake: Record<string, number> = {};
  for (const r of ratings) {
    byMake[r.make] = (byMake[r.make] || 0) + 1;
  }
  console.log('\nBy make:');
  for (const [make, count] of Object.entries(byMake)) {
    console.log(`  ${make}: ${count}`);
  }
  
  // Count how many have full data
  const complete = ratings.filter(r => 
    r.adult_occupant_pct && r.child_occupant_pct && r.pedestrian_pct && r.safety_assist_pct
  ).length;
  console.log(`\nComplete data: ${complete}/${ratings.length}`);
  
  await saveToFile(ratings);
  console.log('\n✓ Done!');
}

main().catch(console.error);
