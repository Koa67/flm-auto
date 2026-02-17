import * as https from 'https';

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
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
  
  // Find all script sources
  const scripts = html.match(/src="([^"]+\.js[^"]*)"/gi);
  console.log('Scripts found:', scripts?.length);
  
  const appScripts = scripts?.filter(s => 
    s.includes('app') || s.includes('main') || s.includes('bundle') || s.includes('euroncap')
  );
  console.log('\nApp scripts:', appScripts);

  // Get the main app script
  for (const script of appScripts || []) {
    const url = script.match(/src="([^"]+)"/)?.[1];
    if (!url) continue;
    
    const fullUrl = url.startsWith('http') ? url : `https://www.euroncap.com${url}`;
    console.log(`\n=== Fetching: ${fullUrl} ===`);
    
    try {
      const js = await fetchPage(fullUrl);
      console.log(`Size: ${js.length}`);
      
      // Look for API endpoints
      const apiCalls = js.match(/["'](\/[^"']*(?:rating|assessment|result)[^"']*)["']/gi);
      console.log('API patterns:', [...new Set(apiCalls)]?.slice(0, 10));
      
      // Look for $http calls
      const httpCalls = js.match(/\$http\.(get|post)\s*\(\s*["']([^"']+)["']/gi);
      console.log('$http calls:', httpCalls?.slice(0, 10));
      
      // Look for service URLs
      const serviceUrls = js.match(/["']https?:\/\/[^"']+["']/gi);
      const uniqueUrls = [...new Set(serviceUrls)]?.filter(u => u.includes('euroncap'));
      console.log('Service URLs:', uniqueUrls?.slice(0, 10));
      
    } catch (e: any) {
      console.log(`Error: ${e.message}`);
    }
  }
}

main();
