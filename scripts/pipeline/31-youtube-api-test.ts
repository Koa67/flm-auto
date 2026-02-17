/**
 * 31-youtube-api-test.ts — Diagnostic test of YouTube API key
 *
 * Tests the API key with a single search. If 200 → API is available.
 * If 403 → quota exhausted, log and exit gracefully.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/31-youtube-api-test.ts
 */

require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.YOUTUBE_API_KEY;

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  31-YOUTUBE-API-TEST');
  console.log('  Diagnostic test of YouTube Data API v3');
  console.log('='.repeat(60));

  if (!API_KEY) {
    console.log('\n  ❌ YOUTUBE_API_KEY not found in .env.local');
    console.log('  Add: YOUTUBE_API_KEY=AIzaSy...');
    process.exit(1);
  }

  console.log(`\n  API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);

  // Test with a simple search
  const testQuery = 'BMW 3 Series review 2024';
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(testQuery)}&type=video&maxResults=1&key=${API_KEY}`;

  console.log(`  Test query: "${testQuery}"`);

  try {
    const resp = await fetch(url);
    const status = resp.status;
    console.log(`  HTTP status: ${status}`);

    if (status === 200) {
      const data = await resp.json();
      console.log(`  ✅ API is working!`);
      console.log(`  Results: ${data.pageInfo?.totalResults || 0}`);
      if (data.items?.[0]) {
        console.log(`  Sample: "${data.items[0].snippet?.title}"`);
      }
      console.log('\n  YouTube API is available for further scraping.');
      console.log('  You can run script 17 with --limit=90');
    } else if (status === 403) {
      const data = await resp.json();
      const reason = data.error?.errors?.[0]?.reason || 'unknown';
      const message = data.error?.message || 'Quota exceeded';
      console.log(`  ⚠️  403 Forbidden — ${reason}`);
      console.log(`  Message: ${message}`);
      console.log('\n  YouTube API quota exhausted. Not insisting.');
      console.log('  Daily quota resets at midnight Pacific Time.');
    } else {
      const body = await resp.text();
      console.log(`  ⚠️  Unexpected status ${status}`);
      console.log(`  Body: ${body.substring(0, 300)}`);
    }
  } catch (err: any) {
    console.log(`  ❌ Request failed: ${err.message}`);
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
