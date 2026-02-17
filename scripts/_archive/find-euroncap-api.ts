import * as https from 'https';

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/html',
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
  // Common API patterns for Angular apps
  const apiUrls = [
    'https://www.euroncap.com/api/Ratings/GetLatestRatings',
    'https://www.euroncap.com/api/ratings/latest',
    'https://www.euroncap.com/api/assessments',
    'https://www.euroncap.com/api/results',
    'https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/?ajax=true',
    'https://www.euroncap.com/Ratings/GetLatestRatings',
    'https://cdn.euroncap.com/api/ratings.json',
  ];

  for (const url of apiUrls) {
    console.log(`\n=== ${url} ===`);
    try {
      const data = await fetchPage(url);
      if (data.startsWith('[') || data.startsWith('{')) {
        console.log('JSON response!');
        const parsed = JSON.parse(data);
        console.log('Keys:', Object.keys(parsed).slice(0, 10));
        if (Array.isArray(parsed)) {
          console.log(`Array of ${parsed.length} items`);
          console.log('First item:', JSON.stringify(parsed[0]).slice(0, 300));
        }
      } else {
        console.log(`HTML (${data.length} bytes)`);
      }
    } catch (e: any) {
      console.log(`Error: ${e.message}`);
    }
  }

  // Check the main page for API endpoints in scripts
  console.log('\n=== Searching for API endpoints in page... ===');
  const html = await fetchPage('https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/');
  
  const apiPatterns = html.match(/["']\/api\/[^"']+["']/gi);
  console.log('API patterns found:', apiPatterns?.slice(0, 10));

  const serviceUrls = html.match(/["'][^"']*euroncap[^"']*\.json["']/gi);
  console.log('JSON URLs:', serviceUrls?.slice(0, 5));

  // Look for ng-init or data source
  const ngInit = html.match(/ng-init="[^"]+"/gi);
  console.log('ng-init:', ngInit?.slice(0, 3));

  // Look for controller references
  const controllers = html.match(/ng-controller="([^"]+)"/gi);
  console.log('Controllers:', controllers?.slice(0, 5));
}

main();
