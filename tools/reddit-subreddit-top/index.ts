/**
 * reddit_subreddit_top — Get top posts from a specific subreddit.
 *
 * Uses Reddit's free public JSON API (no API key needed):
 *   https://www.reddit.com/r/{subreddit}/top.json?t={time}
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function execute(params: Record<string, any>): Promise<string> {
  const subreddit = (params.subreddit as string).replace(/^r\//, "").replace(/^\/r\//, "").trim();
  const time = (params.time as string) || "week";
  const count = (params.count as number) || 20;
  const sort = (params.sort as string) || "top";

  const jsonUrl = `https://www.reddit.com/r/${subreddit}/${sort}.json?t=${time}&limit=${Math.min(count, 100)}`;

  const response = await fetch(jsonUrl, {
    headers: {
      "User-Agent": "hidrix-tools/1.0 (MCP tool server)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    if (response.status === 404) return `Subreddit r/${subreddit} not found or is private.`;
    return `Error fetching r/${subreddit}: ${response.status} ${response.statusText}`;
  }

  const data = await response.json();
  const posts = data?.data?.children || [];

  if (posts.length === 0) {
    return `No posts found in r/${subreddit} (${sort}, ${time}).`;
  }

  const limitedPosts = posts.slice(0, count);

  const sections: string[] = [];
  sections.push(`## r/${subreddit} — ${sort} posts (${time})\n`);

  limitedPosts.forEach((item: any, i: number) => {
    const post = item.data;
    const title = post.title || "";
    const score = post.score ?? 0;
    const comments = post.num_comments ?? 0;
    const upvoteRatio = post.upvote_ratio ? `${Math.round(post.upvote_ratio * 100)}%` : "";
    const author = post.author || "[deleted]";
    const created = post.created_utc ? new Date(post.created_utc * 1000).toISOString().split("T")[0] : "";
    const permalink = post.permalink ? `https://reddit.com${post.permalink}` : "";
    const selftext = (post.selftext || "").slice(0, 300);

    const engagement = [
      `⬆️${formatNumber(score)}`,
      `💬${formatNumber(comments)}`,
      upvoteRatio ? `📊${upvoteRatio}` : "",
    ].filter(Boolean).join(" ");

    const textBlock = selftext ? `\n> ${selftext.replace(/\n/g, "\n> ")}${post.selftext?.length > 300 ? "..." : ""}` : "";

    sections.push(`**${i + 1}.** ${engagement}`);
    sections.push(`**${title}**${textBlock}`);
    sections.push(`👤 u/${author} | 📅 ${created} | 🔗 ${permalink}`);
    sections.push("");
  });

  return sections.join("\n");
}

export const definition: ToolDefinition = {
  name: "reddit_subreddit_top",
  description: [
    "Get top posts from a specific subreddit.",
    "Filter by time range (day, week, month, year, all) and sort order.",
    "Uses Reddit's free public JSON API — no API key needed.",
  ].join(" "),
  params: {
    subreddit: z.string().describe("Subreddit name (e.g. MachineLearning, AskReddit, startups)"),
    sort: z.enum(["top", "hot", "new", "rising"]).default("top").describe("Sort order"),
    time: z.enum(["day", "week", "month", "year", "all"]).default("week").describe("Time range (for top sort)"),
    count: z.number().min(1).max(100).default(20).describe("Number of posts (1-100)"),
  },
  // No envVars needed! Free Reddit JSON API
  execute,
};
