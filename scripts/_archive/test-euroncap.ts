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
  // Try the ratings API directly
  const urls = [
    'https://www.euroncap.com/en/ratings-rewards/latest-safety-ratings/',
    'https://www.euroncap.com/api/v1/ratings',
    'https://www.euroncap.com/en/results/',
  ];

  for (const url of urls) {
    console.log(`\n=== ${url} ===`);
    try {
      const html = await fetchPage(url);
      console.log(`Length: ${html.length}`);
      console.log(`First 500 chars:\n${html.slice(0, 500)}`);
      
      // Check for JSON data
      if (html.includes('"stars"') || html.includes('"rating"')) {
        console.log('Contains rating data!');
      }
      
      // Check for data attributes
      const dataAttrs = html.match(/data-[a-z]+="[^"]+"/gi)?.slice(0, 10);
      if (dataAttrs) console.log('Data attrs:', dataAttrs);
      
    } catch (e: any) {
      console.log(`Error: ${e.message}`);
    }
  }
}

main();
