/**
 * content_scorer — Score and rank posts by weighted engagement.
 *
 * Takes JSON array of posts, applies weighted scoring with time-decay,
 * returns top N ranked posts.
 *
 * No external API needed — pure computation.
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";

interface ScoredPost {
  rank: number;
  score: number;
  text: string;
  author: string;
  url: string;
  timestamp: string;
  reactions: number;
  comments: number;
  shares: number;
  source_type: string;
}

function computeScore(
  post: any,
  weights: { reactions: number; comments: number; shares: number; recency: number },
  now: number
): number {
  const reactions = Number(post.reactions) || 0;
  const comments = Number(post.comments) || 0;
  const shares = Number(post.shares) || 0;

  // Raw engagement score
  const rawScore =
    reactions * weights.reactions +
    comments * weights.comments +
    shares * weights.shares;

  // Time decay: halve score every 30 days
  let decayFactor = 1;
  if (weights.recency > 0 && post.timestamp) {
    const postTime = new Date(post.timestamp).getTime();
    if (!isNaN(postTime)) {
      const daysSince = (now - postTime) / (1000 * 60 * 60 * 24);
      decayFactor = Math.pow(0.5, (daysSince / 30) * weights.recency);
    }
  }

  return Math.round(rawScore * decayFactor * 100) / 100;
}

async function execute(params: Record<string, any>): Promise<string> {
  const postsJson = params.posts_json as string;
  const topN = (params.top_n as number) || 100;
  const wReactions = (params.w_reactions as number) ?? 0.4;
  const wComments = (params.w_comments as number) ?? 0.3;
  const wShares = (params.w_shares as number) ?? 0.2;
  const wRecency = (params.w_recency as number) ?? 0.1;

  let posts: any[];
  try {
    posts = JSON.parse(postsJson);
    if (!Array.isArray(posts)) throw new Error("not array");
  } catch {
    return "Error: posts_json must be a valid JSON array of post objects";
  }

  if (posts.length === 0) return "No posts to score.";

  const now = Date.now();
  const weights = { reactions: wReactions, comments: wComments, shares: wShares, recency: wRecency };

  // Normalize: find max values for relative scoring
  const maxReactions = Math.max(1, ...posts.map((p) => Number(p.reactions) || 0));
  const maxComments = Math.max(1, ...posts.map((p) => Number(p.comments) || 0));
  const maxShares = Math.max(1, ...posts.map((p) => Number(p.shares) || 0));

  const scored: ScoredPost[] = posts.map((p) => {
    // Normalize engagement to 0-100 scale before weighting
    const normalized = {
      ...p,
      reactions: ((Number(p.reactions) || 0) / maxReactions) * 100,
      comments: ((Number(p.comments) || 0) / maxComments) * 100,
      shares: ((Number(p.shares) || 0) / maxShares) * 100,
    };
    return {
      rank: 0,
      score: computeScore(normalized, weights, now),
      text: (p.text || "").slice(0, 200),
      author: p.author || "unknown",
      url: p.url || "",
      timestamp: p.timestamp || "",
      reactions: Number(p.reactions) || 0,
      comments: Number(p.comments) || 0,
      shares: Number(p.shares) || 0,
      source_type: p.source_type || "",
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top N and assign ranks
  const topPosts = scored.slice(0, topN);
  topPosts.forEach((p, i) => (p.rank = i + 1));

  // Format output
  const header = `## Top ${topPosts.length} posts (of ${posts.length} total)\n`;
  header + `Weights: reactions=${wReactions} comments=${wComments} shares=${wShares} recency=${wRecency}\n`;

  const lines = topPosts.map((p) => {
    return [
      `**#${p.rank}** Score: ${p.score} | 👍${p.reactions} 💬${p.comments} 🔄${p.shares}`,
      `> ${p.text}${p.text.length >= 200 ? "..." : ""}`,
      `By: ${p.author} | ${p.timestamp} | ${p.url}`,
    ].join("\n");
  });

  // Also output JSON for piping to content_analyzer
  const jsonOutput = JSON.stringify(topPosts, null, 2);

  return `${header}\n${lines.join("\n\n")}\n\n---\n\n<json>\n${jsonOutput}\n</json>`;
}

export const definition: ToolDefinition = {
  name: "content_scorer",
  description:
    "Score and rank posts by weighted engagement (reactions, comments, shares) with time-decay. Input: JSON array of posts. Output: top N ranked posts with scores.",
  params: {
    posts_json: z.string().describe("JSON array of post objects with fields: text, author, url, timestamp, reactions, comments, shares"),
    top_n: z.number().min(1).max(500).default(100).describe("Return top N posts"),
    w_reactions: z.number().min(0).max(1).default(0.4).describe("Weight for reactions (0-1)"),
    w_comments: z.number().min(0).max(1).default(0.3).describe("Weight for comments (0-1)"),
    w_shares: z.number().min(0).max(1).default(0.2).describe("Weight for shares (0-1)"),
    w_recency: z.number().min(0).max(1).default(0.1).describe("Weight for recency time-decay (0-1)"),
  },
  execute,
};
