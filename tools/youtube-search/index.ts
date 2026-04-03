import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { rapidApiGet, requireEnv } from "../../lib/rapidapi.js";

async function execute({ query, maxResults }: { query: string; maxResults: number }): Promise<string> {
  const config = {
    baseUrl: "https://youtube-v2.p.rapidapi.com",
    host: "youtube-v2.p.rapidapi.com",
    apiKey: requireEnv("RAPIDAPI_KEY"),
  };

  const result = await rapidApiGet(config, "search/", { query, lang: "en", order_by: "relevance", max_results: maxResults });
  if (result.error) return result.error;

  const data = result.data as any;
  const videos = data?.videos || data?.items || [];
  if (Array.isArray(videos) && videos.length > 0) {
    return videos
      .slice(0, maxResults)
      .map((v: any, i: number) => {
        const title = v.title || v.snippet?.title || "";
        const channel = v.author || v.channel_name || v.snippet?.channelTitle || "";
        const id = v.video_id || v.id?.videoId || v.id || "";
        const url = `https://youtube.com/watch?v=${id}`;
        const desc = (v.description || v.snippet?.description || "").slice(0, 150);
        return `${i + 1}. **${title}**\n   ${channel} | ${url}\n   ${desc}`;
      })
      .join("\n\n");
  }

  return JSON.stringify(data, null, 2).slice(0, 5000);
}

export const definition: ToolDefinition = {
  name: "youtube_search",
  description: "Search YouTube videos. Returns titles, channels, URLs, and descriptions.",
  params: {
    query: z.string().describe("Search query for YouTube"),
    maxResults: z.number().min(1).max(50).default(10).describe("Number of results"),
  },
  envVars: ["RAPIDAPI_KEY"],
  execute,
};
