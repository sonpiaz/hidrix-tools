/**
 * TikTok video search via RapidAPI.
 * Ported from Affitor TiktokClient.
 */

import { rapidApiGet, requireEnv } from "../lib/rapidapi.js";

export async function tiktokSearch(keyword: string): Promise<string> {
  const config = {
    baseUrl: process.env.TIKTOK_SEARCH_URL || "https://tiktok-api23.p.rapidapi.com",
    host: process.env.TIKTOK_API_HOST || "tiktok-api23.p.rapidapi.com",
    apiKey: requireEnv("RAPIDAPI_KEY"),
  };

  const result = await rapidApiGet(config, "api/search/video", {
    keyword,
    cursor: 0,
    search_id: 0,
  });

  if (result.error) return result.error;

  const data = result.data as any;
  const videos = data?.data || data?.videos || data?.item_list || [];

  if (!Array.isArray(videos) || videos.length === 0) {
    return `No TikTok results for: "${keyword}"`;
  }

  return videos
    .slice(0, 10)
    .map((v: any, i: number) => {
      const author = v.author?.nickname || v.author?.unique_id || "unknown";
      const desc = (v.desc || v.title || "").slice(0, 200);
      const plays = v.stats?.playCount || v.play_count || 0;
      const likes = v.stats?.diggCount || v.digg_count || 0;
      const id = v.id || v.video_id || "";
      const url = id ? `https://tiktok.com/@${v.author?.unique_id || "user"}/video/${id}` : "";
      return `${i + 1}. @${author} | ${plays} plays | ${likes} likes\n   ${desc}\n   ${url}`;
    })
    .join("\n\n");
}
