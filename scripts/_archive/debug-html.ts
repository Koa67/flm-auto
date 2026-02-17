import * as https from 'https';

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function debug() {
  const html = await fetchPage('https://www.auto-data.net/en/bmw-3-series-sedan-g20-lci-facelift-2022-m340i-382hp-mild-hybrid-steptronic-53477');
  
  // Extract the specs table
  const tableMatch = html.match(/<table[^>]*class="[^"]*cardetailsout[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  
  if (tableMatch) {
    // Show raw table HTML structure
    const table = tableMatch[1];
    console.log('TABLE STRUCTURE (first 2000 chars):\n');
    console.log(table.substring(0, 2000));
    
    console.log('\n\n--- Looking for TR patterns ---\n');
    
    // Find first few TR elements
    const trMatches = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    if (trMatches) {
      console.log(`Found ${trMatches.length} TR elements\n`);
      trMatches.slice(0, 5).forEach((tr, i) => {
        console.log(`TR ${i}:`);
        console.log(tr.substring(0, 300));
        console.log('---');
      });
    }
  } else {
    console.log('No table found. Looking for other patterns...');
    
    // Try finding any table
    const anyTable = html.match(/<table[^>]*>([\s\S]{500})/i);
    if (anyTable) {
      console.log('Found a table:');
      console.log(anyTable[0]);
    }
  }
}

debug();
