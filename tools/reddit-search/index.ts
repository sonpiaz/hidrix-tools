import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { rapidApiGet, requireEnv } from "../../lib/rapidapi.js";

async function execute({ query, sort, time }: { query: string; sort: string; time: string }): Promise<string> {
  const config = {
    baseUrl: requireEnv("REDDIT_SEARCH_URL"),
    host: requireEnv("REDDIT_API_HOST"),
    apiKey: requireEnv("RAPIDAPI_KEY"),
  };

  const result = await rapidApiGet(config, "search_posts_v3", { query, sort, time, nsfw: 0 });
  if (result.error) return result.error;

  const data = result.data as any;
  if (data?.data && Array.isArray(data.data)) {
    return data.data
      .slice(0, 10)
      .map((post: any, i: number) => {
        const sub = post.subreddit || post.subreddit_name || "";
        const title = post.title || "";
        const score = post.score ?? post.ups ?? 0;
        const comments = post.num_comments ?? 0;
        const url = post.url || post.permalink || "";
        const selftext = post.selftext ? `\n   ${post.selftext.slice(0, 200)}` : "";
        return `${i + 1}. r/${sub} | ${score} pts | ${comments} comments\n   **${title}**${selftext}\n   ${url}`;
      })
      .join("\n\n");
  }

  return JSON.stringify(data, null, 2).slice(0, 5000);
}

export const definition: ToolDefinition = {
  name: "reddit_search",
  description: "Search Reddit posts. Returns posts with scores, comments, and content.",
  params: {
    query: z.string().describe("Search query for Reddit"),
    sort: z.enum(["RELEVANCE", "HOT", "TOP", "NEW", "COMMENTS"]).default("RELEVANCE").describe("Sort order"),
    time: z.enum(["all", "year", "month", "week", "day", "hour"]).default("all").describe("Time filter"),
  },
  envVars: ["RAPIDAPI_KEY", "REDDIT_SEARCH_URL", "REDDIT_API_HOST"],
  execute,
};
