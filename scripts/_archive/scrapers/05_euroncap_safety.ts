/**
 * FLM AUTO - Euro NCAP Safety Scraper (Toutes les notes)
 * Source: euroncap.com
 * 
 * Run: npx ts-node scripts/scrapers/05_euroncap_safety.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings';
const API_URL = 'https://www.euroncap.com/api/ratings';
const OUTPUT_DIR = '../data/raw/euroncap';

const BRANDS = ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Skoda'];

interface EuroNcapRating {
  brand: string;
  model: string;
  year_tested: number;
  variant_tested: string;
  overall_stars: number;
  adult_occupant_percent: number;
  child_occupant_percent: number;
  vulnerable_road_users_percent: number;
  safety_assist_percent: number;
  // Detailed scores
  frontal_offset: number;
  full_width_frontal: number;
  side_mobile: number;
  side_pole: number;
  far_side: number;
  whiplash_front: number;
  whiplash_rear: number;
  aeb_car_car: number;
  aeb_vulnerable: number;
  speed_assist: number;
  lane_assist: number;
  occupant_status: number;
  // Child specific
  child_6y_frontal: number;
  child_10y_frontal: number;
  child_6y_side: number;
  child_10y_side: number;
  crs_installation: number;
  // Pedestrian
  pedestrian_head: number;
  pedestrian_pelvis: number;
  pedestrian_leg: number;
  cyclist_head: number;
  aeb_pedestrian: number;
  aeb_cyclist: number;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchRatings(): Promise<EuroNcapRating[]> {
  console.log('📊 Fetching Euro NCAP ratings...');
  
  const ratings: EuroNcapRating[] = [];
  
  // Try API first
  try {
    const response = await fetch(`${API_URL}?format=json`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      // Parse API response
      if (Array.isArray(data)) {
        for (const item of data) {
          if (BRANDS.some(b => item.make?.toLowerCase().includes(b.toLowerCase()))) {
            ratings.push({
              brand: item.make,
              model: item.model,
              year_tested: item.year,
              variant_tested: item.variant || '',
              overall_stars: item.stars,
              adult_occupant_percent: item.adultOccupant,
              child_occupant_percent: item.childOccupant,
              vulnerable_road_users_percent: item.vulnerableRoadUsers,
              safety_assist_percent: item.safetyAssist,
              // Fill detailed scores from nested data if available
              frontal_offset: item.details?.frontalOffset || 0,
              full_width_frontal: item.details?.fullWidthFrontal || 0,
              side_mobile: item.details?.sideMobile || 0,
              side_pole: item.details?.sidePole || 0,
              far_side: item.details?.farSide || 0,
              whiplash_front: item.details?.whiplashFront || 0,
              whiplash_rear: item.details?.whiplashRear || 0,
              aeb_car_car: item.details?.aebCarCar || 0,
              aeb_vulnerable: item.details?.aebVulnerable || 0,
              speed_assist: item.details?.speedAssist || 0,
              lane_assist: item.details?.laneAssist || 0,
              occupant_status: item.details?.occupantStatus || 0,
              child_6y_frontal: item.details?.child6yFrontal || 0,
              child_10y_frontal: item.details?.child10yFrontal || 0,
              child_6y_side: item.details?.child6ySide || 0,
              child_10y_side: item.details?.child10ySide || 0,
              crs_installation: item.details?.crsInstallation || 0,
              pedestrian_head: item.details?.pedestrianHead || 0,
              pedestrian_pelvis: item.details?.pedestrianPelvis || 0,
              pedestrian_leg: item.details?.pedestrianLeg || 0,
              cyclist_head: item.details?.cyclistHead || 0,
              aeb_pedestrian: item.details?.aebPedestrian || 0,
              aeb_cyclist: item.details?.aebCyclist || 0,
            });
          }
        }
      }
    }
  } catch (e) {
    console.log('  API not available, using fallback...');
  }
  
  // Fallback: scrape HTML pages
  if (ratings.length === 0) {
    for (const brand of BRANDS) {
      await delay(500);
      const brandSlug = brand.toLowerCase().replace(/\s+/g, '-');
      const url = `https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/?selectedMake=${encodeURIComponent(brand)}`;
      
      try {
        const response = await fetch(url);
        const html = await response.text();
        
        // Parse ratings from HTML
        const ratingRegex = /<div[^>]*class="[^"]*rating-card[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
        let match;
        
        while ((match = ratingRegex.exec(html)) !== null) {
          const card = match[1];
          
          const modelMatch = card.match(/class="model"[^>]*>([^<]+)/);
          const starsMatch = card.match(/(\d)\s*stars?/i);
          const adultMatch = card.match(/adult[^>]*>(\d+)%/i);
          const childMatch = card.match(/child[^>]*>(\d+)%/i);
          
          if (modelMatch && starsMatch) {
            ratings.push({
              brand,
              model: modelMatch[1].trim(),
              year_tested: new Date().getFullYear(),
              variant_tested: '',
              overall_stars: parseInt(starsMatch[1]),
              adult_occupant_percent: adultMatch ? parseInt(adultMatch[1]) : 0,
              child_occupant_percent: childMatch ? parseInt(childMatch[1]) : 0,
              vulnerable_road_users_percent: 0,
              safety_assist_percent: 0,
              frontal_offset: 0, full_width_frontal: 0, side_mobile: 0, side_pole: 0,
              far_side: 0, whiplash_front: 0, whiplash_rear: 0, aeb_car_car: 0,
              aeb_vulnerable: 0, speed_assist: 0, lane_assist: 0, occupant_status: 0,
              child_6y_frontal: 0, child_10y_frontal: 0, child_6y_side: 0, child_10y_side: 0,
              crs_installation: 0, pedestrian_head: 0, pedestrian_pelvis: 0, pedestrian_leg: 0,
              cyclist_head: 0, aeb_pedestrian: 0, aeb_cyclist: 0,
            });
          }
        }
        
        console.log(`  ${brand}: ${ratings.filter(r => r.brand === brand).length} ratings`);
      } catch (e) {
        console.log(`  ⚠️ Failed to fetch ${brand}`);
      }
    }
  }
  
  return ratings;
}

async function main() {
  console.log('🚀 FLM AUTO - Euro NCAP Scraper');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const ratings = await fetchRatings();
  
  // Save by brand
  for (const brand of BRANDS) {
    const brandRatings = ratings.filter(r => r.brand === brand);
    const brandSlug = brand.toLowerCase().replace(/\s+/g, '_');
    const brandFile = path.join(OUTPUT_DIR, `${brandSlug}_safety.json`);
    fs.writeFileSync(brandFile, JSON.stringify(brandRatings, null, 2));
  }
  
  // Save combined
  const combinedFile = path.join(OUTPUT_DIR, 'all_safety_ratings.json');
  fs.writeFileSync(combinedFile, JSON.stringify(ratings, null, 2));
  
  // Summary
  const summary = BRANDS.map(brand => {
    const brandRatings = ratings.filter(r => r.brand === brand);
    const avgStars = brandRatings.length > 0 
      ? (brandRatings.reduce((sum, r) => sum + r.overall_stars, 0) / brandRatings.length).toFixed(1)
      : 'N/A';
    return { brand, count: brandRatings.length, avg_stars: avgStars };
  });
  
  const summaryFile = path.join(OUTPUT_DIR, 'brand_summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  console.log(`\n✅ Total: ${ratings.length} Euro NCAP ratings`);
  console.table(summary);
}

main().catch(console.error);
