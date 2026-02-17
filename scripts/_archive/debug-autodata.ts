import * as https from 'https';

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function debug() {
  // 1. Get BMW brand page
  console.log('1. Fetching BMW brand page...');
  const brandHtml = await fetchPage('https://www.auto-data.net/en/bmw-brand-86');
  
  // Find model links
  const modelRegex = /href="(\/en\/bmw-[^"]*-model-\d+)"/g;
  const models: string[] = [];
  let m;
  while ((m = modelRegex.exec(brandHtml)) !== null) {
    models.push(m[1]);
  }
  console.log(`   Found ${models.length} models`);
  console.log(`   Sample: ${models.slice(0, 3).join(', ')}`);
  
  // 2. Get a model page (3 Series)
  const model3Series = models.find(m => m.includes('3-series')) || models[0];
  console.log(`\n2. Fetching model: ${model3Series}`);
  const modelHtml = await fetchPage(`https://www.auto-data.net${model3Series}`);
  
  // Find generation links
  const genRegex = /href="(\/en\/bmw-[^"]*-generation-\d+)"/g;
  const gens: string[] = [];
  while ((m = genRegex.exec(modelHtml)) !== null) {
    gens.push(m[1]);
  }
  console.log(`   Found ${gens.length} generations`);
  console.log(`   Sample: ${gens.slice(0, 3).join(', ')}`);
  
  // 3. Get a generation page (G20)
  const genG20 = gens.find(g => g.includes('g20')) || gens[0];
  console.log(`\n3. Fetching generation: ${genG20}`);
  const genHtml = await fetchPage(`https://www.auto-data.net${genG20}`);
  
  // Find version links - they end with a number ID
  const versionRegex = /href="(\/en\/bmw-3-series[^"]*-\d+)"/g;
  const versions: string[] = [];
  while ((m = versionRegex.exec(genHtml)) !== null) {
    if (!m[1].includes('generation') && !m[1].includes('model')) {
      versions.push(m[1]);
    }
  }
  console.log(`   Found ${versions.length} versions`);
  console.log(`   Sample: ${versions.slice(0, 5).join('\n            ')}`);
  
  // 4. Get a version page
  if (versions.length > 0) {
    console.log(`\n4. Fetching version: ${versions[0]}`);
    const versionHtml = await fetchPage(`https://www.auto-data.net${versions[0]}`);
    
    // Find specs in table
    console.log(`   HTML length: ${versionHtml.length}`);
    
    // Look for table structure
    const tableMatch = versionHtml.match(/<table[^>]*class="[^"]*cardetailsout[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
    if (tableMatch) {
      console.log(`   Found specs table (${tableMatch[1].length} chars)`);
    }
    
    // Try different regex patterns
    const specs: Record<string, string> = {};
    
    // Pattern 1: td pairs
    const tdRegex = /<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]*)/g;
    while ((m = tdRegex.exec(versionHtml)) !== null) {
      const key = m[1].trim();
      const val = m[2].trim();
      if (key && val && key.length < 50) {
        specs[key] = val;
      }
    }
    
    console.log(`   Specs found: ${Object.keys(specs).length}`);
    console.log(`   Sample specs:`);
    Object.entries(specs).slice(0, 10).forEach(([k, v]) => {
      console.log(`      ${k}: ${v.substring(0, 50)}`);
    });
  }
}

debug().catch(console.error);
