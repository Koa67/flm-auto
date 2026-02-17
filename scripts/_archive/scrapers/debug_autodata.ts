/**
 * FLM AUTO - Debug Auto-Data.net structure
 */

import * as fs from 'fs';

const TEST_URL = 'https://www.auto-data.net/en/bmw-brand-23';

async function debug() {
  console.log('🔍 Fetching:', TEST_URL);
  
  const response = await fetch(TEST_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  
  const html = await response.text();
  
  fs.mkdirSync('../data/raw/autodata', { recursive: true });
  fs.writeFileSync('../data/raw/autodata/debug_bmw.html', html);
  console.log('📄 Saved HTML, length:', html.length);
  
  // Find model links
  console.log('\n=== LOOKING FOR MODEL LINKS ===');
  const linkRegex = /href="(\/en\/bmw[^"]+)"/g;
  const links: string[] = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    if (!links.includes(match[1])) {
      links.push(match[1]);
    }
  }
  console.log(`Found ${links.length} unique BMW links`);
  links.slice(0, 20).forEach(l => console.log('  ', l));
  
  // Check for model list structure
  console.log('\n=== STRUCTURE SAMPLE ===');
  const modelSection = html.indexOf('1 Series');
  if (modelSection > 0) {
    console.log(html.substring(modelSection - 200, modelSection + 500));
  }
}

debug().catch(console.error);
