/**
 * Test YouTube search scraping (no API key needed)
 */

const query = 'BMW M3 E46 review';

async function searchYouTube(q: string): Promise<any[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%3D%3D`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  const html = await res.text();

  // Extract ytInitialData JSON
  const match = html.match(/var ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
  if (!match) {
    console.log('Page length:', html.length);
    // Try getting consent page redirect
    if (html.includes('consent')) {
      console.log('Hit consent page');
    }
    return [];
  }

  const data = JSON.parse(match[1]);
  const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

  const videos: any[] = [];
  for (const section of contents) {
    const items = section?.itemSectionRenderer?.contents || [];
    for (const item of items) {
      const vr = item.videoRenderer;
      if (!vr) continue;
      videos.push({
        videoId: vr.videoId,
        title: vr.title?.runs?.[0]?.text,
        channelName: vr.ownerText?.runs?.[0]?.text,
        views: vr.viewCountText?.simpleText,
        duration: vr.lengthText?.simpleText,
        thumbnail: vr.thumbnail?.thumbnails?.slice(-1)?.[0]?.url,
      });
    }
  }

  return videos;
}

(async () => {
  console.log('Searching YouTube for:', query);
  const results = await searchYouTube(query);
  console.log(`Found ${results.length} videos`);
  for (const v of results.slice(0, 5)) {
    console.log(`  ${v.title} | ${v.channelName} | ${v.views} | ${v.duration}`);
  }
})();
