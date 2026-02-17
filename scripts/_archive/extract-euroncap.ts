import * as https from 'https';

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
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

async function main() {
  const html = await fetchPage('https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/');
  
  // Look for rating cards or vehicle data
  console.log('Searching for rating patterns...\n');

  // Pattern 1: Look for star ratings
  const starMatches = html.match(/(\d)\s*star|star[s]?\s*:\s*(\d)/gi);
  console.log(`Star mentions: ${starMatches?.length || 0}`);
  if (starMatches) console.log('Samples:', starMatches.slice(0, 5));

  // Pattern 2: Look for JSON embedded data
  const jsonMatches = html.match(/\{[^{}]*"[Mm]odel"[^{}]*\}/g);
  console.log(`\nJSON with model: ${jsonMatches?.length || 0}`);
  if (jsonMatches) console.log('Sample:', jsonMatches[0]?.slice(0, 200));

  // Pattern 3: Look for vehicle links
  const linkMatches = html.match(/href="\/en\/results\/[^"]+"/g);
  console.log(`\nResult links: ${linkMatches?.length || 0}`);
  if (linkMatches) console.log('Samples:', linkMatches.slice(0, 10));

  // Pattern 4: Check for NG data binding
  const ngMatches = html.match(/ng-repeat="[^"]+"/g);
  console.log(`\nNG repeats: ${ngMatches?.length || 0}`);
  if (ngMatches) console.log('Samples:', ngMatches.slice(0, 5));

  // Pattern 5: Look for initial data
  const initDataMatch = html.match(/var\s+\w+\s*=\s*\[[\s\S]{100,10000}?\];/);
  if (initDataMatch) {
    console.log('\nFound initial data var!');
    console.log(initDataMatch[0].slice(0, 500));
  }

  // Pattern 6: Look for rating cards HTML structure
  const cardMatch = html.match(/<div[^>]*class="[^"]*rating[^"]*card[^"]*"[^>]*>[\s\S]{0,2000}?<\/div>/gi);
  console.log(`\nRating cards: ${cardMatch?.length || 0}`);
  if (cardMatch) console.log('Sample:', cardMatch[0]?.slice(0, 300));

  // Pattern 7: Extract brand/model from dropdown
  const dropdownBrands = html.match(/data-customdropdownvalue="([^"]+)"/gi);
  console.log(`\nBrands in dropdown: ${dropdownBrands?.length || 0}`);
}

main();
