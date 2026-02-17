/**
 * DEBUG: What does UltimateSpecs actually return as model names?
 */
import * as https from 'https';

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : `https://www.ultimatespecs.com${url}`;
    https.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchPage(res.headers.location!).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function debug() {
  console.log('🔍 ULTIMATESPECS URL ANALYSIS\n');
  
  // Fetch BMW models page
  const brandHtml = await fetchPage('/car-specs/BMW-models');
  
  // Extract model links
  const modelRegex = /href="(\/car-specs\/[^"]+\/M\d+\/[^"]+)"/g;
  const modelLinks: string[] = [];
  let m;
  while ((m = modelRegex.exec(brandHtml)) !== null) {
    modelLinks.push(m[1]);
  }
  
  console.log(`BMW model links found: ${modelLinks.length}\n`);
  console.log('Sample URLs and extracted names:\n');
  
  for (const link of modelLinks.slice(0, 15)) {
    // What the scraper extracts as model name
    const modelName = link.split('/').pop()?.replace(/-/g, ' ') || '';
    console.log(`URL: ${link}`);
    console.log(`Extracted: "${modelName}"`);
    console.log('');
  }
}

debug();
