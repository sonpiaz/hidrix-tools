/**
 * facebook_scraper — Scrape Facebook groups, pages, keyword search, or ads.
 *
 * 4 modes via `source_type`:
 *   group  → Apify crowdpull/facebook-group-posts-scraper (no login)
 *   page   → Apify scrapio/facebook-page-posts-scraper (no login)
 *   search → Apify scrapio/facebook-page-posts-scraper (keyword mode)
 *   ads    → Meta Ad Library API (free, official)
 *
 * Provider: auto-detected from env vars.
 *   APIFY_API_TOKEN  → group/page/search modes
 *   META_ADS_ACCESS_TOKEN → ads mode
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { runActor, requireApifyToken } from "../../lib/apify.js";
import { searchAds, requireMetaToken } from "../../lib/meta-ads.js";

// ── Types ──────────────────────────────────────────────────

interface Post {
  text: string;
  url: string;
  author: string;
  timestamp: string;
  reactions: number;
  comments: number;
  shares: number;
  source: string;
  source_type: string;
}

// ── Apify actor IDs ────────────────────────────────────────

const ACTORS = {
  group: "crowdpull/facebook-group-posts-scraper",
  page: "data-slayer/facebook-page-posts",
} as const;

// ── Mode handlers ──────────────────────────────────────────

async function scrapeGroups(urls: string[], maxPosts: number, sort: string, since?: string): Promise<Post[]> {
  requireApifyToken();

  const input: Record<string, any> = {
    startUrls: urls.map((u) => ({ url: u })),
    maxPosts,
    sortOrder: sort === "relevant" ? "RELEVANT" : "CHRONOLOGICAL",
    proxyConfig: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
  };
  if (since) input.onlyPostsNewerThan = since;

  const result = await runActor(ACTORS.group, input);
  if (result.error) throw new Error(result.error);

  return result.items.map((item: any) => ({
    text: item.postText || item.text || item.message || "",
    url: item.postUrl || item.url || "",
    author: item.authorName || item.postAuthor || item.user?.name || "unknown",
    timestamp: item.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : item.date || "",
    reactions: item.reactionCount || item.reactions_count || 0,
    comments: item.commentCount || item.comments_count || 0,
    shares: item.shareCount || item.reshare_count || 0,
    source: item.groupUrl || urls[0] || "",
    source_type: "group",
  }));
}

async function scrapePages(urls: string[], maxPosts: number): Promise<Post[]> {
  requireApifyToken();

  // data-slayer actor takes pageId (numeric or username), not full URLs
  // Extract page identifier from URLs or use as-is
  const pageIds = urls.map((u) => {
    const match = u.match(/facebook\.com\/([^/?]+)/);
    return match ? match[1] : u;
  });

  // Run one actor per page (data-slayer takes single pageId)
  const allPosts: Post[] = [];
  for (const pageId of pageIds) {
    const input: Record<string, any> = {
      pageId,
      maxPages: Math.ceil(maxPosts / 10), // ~10 posts per page
    };

    const result = await runActor(ACTORS.page, input);
    if (result.error) throw new Error(result.error);

    const posts = result.items.map((item: any) => ({
      text: item.message || item.postText || item.text || "",
      url: item.url || item.postUrl || item.post_url || "",
      author: item.author?.name || item.pageName || item.postAuthor || "unknown",
      timestamp: item.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : item.publishedAt || "",
      reactions: item.reactions_count || item.reactions?.total || item.reactionCount || 0,
      comments: item.comments_count || item.commentCount || 0,
      shares: item.reshare_count || item.shareCount || item.sharesCount || 0,
      source: item.author?.url || pageId,
      source_type: "page",
    }));
    allPosts.push(...posts);
  }

  return allPosts.slice(0, maxPosts);
}

async function searchByKeyword(keywords: string[], maxPosts: number): Promise<Post[]> {
  // Reuse page scraper in keyword mode
  requireApifyToken();

  const input: Record<string, any> = {
    startUrls: keywords, // scrapio actor accepts keywords as startUrls
    maxPosts,
    sortOrder: "reverse_chronological",
    maxComments: 0,
    proxyConfiguration: { useApifyProxy: true },
  };

  const result = await runActor(ACTORS.page, input);
  if (result.error) throw new Error(result.error);

  return result.items.map((item: any) => ({
    text: item.message || item.postText || item.text || "",
    url: item.url || item.postUrl || item.post_url || "",
    author: item.author?.name || item.pageName || item.postAuthor || "unknown",
    timestamp: item.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : item.publishedAt || "",
    reactions: item.reactions_count || item.reactions?.total || item.reactionCount || 0,
    comments: item.comments_count || item.commentCount || 0,
    shares: item.reshare_count || item.shareCount || item.sharesCount || 0,
    source: "keyword_search",
    source_type: "search",
  }));
}

async function searchFbAds(params: {
  keywords?: string;
  page_ids?: string;
  countries: string;
  max_results: number;
  ad_status: string;
}): Promise<Post[]> {
  requireMetaToken();

  const countries = params.countries.split(",").map((c) => c.trim().toUpperCase());
  const pageIds = params.page_ids ? params.page_ids.split(",").map((p) => p.trim()) : undefined;

  const result = await searchAds({
    search_terms: params.keywords || undefined,
    search_page_ids: pageIds,
    ad_reached_countries: countries,
    ad_active_status: params.ad_status === "all" ? "ALL" : params.ad_status === "inactive" ? "INACTIVE" : "ACTIVE",
    limit: params.max_results,
  });

  if (result.error) throw new Error(result.error);

  return result.ads.map((ad) => ({
    text: (ad.ad_creative_bodies || []).join("\n") || "[no text]",
    url: ad.ad_snapshot_url || "",
    author: ad.page_name || "unknown",
    timestamp: ad.ad_delivery_start_time || "",
    reactions: 0, // Ads API doesn't provide engagement
    comments: 0,
    shares: 0,
    source: `page:${ad.page_id}`,
    source_type: "ad",
  }));
}

// ── Formatter ──────────────────────────────────────────────

function formatPosts(posts: Post[], sourceType: string): string {
  if (posts.length === 0) return `No results found (source_type: ${sourceType})`;

  const header = `## Facebook ${sourceType} results — ${posts.length} posts\n`;

  const lines = posts.map((p, i) => {
    const engagement = `👍${p.reactions} 💬${p.comments} 🔄${p.shares}`;
    const score = p.reactions * 1 + p.comments * 3 + p.shares * 5;
    const textPreview = p.text.slice(0, 300).replace(/\n/g, " ");
    return [
      `### ${i + 1}. ${p.author} ${engagement} (score:${score})`,
      `> ${textPreview}${p.text.length > 300 ? "..." : ""}`,
      `🔗 ${p.url}`,
      `📅 ${p.timestamp} | Source: ${p.source}`,
    ].join("\n");
  });

  return header + "\n" + lines.join("\n\n");
}

// ── Main execute ───────────────────────────────────────────

async function execute(params: Record<string, any>): Promise<string> {
  const sourceType = params.source_type as string;
  const targets = (params.targets as string).split(",").map((t: string) => t.trim()).filter(Boolean);
  const maxPosts = (params.max_posts as number) || 50;

  let posts: Post[];

  switch (sourceType) {
    case "group":
      posts = await scrapeGroups(targets, maxPosts, params.sort || "relevant", params.since);
      break;
    case "page":
      posts = await scrapePages(targets, maxPosts);
      break;
    case "search":
      posts = await searchByKeyword(targets, maxPosts);
      break;
    case "ads":
      posts = await searchFbAds({
        keywords: targets.join(" "),
        page_ids: params.page_ids,
        countries: params.countries || "US",
        max_results: maxPosts,
        ad_status: params.ad_status || "active",
      });
      break;
    default:
      return `Unknown source_type: ${sourceType}. Use: group, page, search, or ads`;
  }

  // Sort by engagement score
  posts.sort((a, b) => {
    const scoreA = a.reactions + a.comments * 3 + a.shares * 5;
    const scoreB = b.reactions + b.comments * 3 + b.shares * 5;
    return scoreB - scoreA;
  });

  return formatPosts(posts, sourceType);
}

// ── Tool definition ────────────────────────────────────────

export const definition: ToolDefinition = {
  name: "facebook_scraper",
  description: [
    "Scrape Facebook content from groups, pages, keyword search, or ads library.",
    "Modes: group (public FB groups), page (FB page posts), search (keyword search), ads (Meta Ad Library, free).",
    "Returns posts sorted by engagement score with reactions, comments, shares.",
  ].join(" "),
  params: {
    source_type: z
      .enum(["group", "page", "search", "ads"])
      .describe("What to scrape: group, page, search, or ads"),
    targets: z
      .string()
      .describe(
        "Comma-separated targets. For group: group URLs. For page: page URLs or names. For search: keywords. For ads: search keywords."
      ),
    max_posts: z.number().min(1).max(500).default(50).describe("Max posts to return (1-500)"),
    sort: z
      .enum(["relevant", "chronological"])
      .default("relevant")
      .describe("Sort order (group mode only)"),
    since: z
      .string()
      .optional()
      .describe("Only posts newer than this date, e.g. 2024-01-01 (group mode only)"),
    countries: z
      .string()
      .default("US")
      .describe("Comma-separated country codes for ads mode, e.g. US,VN"),
    page_ids: z
      .string()
      .optional()
      .describe("Comma-separated Facebook page IDs (ads mode only)"),
    ad_status: z
      .enum(["active", "inactive", "all"])
      .default("active")
      .describe("Ad status filter (ads mode only)"),
  },
  envVars: [], // Auto-detected per mode, not globally required
  execute,
};
