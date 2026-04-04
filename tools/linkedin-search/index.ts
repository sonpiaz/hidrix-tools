/**
 * linkedin_search — Search LinkedIn posts by keyword with engagement data.
 *
 * Provider: Apify `datadoping/linkedin-posts-search-scraper`
 *   - No cookies/login needed
 *   - $1.20/1000 posts
 *   - Engagement: reactions, comments, reposts
 *   - Date filtering, sort by engagement/recent
 *   - Boolean operators supported
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { runActor, requireApifyToken } from "../../lib/apify.js";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function execute(params: Record<string, any>): Promise<string> {
  requireApifyToken();

  const keywords = (params.query as string).split(",").map((k) => k.trim()).filter(Boolean);
  const maxPosts = (params.max_posts as number) || 20;
  const sortBy = (params.sort as string) || "engagement";
  const dateFilter = (params.date_filter as string) || "any";
  const minEngagement = (params.min_engagement as number) || 0;

  const input: Record<string, any> = {
    keywords,
    max_posts: maxPosts,
    sort_by: sortBy === "recent" ? "date_posted" : sortBy === "reactions" ? "reactions" : sortBy === "comments" ? "comments" : "engagement",
    proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
  };

  if (dateFilter !== "any") input.date_filter = dateFilter;
  if (minEngagement > 0) input.minEngagement = minEngagement;

  const result = await runActor("datadoping/linkedin-posts-search-scraper", input);
  if (result.error) return `Error: ${result.error}`;

  const posts = result.items;
  if (posts.length === 0) return `No LinkedIn posts found for: "${params.query}"`;

  const header = `## LinkedIn search: "${params.query}" — ${posts.length} posts\n`;

  const lines = posts.slice(0, maxPosts).map((p: any, i: number) => {
    const author = p.authorName || p.authorFullName || "unknown";
    const headline = p.authorHeadline || "";
    const text = (p.postContent || p.text || "").slice(0, 400);
    const reactions = p.reactionCount || p.totalEngagement || p.numLikes || 0;
    const comments = p.commentCount || p.numComments || 0;
    const reposts = p.repostCount || p.numShares || 0;
    const date = p.postedDate || p.postedAgo || p.postedAtISO || "";
    const url = p.postUrl || p.url || "";

    const engagement = [
      `👍${formatNumber(reactions)}`,
      `💬${formatNumber(comments)}`,
      `🔄${formatNumber(reposts)}`,
    ].join(" ");

    return [
      `**${i + 1}. ${author}** ${engagement}`,
      headline ? `> _${headline.slice(0, 100)}_` : "",
      `> ${text.replace(/\n/g, "\n> ")}${text.length >= 400 ? "..." : ""}`,
      `🔗 ${url} | 📅 ${date}`,
    ].filter(Boolean).join("\n");
  });

  return header + "\n" + lines.join("\n\n");
}

export const definition: ToolDefinition = {
  name: "linkedin_search",
  description: [
    "Search LinkedIn posts by keyword with engagement data (reactions, comments, reposts).",
    "Supports Boolean operators, date filtering, engagement thresholds, and sorting.",
    "No LinkedIn login required. Uses Apify (needs APIFY_API_TOKEN).",
  ].join(" "),
  params: {
    query: z.string().describe("Search keywords. Supports Boolean: '\"AI agent\" OR \"LLM\"'. Comma-separate for multiple queries."),
    max_posts: z.number().min(1).max(100).default(20).describe("Max posts per query (1-100)"),
    sort: z.enum(["engagement", "recent", "reactions", "comments"]).default("engagement").describe("Sort order"),
    date_filter: z.enum(["any", "past-24h", "past-week", "past-month"]).default("any").describe("Date filter"),
    min_engagement: z.number().min(0).default(0).describe("Min total engagement (reactions+comments+reposts)"),
  },
  envVars: ["APIFY_API_TOKEN"],
  execute,
};
