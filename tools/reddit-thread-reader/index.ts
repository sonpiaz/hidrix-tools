/**
 * reddit_thread_reader — Read full Reddit post + comment tree.
 *
 * Uses Reddit's public JSON API (no API key needed!):
 *   {reddit_url}.json → full post + comments
 *
 * No RapidAPI dependency — works for free.
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function extractRedditUrl(input: string): string {
  // Accept full URL or /r/sub/comments/id/... format
  if (input.startsWith("http")) {
    const url = new URL(input);
    return `https://www.reddit.com${url.pathname}`;
  }
  if (input.startsWith("/r/") || input.startsWith("r/")) {
    const path = input.startsWith("/") ? input : `/${input}`;
    return `https://www.reddit.com${path}`;
  }
  throw new Error(`Invalid Reddit URL: ${input}. Use a full URL or /r/sub/comments/id format.`);
}

interface Comment {
  author: string;
  score: number;
  text: string;
  depth: number;
  replies: Comment[];
}

function parseComments(children: any[], maxDepth: number, depth = 0): Comment[] {
  if (depth > maxDepth || !Array.isArray(children)) return [];

  return children
    .filter((c: any) => c.kind === "t1" && c.data?.body)
    .map((c: any) => {
      const d = c.data;
      const replies = d.replies?.data?.children
        ? parseComments(d.replies.data.children, maxDepth, depth + 1)
        : [];
      return {
        author: d.author || "[deleted]",
        score: d.score ?? 0,
        text: d.body || "",
        depth,
        replies,
      };
    });
}

function flattenComments(comments: Comment[], result: Comment[] = []): Comment[] {
  for (const c of comments) {
    result.push(c);
    if (c.replies.length > 0) flattenComments(c.replies, result);
  }
  return result;
}

function formatComment(c: Comment, index: number): string {
  const indent = "  ".repeat(c.depth);
  const prefix = c.depth === 0 ? `${index}.` : "└─";
  const scoreStr = c.score >= 0 ? `⬆️${formatNumber(c.score)}` : `⬇️${formatNumber(Math.abs(c.score))}`;
  const text = c.text.slice(0, 500).replace(/\n/g, `\n${indent}  `);
  return `${indent}${prefix} **u/${c.author}** (${scoreStr}): ${text}${c.text.length > 500 ? "..." : ""}`;
}

async function execute(params: Record<string, any>): Promise<string> {
  const postUrl = extractRedditUrl(params.post_url as string);
  const maxComments = (params.max_comments as number) || 30;
  const maxDepth = (params.max_depth as number) || 3;
  const sortComments = (params.sort as string) || "best";

  // Fetch Reddit JSON (free, no API key!)
  const jsonUrl = `${postUrl}.json?sort=${sortComments}&limit=${maxComments}`;
  const response = await fetch(jsonUrl, {
    headers: {
      "User-Agent": "hidrix-tools/1.0 (MCP tool server)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    return `Error fetching Reddit post: ${response.status} ${response.statusText}`;
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length < 1) {
    return "Could not parse Reddit response. The post may be deleted or private.";
  }

  // Parse post
  const postData = data[0]?.data?.children?.[0]?.data;
  if (!postData) return "Post not found.";

  const title = postData.title || "";
  const subreddit = postData.subreddit || "";
  const author = postData.author || "[deleted]";
  const score = postData.score ?? 0;
  const numComments = postData.num_comments ?? 0;
  const upvoteRatio = postData.upvote_ratio ? `${Math.round(postData.upvote_ratio * 100)}%` : "";
  const selftext = postData.selftext || "";
  const url = postData.url || postUrl;
  const created = postData.created_utc ? new Date(postData.created_utc * 1000).toISOString().split("T")[0] : "";

  // Parse comments
  const commentsRaw = data[1]?.data?.children || [];
  const comments = parseComments(commentsRaw, maxDepth);
  const flat = flattenComments(comments).slice(0, maxComments);

  // Build output
  const sections: string[] = [];

  sections.push(`## ${title}`);
  sections.push(`**r/${subreddit}** | ⬆️${formatNumber(score)} | 💬${formatNumber(numComments)} | 📊${upvoteRatio} | 👤 u/${author} | 📅 ${created}`);
  sections.push(`🔗 ${postUrl}`);
  sections.push("");

  if (selftext) {
    sections.push("### Post Content\n");
    sections.push(selftext.slice(0, 5000));
    if (selftext.length > 5000) sections.push("\n*[text truncated]*");
    sections.push("");
  }

  if (flat.length > 0) {
    sections.push(`### Comments (${flat.length} shown of ${numComments} total)\n`);
    let topLevelIndex = 0;
    for (const c of flat) {
      if (c.depth === 0) topLevelIndex++;
      sections.push(formatComment(c, topLevelIndex));
    }
  }

  return sections.join("\n");
}

export const definition: ToolDefinition = {
  name: "reddit_thread_reader",
  description: [
    "Read a full Reddit post with comment tree.",
    "Shows post content, engagement stats, and threaded comments with scores.",
    "Uses Reddit's free public JSON API — no API key needed.",
  ].join(" "),
  params: {
    post_url: z.string().describe("Reddit post URL (e.g. https://reddit.com/r/sub/comments/id/title)"),
    max_comments: z.number().min(1).max(100).default(30).describe("Max comments to show (1-100)"),
    max_depth: z.number().min(1).max(10).default(3).describe("Max comment reply depth (1-10)"),
    sort: z.enum(["best", "top", "new", "controversial"]).default("best").describe("Comment sort order"),
  },
  // No envVars needed! Uses Reddit's free public JSON API
  execute,
};
