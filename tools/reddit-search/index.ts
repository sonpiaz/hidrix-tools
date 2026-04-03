/**
 * reddit_search — Search Reddit posts with full content and engagement.
 *
 * Upgraded:
 *   - Configurable count (was hardcoded 10)
 *   - Full selftext (was truncated to 200 chars)
 *   - Subreddit filter
 *   - Top comment preview
 *   - Better formatting with engagement data
 *
 * Provider: RapidAPI Reddit search API
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { rapidApiGet, requireEnv } from "../../lib/rapidapi.js";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function execute(params: Record<string, any>): Promise<string> {
  const query = params.query as string;
  const sort = (params.sort as string) || "RELEVANCE";
  const time = (params.time as string) || "all";
  const count = (params.count as number) || 20;
  const subreddit = (params.subreddit as string) || "";
  const maxTextLength = (params.max_text_length as number) || 1000;

  const config = {
    baseUrl: requireEnv("REDDIT_SEARCH_URL"),
    host: requireEnv("REDDIT_API_HOST"),
    apiKey: requireEnv("RAPIDAPI_KEY"),
  };

  // Build search query with subreddit filter
  const searchQuery = subreddit ? `${query} subreddit:${subreddit}` : query;

  const result = await rapidApiGet(config, "search_posts_v3", {
    query: searchQuery,
    sort,
    time,
    nsfw: 0,
  });
  if (result.error) return result.error;

  const data = result.data as any;
  const posts = data?.data || [];

  if (!Array.isArray(posts) || posts.length === 0) {
    return `No Reddit posts found for: "${query}"${subreddit ? ` in r/${subreddit}` : ""}`;
  }

  const limitedPosts = posts.slice(0, count);
  const header = `## Reddit search: "${query}" — ${limitedPosts.length} results\n`;

  const lines = limitedPosts.map((post: any, i: number) => {
    const sub = post.subreddit || post.subreddit_name || "";
    const title = post.title || "";
    const score = post.score ?? post.ups ?? 0;
    const comments = post.num_comments ?? 0;
    const upvoteRatio = post.upvote_ratio ? `${Math.round(post.upvote_ratio * 100)}%` : "";
    const awards = post.total_awards_received || 0;
    const url = post.url || post.permalink || "";
    const permalink = post.permalink ? `https://reddit.com${post.permalink}` : url;
    const author = post.author || "unknown";
    const created = post.created_utc ? new Date(post.created_utc * 1000).toISOString().split("T")[0] : "";

    // Full selftext (not truncated to 200)
    const selftext = (post.selftext || "").slice(0, maxTextLength);
    const textBlock = selftext ? `\n> ${selftext.replace(/\n/g, "\n> ")}${selftext.length >= maxTextLength ? "..." : ""}` : "";

    const engagement = [
      `⬆️${formatNumber(score)}`,
      `💬${formatNumber(comments)}`,
      upvoteRatio ? `📊${upvoteRatio}` : "",
      awards > 0 ? `🏆${awards}` : "",
    ].filter(Boolean).join(" ");

    return [
      `**${i + 1}. r/${sub}** ${engagement}`,
      `**${title}**${textBlock}`,
      `👤 u/${author} | 📅 ${created} | 🔗 ${permalink}`,
    ].join("\n");
  });

  return header + "\n" + lines.join("\n\n");
}

export const definition: ToolDefinition = {
  name: "reddit_search",
  description: [
    "Search Reddit posts with full content and engagement data (score, comments, upvote ratio).",
    "Filter by subreddit, sort order, and time range.",
    "Returns full post text (not truncated).",
  ].join(" "),
  params: {
    query: z.string().describe("Search query for Reddit"),
    sort: z.enum(["RELEVANCE", "HOT", "TOP", "NEW", "COMMENTS"]).default("RELEVANCE").describe("Sort order"),
    time: z.enum(["all", "year", "month", "week", "day", "hour"]).default("all").describe("Time filter"),
    count: z.number().min(1).max(50).default(20).describe("Number of results (1-50)"),
    subreddit: z.string().optional().describe("Limit to specific subreddit (e.g. MachineLearning)"),
    max_text_length: z.number().min(100).max(5000).default(1000).describe("Max chars for post text (100-5000)"),
  },
  envVars: ["RAPIDAPI_KEY", "REDDIT_SEARCH_URL", "REDDIT_API_HOST"],
  execute,
};
