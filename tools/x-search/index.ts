import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { rapidApiGet, requireEnv } from "../../lib/rapidapi.js";

async function execute({ query }: { query: string }): Promise<string> {
  const config = {
    baseUrl: requireEnv("X_SEARCH_URL"),
    host: requireEnv("X_API_HOST"),
    apiKey: requireEnv("RAPIDAPI_KEY"),
  };

  const result = await rapidApiGet(config, "", { query, search_type: "Top" });
  if (result.error) return result.error;

  const data = result.data as any;
  if (data?.results && Array.isArray(data.results)) {
    return data.results
      .slice(0, 10)
      .map((tweet: any, i: number) => {
        const user = tweet.user?.screen_name || tweet.user_screen_name || "unknown";
        const text = tweet.full_text || tweet.text || "";
        const created = tweet.created_at || "";
        return `${i + 1}. @${user} (${created})\n   ${text}`;
      })
      .join("\n\n");
  }

  return JSON.stringify(data, null, 2).slice(0, 5000);
}

export const definition: ToolDefinition = {
  name: "x_search",
  description: "Search X/Twitter posts. Returns top tweets matching the query.",
  params: {
    query: z.string().describe("Search query for X/Twitter"),
  },
  envVars: ["RAPIDAPI_KEY", "X_SEARCH_URL", "X_API_HOST"],
  execute,
};
