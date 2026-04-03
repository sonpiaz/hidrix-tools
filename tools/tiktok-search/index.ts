import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { rapidApiGet, requireEnv } from "../../lib/rapidapi.js";

async function execute({ keyword }: { keyword: string }): Promise<string> {
  const config = {
    baseUrl: "https://tiktok-api23.p.rapidapi.com",
    host: "tiktok-api23.p.rapidapi.com",
    apiKey: requireEnv("RAPIDAPI_KEY"),
  };

  const result = await rapidApiGet(config, "api/search/general", { keyword, count: 10 });
  if (result.error) return result.error;

  const data = result.data as any;
  const items = data?.data || data?.items || [];
  if (Array.isArray(items) && items.length > 0) {
    return items
      .filter((item: any) => item.type === 1 || item.item)
      .slice(0, 10)
      .map((item: any, i: number) => {
        const video = item.item || item;
        const author = video.author?.uniqueId || video.author?.nickname || "";
        const desc = (video.desc || "").slice(0, 200);
        const plays = video.stats?.playCount ?? 0;
        const likes = video.stats?.diggCount ?? 0;
        const id = video.id || "";
        return `${i + 1}. @${author} | ▶ ${plays} | ♥ ${likes}\n   ${desc}\n   https://tiktok.com/@${author}/video/${id}`;
      })
      .join("\n\n");
  }

  return JSON.stringify(data, null, 2).slice(0, 5000);
}

export const definition: ToolDefinition = {
  name: "tiktok_search",
  description: "Search TikTok videos. Returns videos with author, play counts, likes, and descriptions.",
  params: {
    keyword: z.string().describe("Search keyword for TikTok"),
  },
  envVars: ["RAPIDAPI_KEY"],
  execute,
};
