/**
 * FLM AUTO - Import YouTube Channels from Gemini export
 * 
 * Expected JSON format from Gemini:
 * {
 *   "channels": [
 *     {
 *       "name": "Doug DeMuro",
 *       "youtube_id": "@DougDeMuro",
 *       "language": "en",
 *       "type": "review",
 *       "brands_focus": ["All"],
 *       "subscriber_count": "4.8M",
 *       "quality_score": 9
 *     }
 *   ]
 * }
 * 
 * Usage: Place Gemini output in ../data/raw/youtube/gemini_channels.json
 *        Then run: npx ts-node import-youtube-channels.ts
 */

import * as fs from 'fs';

interface YouTubeChannel {
  name: string;
  youtube_id: string;
  language: string;
  type: string;
  brands_focus?: string[];
  subscriber_count?: string;
  quality_score?: number;
  notable_series?: string[];
  url?: string;
}

async function main() {
  console.log('🎬 FLM AUTO - Import YouTube Channels\n');
  
  const inputFile = '../data/raw/youtube/gemini_channels.json';
  
  if (!fs.existsSync(inputFile)) {
    console.log(`❌ File not found: ${inputFile}`);
    console.log(`\n📝 Please save Gemini output to this file first.`);
    console.log(`\nExpected format:`);
    console.log(`{
  "channels": [
    {
      "name": "Channel Name",
      "youtube_id": "@handle",
      "language": "en|fr|de",
      "type": "review|test|comparison|luxury|electric|performance",
      "brands_focus": ["BMW", "All"],
      "subscriber_count": "1.2M",
      "quality_score": 9
    }
  ]
}`);
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const channels: YouTubeChannel[] = data.channels || data;
  
  console.log(`📊 Loaded ${channels.length} channels\n`);
  
  // Check if youtube_channels table exists, if not we'll store in a JSON reference table
  // For now, store as third_party_specs with a special type
  
  // Get a "system" generation to attach these to (or create a reference table)
  // For simplicity, we'll create a JSON file that the frontend can use
  
  const outputData = {
    updated_at: new Date().toISOString(),
    total_channels: channels.length,
    by_language: {} as Record<string, number>,
    by_type: {} as Record<string, number>,
    channels: channels.map(ch => ({
      name: ch.name,
      youtube_id: ch.youtube_id,
      url: ch.youtube_id.startsWith('@') 
        ? `https://youtube.com/${ch.youtube_id}`
        : `https://youtube.com/channel/${ch.youtube_id}`,
      language: ch.language,
      type: ch.type,
      brands_focus: ch.brands_focus || ['All'],
      subscriber_count: ch.subscriber_count,
      quality_score: ch.quality_score || 7,
      notable_series: ch.notable_series || [],
    })),
  };
  
  // Count by language and type
  for (const ch of channels) {
    outputData.by_language[ch.language] = (outputData.by_language[ch.language] || 0) + 1;
    outputData.by_type[ch.type] = (outputData.by_type[ch.type] || 0) + 1;
  }
  
  // Save processed data
  const outputFile = '../data/youtube_channels.json';
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  
  console.log(`✅ Processed ${channels.length} channels`);
  console.log(`\n📊 By language:`);
  for (const [lang, count] of Object.entries(outputData.by_language)) {
    console.log(`   ${lang}: ${count}`);
  }
  console.log(`\n📊 By type:`);
  for (const [type, count] of Object.entries(outputData.by_type)) {
    console.log(`   ${type}: ${count}`);
  }
  console.log(`\n📁 Saved to: ${outputFile}`);
  
  // Also create a brand-specific index for quick lookups
  const brandIndex: Record<string, string[]> = {};
  
  for (const ch of outputData.channels) {
    for (const brand of ch.brands_focus) {
      if (!brandIndex[brand]) brandIndex[brand] = [];
      brandIndex[brand].push(ch.youtube_id);
    }
  }
  
  const brandIndexFile = '../data/youtube_by_brand.json';
  fs.writeFileSync(brandIndexFile, JSON.stringify(brandIndex, null, 2));
  console.log(`📁 Brand index saved to: ${brandIndexFile}`);
}

main().catch(console.error);
