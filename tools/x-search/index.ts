/**
 * x_search — Search X/Twitter posts with full engagement data.
 *
 * Provider priority:
 *   1. GetXAPI (GETXAPI_KEY) — $0.001/call, engagement data, advanced operators
 *   2. RapidAPI (RAPIDAPI_KEY) — legacy fallback
 *
 * Advanced search operators (GetXAPI):
 *   from:user, to:user, min_faves:100, min_retweets:50,
 *   since:2024-01-01, until:2024-12-31, lang:en, filter:links, etc.
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";

// ── Formatters ─────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTweet(tweet: any, i: number): string {
  const user = tweet.author?.userName || tweet.user?.screen_name || "unknown";
  const name = tweet.author?.name || tweet.user?.name || user;
  const text = tweet.text || tweet.full_text || "";
  const date = tweet.createdAt || tweet.created_at || "";

  const likes = tweet.likeCount ?? tweet.favorite_count ?? 0;
  const retweets = tweet.retweetCount ?? tweet.retweet_count ?? 0;
  const replies = tweet.replyCount ?? tweet.reply_count ?? 0;
  const views = tweet.viewCount ?? tweet.view_count ?? 0;
  const url = tweet.url || `https://x.com/${user}/status/${tweet.id}`;

  const engagement = [
    `❤️${formatNumber(likes)}`,
    `🔄${formatNumber(retweets)}`,
    `💬${formatNumber(replies)}`,
    views > 0 ? `👁️${formatNumber(views)}` : "",
  ].filter(Boolean).join(" ");

  return [
    `**${i}. ${name}** (@${user}) ${engagement}`,
    `> ${text.slice(0, 400).replace(/\n/g, "\n> ")}${text.length > 400 ? "..." : ""}`,
    `🔗 ${url} | 📅 ${date}`,
  ].join("\n");
}

// ── GetXAPI provider ───────────────────────────────────────

async function searchViaGetXApi(query: string, sort: string, count: number): Promise<string> {
  const { getxApiPaginated } = await import("../../lib/getxapi.js");

  const product = sort === "top" ? "Top" : "Latest";
  const result = await getxApiPaginated(
    "/twitter/tweet/advanced_search",
    { q: query, product },
    "tweets",
    count
  );

  if (result.error && (!result.data || result.data.length === 0)) return `Error: ${result.error}`;

  const tweets = result.data || [];
  if (tweets.length === 0) return `No results found for: "${query}"`;

  const header = `## X/Twitter search: "${query}" — ${tweets.length} results (${sort})\n`;
  const lines = tweets.map((t: any, i: number) => formatTweet(t, i + 1));
  return header + "\n" + lines.join("\n\n");
}

// ── RapidAPI fallback ──────────────────────────────────────

async function searchViaRapidApi(query: string): Promise<string> {
  const { rapidApiGet, requireEnv } = await import("../../lib/rapidapi.js");

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
      .map((tweet: any, i: number) => formatTweet(tweet, i + 1))
      .join("\n\n");
  }

  return JSON.stringify(data, null, 2).slice(0, 5000);
}

// ── Main execute ───────────────────────────────────────────

async function execute(params: Record<string, any>): Promise<string> {
  const query = params.query as string;
  const sort = (params.sort as string) || "top";
  const count = (params.count as number) || 20;

  // Provider auto-detect: GetXAPI first, RapidAPI fallback
  if (process.env.GETXAPI_KEY) {
    return searchViaGetXApi(query, sort, count);
  }

  if (process.env.RAPIDAPI_KEY && process.env.X_SEARCH_URL) {
    return searchViaRapidApi(query);
  }

  return [
    "⚠️ No X/Twitter API configured.",
    "",
    "**Option 1 (recommended):** Set GETXAPI_KEY — $0.001/call, no subscription",
    "  Get key at: https://getxapi.com",
    "",
    "**Option 2:** Set RAPIDAPI_KEY + X_SEARCH_URL + X_API_HOST",
    "  Get key at: https://rapidapi.com",
  ].join("\n");
}

export const definition: ToolDefinition = {
  name: "x_search",
  description: [
    "Search X/Twitter posts with full engagement data (likes, retweets, replies, views).",
    "Supports advanced operators: from:user, min_faves:100, since:2024-01-01, filter:links, etc.",
    "Results sorted by Top or Latest.",
  ].join(" "),
  params: {
    query: z.string().describe(
      "Search query. Supports advanced operators: from:user, to:user, min_faves:100, min_retweets:50, since:YYYY-MM-DD, until:YYYY-MM-DD, lang:en, filter:links, -filter:replies"
    ),
    sort: z.enum(["top", "latest"]).default("top").describe("Sort: top (popular) or latest (recent)"),
    count: z.number().min(1).max(100).default(20).describe("Number of results (1-100)"),
  },
  envVars: [], // Auto-detected, not globally required
  execute,
};
