/**
 * YouTube search via RapidAPI.
 * Ported from Affitor YoutubeClient.
 */

import { rapidApiGet, requireEnv } from "../lib/rapidapi.js";

export async function youtubeSearch(query: string, maxResults: number = 10): Promise<string> {
  const config = {
    baseUrl: process.env.YOUTUBE_SEARCH_URL || "https://youtube-api49.p.rapidapi.com",
    host: process.env.YOUTUBE_API_HOST || "youtube-api49.p.rapidapi.com",
    apiKey: requireEnv("RAPIDAPI_KEY"),
  };

  const result = await rapidApiGet(config, "api/search", {
    q: query,
    maxResults: Math.min(maxResults, 50),
    regionCode: "US",
  });

  if (result.error) return result.error;

  const data = result.data as any;

  // Format results - YouTube API returns items array
  const items = data?.items || data?.results || (Array.isArray(data) ? data : []);

  if (items.length === 0) {
    return `No YouTube results for: "${query}"`;
  }

  return items
    .slice(0, maxResults)
    .map((item: any, i: number) => {
      const title = item.snippet?.title || item.title || "";
      const channel = item.snippet?.channelTitle || item.channelTitle || "";
      const videoId = item.id?.videoId || item.videoId || item.id || "";
      const description = (item.snippet?.description || item.description || "").slice(0, 150);
      const url = videoId ? `https://youtube.com/watch?v=${videoId}` : "";
      return `${i + 1}. **${title}**\n   Channel: ${channel}\n   ${url}\n   ${description}`;
    })
    .join("\n\n");
}
