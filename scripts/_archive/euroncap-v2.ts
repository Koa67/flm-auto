import * as https from 'https';

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
  // Try to get individual brand pages
  const brands = ['bmw', 'mercedes-benz', 'audi', 'volkswagen', 'toyota', 'tesla', 'volvo'];
  
  for (const brand of brands) {
    const url = `https://www.euroncap.com/en/results/${brand}/`;
    console.log(`\n=== ${brand} ===`);
    
    try {
      const html = await fetchPage(url);
      console.log(`Page size: ${html.length}`);
      
      // Look for model links
      const modelLinks = html.match(/href="\/en\/results\/[^"]+\/[^"]+\/\d+"/gi);
      console.log(`Model links: ${modelLinks?.length || 0}`);
      if (modelLinks) {
        console.log('Samples:', modelLinks.slice(0, 5));
      }
      
      // Look for star ratings in page
      const stars = html.match(/class="[^"]*star[^"]*"/gi);
      console.log(`Star classes: ${stars?.length || 0}`);
      
    } catch (e: any) {
      console.log(`Error: ${e.message}`);
    }
  }
  
  // Try a known car result page
  console.log('\n=== Testing direct result page ===');
  const testUrl = 'https://www.euroncap.com/en/results/bmw/3-series/43654';
  try {
    const html = await fetchPage(testUrl);
    console.log(`Page size: ${html.length}`);
    
    // Extract rating info
    const overallMatch = html.match(/overall[^>]*>[\s\S]*?(\d)\s*star/i);
    const adultMatch = html.match(/adult[^>]*>[\s\S]*?(\d+)\s*%/i);
    const childMatch = html.match(/child[^>]*>[\s\S]*?(\d+)\s*%/i);
    
    console.log('Overall stars:', overallMatch?.[1]);
    console.log('Adult protection:', adultMatch?.[1]);
    console.log('Child protection:', childMatch?.[1]);
    
    // Look for structured data
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (jsonLd) {
      console.log('Found JSON-LD:', jsonLd[1].slice(0, 200));
    }
    
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
}

main();
