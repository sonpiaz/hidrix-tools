/**
 * x_user_posts — Get recent posts from a specific X/Twitter user.
 *
 * Provider: GetXAPI (/twitter/user/tweets endpoint)
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { getxApiPaginated, getxApiGet } from "../../lib/getxapi.js";

function extractUsername(input: string): string {
  // Accept: @user, user, https://x.com/user
  const match = input.match(/(?:x\.com|twitter\.com)\/(@?\w+)/);
  if (match) return match[1].replace(/^@/, "");
  return input.replace(/^@/, "").trim();
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function execute(params: Record<string, any>): Promise<string> {
  const username = extractUsername(params.username as string);
  const count = (params.count as number) || 20;
  const includeReplies = (params.include_replies as boolean) || false;

  // 1. Get user info
  const userResult = await getxApiGet("/twitter/user/info", { userName: username });
  if (userResult.error) return `Error fetching user: ${userResult.error}`;

  const user = userResult.data?.user || userResult.data;
  const displayName = user?.name || username;
  const followers = user?.followers || user?.followersCount || 0;
  const following = user?.following || user?.followingCount || 0;
  const bio = user?.description || "";

  // 2. Get tweets
  const endpoint = includeReplies ? "/twitter/user/tweets_and_replies" : "/twitter/user/tweets";
  const tweetsResult = await getxApiPaginated(
    endpoint,
    { userName: username },
    "tweets",
    count
  );

  if (tweetsResult.error && (!tweetsResult.data || tweetsResult.data.length === 0)) {
    return `Error fetching tweets: ${tweetsResult.error}`;
  }

  const tweets = tweetsResult.data || [];

  // 3. Format output
  const sections: string[] = [];

  // User header
  sections.push(`## @${username} — ${displayName}`);
  sections.push(`👥 ${formatNumber(followers)} followers | ${formatNumber(following)} following`);
  if (bio) sections.push(`> ${bio.slice(0, 200)}`);
  sections.push("");

  if (tweets.length === 0) {
    sections.push("No tweets found.");
    return sections.join("\n");
  }

  sections.push(`### Recent posts (${tweets.length})\n`);

  tweets.forEach((t: any, i: number) => {
    const text = t.text || t.full_text || "";
    const likes = t.likeCount ?? t.favorite_count ?? 0;
    const retweets = t.retweetCount ?? t.retweet_count ?? 0;
    const replies = t.replyCount ?? t.reply_count ?? 0;
    const views = t.viewCount ?? 0;
    const date = t.createdAt || t.created_at || "";
    const url = t.url || `https://x.com/${username}/status/${t.id}`;

    const engagement = [
      `❤️${formatNumber(likes)}`,
      `🔄${formatNumber(retweets)}`,
      `💬${formatNumber(replies)}`,
      views > 0 ? `👁️${formatNumber(views)}` : "",
    ].filter(Boolean).join(" ");

    sections.push(`**${i + 1}.** ${engagement}`);
    sections.push(`> ${text.slice(0, 400).replace(/\n/g, "\n> ")}${text.length > 400 ? "..." : ""}`);
    sections.push(`🔗 ${url} | 📅 ${date}`);
    sections.push("");
  });

  return sections.join("\n");
}

export const definition: ToolDefinition = {
  name: "x_user_posts",
  description: [
    "Get recent posts from a specific X/Twitter user with full engagement data.",
    "Shows user profile info + timeline of recent tweets.",
    "Input: username, @handle, or profile URL.",
  ].join(" "),
  params: {
    username: z.string().describe("X/Twitter username (@handle, username, or profile URL)"),
    count: z.number().min(1).max(100).default(20).describe("Number of posts to fetch (1-100)"),
    include_replies: z.boolean().default(false).describe("Include user's replies in timeline"),
  },
  envVars: ["GETXAPI_KEY"],
  execute,
};
