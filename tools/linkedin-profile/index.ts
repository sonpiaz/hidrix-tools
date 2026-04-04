/**
 * linkedin_profile — Get recent posts from a LinkedIn profile.
 *
 * Provider: Apify `data-slayer/linkedin-profile-posts-scraper`
 *   - No cookies/login needed
 *   - Engagement: likes, comments, shares, reaction breakdown
 *   - Author info, media attachments
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { runActor, requireApifyToken } from "../../lib/apify.js";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function extractUsername(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/);
  return match ? match[1] : url.replace(/^@/, "").trim();
}

async function execute(params: Record<string, any>): Promise<string> {
  requireApifyToken();

  const profileUrl = params.profile_url as string;
  const maxPosts = (params.max_posts as number) || 20;

  // Normalize to full URL
  const fullUrl = profileUrl.startsWith("http")
    ? profileUrl
    : `https://www.linkedin.com/in/${profileUrl.replace(/^@/, "")}`;

  const input: Record<string, any> = {
    linkedin_url: fullUrl,
    maxPages: Math.ceil(maxPosts / 10),
  };

  const result = await runActor("data-slayer/linkedin-profile-posts-scraper", input);
  if (result.error) return `Error: ${result.error}`;

  const posts = result.items;
  if (posts.length === 0) return `No posts found for profile: ${fullUrl}`;

  const username = extractUsername(fullUrl);
  const firstPost = posts[0] || {};
  const authorName = firstPost.author?.name || firstPost.authorFullName || firstPost.authorName || username;
  const headline = firstPost.author?.occupation || firstPost.authorHeadline || firstPost.authorTitle || "";

  const sections: string[] = [];
  sections.push(`## ${authorName} — linkedin.com/in/${username}`);
  if (headline) sections.push(`> _${headline.slice(0, 200)}_`);
  sections.push("");
  sections.push(`### Recent posts (${Math.min(posts.length, maxPosts)})\n`);

  posts.slice(0, maxPosts).forEach((p: any, i: number) => {
    const text = (p.text || p.postContent || "").slice(0, 400);
    const likes = p.likes || p.numLikes || p.reactions_count || 0;
    const comments = p.comments_count || p.numComments || 0;
    const shares = p.shares || p.numShares || 0;
    const date = p.created_at || p.postedAtISO || p.postedAgo || p.timeSincePosted || "";
    const url = p.share_url || p.url || p.postUrl || "";
    const isRepost = p.is_repost || p.isRepost || false;

    const engagement = [
      `👍${formatNumber(likes)}`,
      `💬${formatNumber(comments)}`,
      `🔄${formatNumber(shares)}`,
    ].join(" ");

    const tag = isRepost ? " [repost]" : "";

    sections.push(`**${i + 1}.** ${engagement}${tag}`);
    sections.push(`> ${text.replace(/\n/g, "\n> ")}${text.length >= 400 ? "..." : ""}`);
    sections.push(`🔗 ${url} | 📅 ${date}`);
    sections.push("");
  });

  return sections.join("\n");
}

export const definition: ToolDefinition = {
  name: "linkedin_profile",
  description: [
    "Get recent posts from a LinkedIn profile with engagement data.",
    "Shows post content, likes, comments, shares, reaction breakdown.",
    "No LinkedIn login required. Input: profile URL or username.",
  ].join(" "),
  params: {
    profile_url: z.string().describe("LinkedIn profile URL (https://linkedin.com/in/username) or username"),
    max_posts: z.number().min(1).max(50).default(20).describe("Max posts to fetch (1-50)"),
  },
  envVars: ["APIFY_API_TOKEN"],
  execute,
};
