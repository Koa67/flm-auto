/**
 * FLM AUTO - YouTube Video Scraper
 * 
 * Fetches videos for each vehicle model from known automotive channels
 * Uses YouTube Data API v3
 * 
 * Setup:
 * 1. Get API key from Google Cloud Console
 * 2. Enable YouTube Data API v3
 * 3. Set YOUTUBE_API_KEY env variable
 * 
 * Usage: YOUTUBE_API_KEY=xxx npx ts-node scrape-youtube-videos.ts
 */

import * as fs from 'fs';

const API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Load channels from our curated list
const channelsFile = '../data/youtube_channels.json';
const channelData = JSON.parse(fs.readFileSync(channelsFile, 'utf-8'));

// Priority channels for searching (high quality, consistent naming)
const PRIORITY_CHANNELS = [
  '@carwow',
  '@DougDeMuro', 
  '@ThrottleHouse',
  '@TheStraightPipes',
  '@savagegeese',
  '@autogefuehl',
  '@OutofSpecReviews',
  '@TheCarCareNut',
  '@EngineeringExplained',
  '@LeVendeurAutomobiles',
  '@poatv',
  '@bjornnyland',
];

// Vehicle models to search for
const VEHICLES_TO_SEARCH = [
  // BMW
  { brand: 'BMW', model: '3 Series', searchTerms: ['BMW 3 Series', 'BMW 320i', 'BMW 330i', 'BMW M340i'] },
  { brand: 'BMW', model: '5 Series', searchTerms: ['BMW 5 Series', 'BMW 530i', 'BMW 540i', 'BMW M550i'] },
  { brand: 'BMW', model: 'X3', searchTerms: ['BMW X3', 'BMW X3 M40i'] },
  { brand: 'BMW', model: 'X5', searchTerms: ['BMW X5', 'BMW X5 M50i', 'BMW X5 M'] },
  { brand: 'BMW', model: 'iX', searchTerms: ['BMW iX', 'BMW iX xDrive50'] },
  { brand: 'BMW', model: 'i4', searchTerms: ['BMW i4', 'BMW i4 M50'] },
  
  // Mercedes
  { brand: 'Mercedes-Benz', model: 'C-Class', searchTerms: ['Mercedes C-Class', 'Mercedes C300', 'Mercedes AMG C43'] },
  { brand: 'Mercedes-Benz', model: 'E-Class', searchTerms: ['Mercedes E-Class', 'Mercedes E350', 'Mercedes AMG E53'] },
  { brand: 'Mercedes-Benz', model: 'S-Class', searchTerms: ['Mercedes S-Class', 'Mercedes S500', 'Mercedes S580'] },
  { brand: 'Mercedes-Benz', model: 'GLC', searchTerms: ['Mercedes GLC', 'Mercedes GLC 300', 'Mercedes AMG GLC 43'] },
  { brand: 'Mercedes-Benz', model: 'EQS', searchTerms: ['Mercedes EQS', 'Mercedes EQS SUV'] },
  
  // Audi
  { brand: 'Audi', model: 'A4', searchTerms: ['Audi A4', 'Audi S4', 'Audi RS4'] },
  { brand: 'Audi', model: 'A6', searchTerms: ['Audi A6', 'Audi S6', 'Audi RS6'] },
  { brand: 'Audi', model: 'Q5', searchTerms: ['Audi Q5', 'Audi SQ5'] },
  { brand: 'Audi', model: 'Q7', searchTerms: ['Audi Q7', 'Audi SQ7'] },
  { brand: 'Audi', model: 'e-tron GT', searchTerms: ['Audi e-tron GT', 'Audi RS e-tron GT'] },
  
  // VW
  { brand: 'Volkswagen', model: 'Golf', searchTerms: ['VW Golf', 'Volkswagen Golf', 'Golf R', 'Golf GTI'] },
  { brand: 'Volkswagen', model: 'Tiguan', searchTerms: ['VW Tiguan', 'Volkswagen Tiguan'] },
  { brand: 'Volkswagen', model: 'ID.4', searchTerms: ['VW ID.4', 'Volkswagen ID.4', 'ID4'] },
  
  // Porsche
  { brand: 'Porsche', model: '911', searchTerms: ['Porsche 911', 'Porsche 911 Carrera', 'Porsche 911 Turbo'] },
  { brand: 'Porsche', model: 'Cayenne', searchTerms: ['Porsche Cayenne', 'Cayenne Turbo'] },
  { brand: 'Porsche', model: 'Taycan', searchTerms: ['Porsche Taycan', 'Taycan Turbo S'] },
  { brand: 'Porsche', model: 'Macan', searchTerms: ['Porsche Macan', 'Macan S', 'Macan GTS'] },
  
  // Tesla
  { brand: 'Tesla', model: 'Model 3', searchTerms: ['Tesla Model 3', 'Model 3 Performance', 'Model 3 Highland'] },
  { brand: 'Tesla', model: 'Model Y', searchTerms: ['Tesla Model Y', 'Model Y Performance'] },
  { brand: 'Tesla', model: 'Model S', searchTerms: ['Tesla Model S', 'Model S Plaid'] },
  
  // Hyundai
  { brand: 'Hyundai', model: 'Ioniq 5', searchTerms: ['Hyundai Ioniq 5', 'Ioniq 5 N'] },
  { brand: 'Hyundai', model: 'Ioniq 6', searchTerms: ['Hyundai Ioniq 6'] },
  { brand: 'Hyundai', model: 'Tucson', searchTerms: ['Hyundai Tucson', 'Tucson Hybrid'] },
  
  // Volvo
  { brand: 'Volvo', model: 'XC60', searchTerms: ['Volvo XC60'] },
  { brand: 'Volvo', model: 'XC90', searchTerms: ['Volvo XC90'] },
  { brand: 'Volvo', model: 'EX30', searchTerms: ['Volvo EX30'] },
  
  // Skoda
  { brand: 'Skoda', model: 'Octavia', searchTerms: ['Skoda Octavia', 'Octavia RS'] },
  { brand: 'Skoda', model: 'Kodiaq', searchTerms: ['Skoda Kodiaq'] },
  { brand: 'Skoda', model: 'Enyaq', searchTerms: ['Skoda Enyaq', 'Enyaq iV'] },
];

interface YouTubeVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  description: string;
  thumbnailUrl: string;
  viewCount?: number;
  likeCount?: number;
  duration?: string;
}

interface VehicleVideos {
  brand: string;
  model: string;
  videos: YouTubeVideo[];
  searchTermsUsed: string[];
  scrapedAt: string;
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function searchYouTube(query: string, maxResults: number = 10): Promise<YouTubeVideo[]> {
  const url = `${BASE_URL}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&order=relevance&key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      console.log(`   ⚠️ API error: ${error.error?.message || response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    return (data.items || []).map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
    }));
    
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
    return [];
  }
}

async function getVideoDetails(videoIds: string[]): Promise<Map<string, any>> {
  const details = new Map();
  
  // Batch in groups of 50 (API limit)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = `${BASE_URL}/videos?part=statistics,contentDetails&id=${batch.join(',')}&key=${API_KEY}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      
      const data = await response.json();
      for (const item of data.items || []) {
        details.set(item.id, {
          viewCount: parseInt(item.statistics?.viewCount || '0'),
          likeCount: parseInt(item.statistics?.likeCount || '0'),
          duration: item.contentDetails?.duration,
        });
      }
    } catch (e) {
      // Skip errors
    }
    
    await delay(100);
  }
  
  return details;
}

function filterRelevantVideos(videos: YouTubeVideo[], brand: string, model: string): YouTubeVideo[] {
  const brandLower = brand.toLowerCase();
  const modelLower = model.toLowerCase();
  
  return videos.filter(v => {
    const titleLower = v.title.toLowerCase();
    
    // Must contain brand or model
    const hasBrand = titleLower.includes(brandLower) || 
                     (brandLower === 'volkswagen' && titleLower.includes('vw')) ||
                     (brandLower === 'mercedes-benz' && titleLower.includes('mercedes'));
    const hasModel = titleLower.includes(modelLower);
    
    // Filter out shorts and non-reviews
    const isShort = v.title.toLowerCase().includes('#shorts') || v.description?.includes('#shorts');
    const isReview = titleLower.includes('review') || 
                     titleLower.includes('test') || 
                     titleLower.includes('essai') ||
                     titleLower.includes('drive') ||
                     titleLower.includes('comparison') ||
                     titleLower.includes('vs');
    
    return (hasBrand || hasModel) && !isShort;
  });
}

async function main() {
  console.log('🎬 FLM AUTO - YouTube Video Scraper\n');

  // --only flag: comma-separated list of "Brand Model" to scrape
  const onlyArg = process.argv.find(a => a.startsWith('--only'));
  let onlyFilter: string[] | null = null;
  if (onlyArg) {
    // Support both --only="X,Y" and --only X,Y
    const val = onlyArg.includes('=') ? onlyArg.split('=')[1] : process.argv[process.argv.indexOf(onlyArg) + 1];
    if (val) onlyFilter = val.split(',').map(s => s.trim().toLowerCase());
  }

  if (!API_KEY) {
    console.log('❌ YOUTUBE_API_KEY not set!\n');
    console.log('To get an API key:');
    console.log('1. Go to https://console.cloud.google.com/');
    console.log('2. Create a project');
    console.log('3. Enable "YouTube Data API v3"');
    console.log('4. Create credentials (API key)');
    console.log('5. Run: YOUTUBE_API_KEY=xxx npx ts-node scrape-youtube-videos.ts');
    
    // Generate sample data without API
    console.log('\n📝 Generating sample data structure...\n');
    
    const sampleData: VehicleVideos[] = VEHICLES_TO_SEARCH.slice(0, 5).map(v => ({
      brand: v.brand,
      model: v.model,
      videos: [
        {
          videoId: 'sample_' + Math.random().toString(36).substr(2, 9),
          title: `${v.brand} ${v.model} Review - Sample`,
          channelId: 'UCsample',
          channelTitle: 'Sample Channel',
          publishedAt: new Date().toISOString(),
          description: 'Sample video description',
          thumbnailUrl: 'https://i.ytimg.com/vi/sample/hqdefault.jpg',
        }
      ],
      searchTermsUsed: v.searchTerms,
      scrapedAt: new Date().toISOString(),
    }));
    
    const outputFile = '../data/youtube_videos_sample.json';
    fs.writeFileSync(outputFile, JSON.stringify(sampleData, null, 2));
    console.log(`📁 Sample saved to: ${outputFile}`);
    return;
  }
  
  console.log(`🔑 API key loaded (${API_KEY.substring(0, 8)}...)\n`);
  // Filter vehicles if --only is set
  const vehiclesToProcess = onlyFilter
    ? VEHICLES_TO_SEARCH.filter(v => onlyFilter!.some(f => `${v.brand} ${v.model}`.toLowerCase().includes(f)))
    : VEHICLES_TO_SEARCH;

  console.log(`📊 Searching for ${vehiclesToProcess.length} vehicle models${onlyFilter ? ` (filtered: ${onlyFilter.join(', ')})` : ''}\n`);
  
  const allResults: VehicleVideos[] = [];
  let totalVideos = 0;
  let quotaUsed = 0; // Search costs 100 units, video details cost 1 unit per video
  
  for (const vehicle of vehiclesToProcess) {
    console.log(`🚗 ${vehicle.brand} ${vehicle.model}...`);
    
    const vehicleVideos: YouTubeVideo[] = [];
    const seenIds = new Set<string>();
    
    let quotaExhausted = false;

    // Search with each term
    for (const term of vehicle.searchTerms) {
      // Add "review" to get better results
      const searchQuery = `${term} review`;
      
      await delay(200); // Rate limit
      quotaUsed += 100;
      
      const results = await searchYouTube(searchQuery, 15);

      // Detect quota exhaustion: if first search for a vehicle returns 0 results, bail early
      if (results.length === 0 && term === vehicle.searchTerms[0]) {
        quotaExhausted = true;
        break;
      }
      
      // Filter and dedupe
      const filtered = filterRelevantVideos(results, vehicle.brand, vehicle.model);
      for (const video of filtered) {
        if (!seenIds.has(video.videoId)) {
          seenIds.add(video.videoId);
          vehicleVideos.push(video);
        }
      }
    }
    
    // Get video details (views, likes)
    if (vehicleVideos.length > 0) {
      const details = await getVideoDetails(vehicleVideos.map(v => v.videoId));
      quotaUsed += vehicleVideos.length;
      
      for (const video of vehicleVideos) {
        const d = details.get(video.videoId);
        if (d) {
          video.viewCount = d.viewCount;
          video.likeCount = d.likeCount;
          video.duration = d.duration;
        }
      }
      
      // Sort by views
      vehicleVideos.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }
    
    // Keep top 20 per vehicle
    const topVideos = vehicleVideos.slice(0, 20);
    totalVideos += topVideos.length;
    
    allResults.push({
      brand: vehicle.brand,
      model: vehicle.model,
      videos: topVideos,
      searchTermsUsed: vehicle.searchTerms,
      scrapedAt: new Date().toISOString(),
    });
    
    console.log(`   ✅ ${topVideos.length} videos found`);

    // Stop if quota is exhausted (2 consecutive vehicles with 0 results)
    if (quotaExhausted && topVideos.length === 0) {
      console.log('\n⚠️ Quota exhausted — stopping to preserve existing data.');
      break;
    }
    
    // Check quota (10,000 units/day default)
    if (quotaUsed > 9000) {
      console.log('\n⚠️ Approaching quota limit, stopping...');
      break;
    }
  }
  
  // Save results — MERGE with existing file to avoid overwriting previous runs
  const outputFile = '../data/youtube_videos.json';
  let existingData: any = { metadata: {}, vehicles: [] };
  if (fs.existsSync(outputFile)) {
    try { existingData = JSON.parse(fs.readFileSync(outputFile, 'utf-8')); } catch (e) {}
  }
  const existingVehicles: VehicleVideos[] = existingData.vehicles || [];

  // Merge: replace vehicles we just scraped, keep the rest
  const mergedMap = new Map<string, VehicleVideos>();
  for (const v of existingVehicles) mergedMap.set(`${v.brand}|${v.model}`, v);
  for (const v of allResults) {
    if (v.videos.length > 0) mergedMap.set(`${v.brand}|${v.model}`, v); // only overwrite if we got results
  }
  const mergedVehicles = [...mergedMap.values()];
  const mergedTotal = mergedVehicles.reduce((sum, v) => sum + v.videos.length, 0);

  fs.writeFileSync(outputFile, JSON.stringify({
    metadata: {
      scrapedAt: new Date().toISOString(),
      totalVehicles: mergedVehicles.length,
      totalVideos: mergedTotal,
      quotaUsed: quotaUsed,
      note: onlyFilter ? `Incremental run: ${onlyFilter.join(', ')}` : 'Full run',
    },
    vehicles: mergedVehicles,
  }, null, 2));
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Scraping Complete:');
  console.log('═'.repeat(50));
  console.log(`   Vehicles processed: ${allResults.length}`);
  console.log(`   Total videos: ${totalVideos}`);
  console.log(`   API quota used: ~${quotaUsed} units`);
  console.log(`\n📁 Saved to: ${outputFile}`);
  
  // Create by-model index for quick lookup
  const byModel: Record<string, string[]> = {};
  for (const v of allResults) {
    const key = `${v.brand}_${v.model}`.toLowerCase().replace(/ /g, '-');
    byModel[key] = v.videos.map(vid => vid.videoId);
  }
  
  const indexFile = '../data/youtube_by_model.json';
  fs.writeFileSync(indexFile, JSON.stringify(byModel, null, 2));
  console.log(`📁 Index saved to: ${indexFile}`);
}

main().catch(console.error);
