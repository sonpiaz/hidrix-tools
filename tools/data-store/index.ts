/**
 * data_store — Save and query scraped posts from persistent storage.
 *
 * Actions:
 *   save   — Save posts JSON to SQLite (deduplicates automatically)
 *   query  — Query stored posts by platform, source, score, date
 *   stats  — Show storage statistics
 *   recent — Show recent scrape runs
 *
 * Storage: ~/.hidrix-tools/data.db (SQLite, zero config)
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { savePosts, queryPosts, getStats, getRecentRuns, type StoredPost } from "../../lib/storage.js";
import { createHash } from "node:crypto";

function generatePostId(post: any): string {
  const key = `${post.url || ""}|${post.text?.slice(0, 100) || ""}|${post.author || ""}`;
  return createHash("md5").update(key).digest("hex").slice(0, 16);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function execute(params: Record<string, any>): Promise<string> {
  const action = params.action as string;

  switch (action) {
    case "save": {
      const postsJson = params.posts_json as string;
      if (!postsJson) return "Error: posts_json is required for save action";

      let posts: any[];
      try {
        posts = JSON.parse(postsJson);
        if (!Array.isArray(posts)) throw new Error("not array");
      } catch {
        return "Error: posts_json must be a valid JSON array";
      }

      const storedPosts: StoredPost[] = posts.map((p) => ({
        id: p.id || generatePostId(p),
        platform: p.platform || p.source_type || "unknown",
        source: p.source || "",
        source_type: p.source_type || "",
        author: p.author || "",
        text: p.text || "",
        url: p.url || "",
        timestamp: p.timestamp || "",
        reactions: Number(p.reactions) || 0,
        comments: Number(p.comments) || 0,
        shares: Number(p.shares) || 0,
        score: (Number(p.reactions) || 0) + (Number(p.comments) || 0) * 3 + (Number(p.shares) || 0) * 5,
        raw_json: JSON.stringify(p),
      }));

      const result = savePosts(storedPosts);
      return `✅ Saved ${result.saved} posts (${result.skipped} duplicates skipped). Total stored: ${getStats().totalPosts}`;
    }

    case "query": {
      const results = queryPosts({
        platform: params.platform || undefined,
        source: params.source || undefined,
        minScore: params.min_score || undefined,
        since: params.since || undefined,
        limit: params.limit || 20,
        orderBy: params.order_by || "score",
      });

      if (results.length === 0) return "No posts found matching criteria.";

      const header = `## Stored posts — ${results.length} results\n`;
      const lines = results.map((p, i) => {
        const engagement = `👍${formatNumber(p.reactions)} 💬${formatNumber(p.comments)} 🔄${formatNumber(p.shares)}`;
        return [
          `**${i + 1}.** [${p.platform}] ${p.author || "unknown"} ${engagement} (score:${Math.round(p.score)})`,
          `> ${(p.text || "").slice(0, 200)}${(p.text || "").length > 200 ? "..." : ""}`,
          `📅 ${p.timestamp || p.scraped_at} | 🔗 ${p.url || "no url"}`,
        ].join("\n");
      });

      return header + "\n" + lines.join("\n\n");
    }

    case "stats": {
      const stats = getStats();
      const sections: string[] = [];
      sections.push("## hidrix-tools Storage Stats\n");
      sections.push(`- **Total posts:** ${formatNumber(stats.totalPosts)}`);
      sections.push(`- **Total runs:** ${stats.totalRuns}`);
      sections.push(`- **Scheduled jobs:** ${stats.totalJobs}`);
      sections.push("");

      if (stats.platforms.length > 0) {
        sections.push("### Posts by platform\n");
        sections.push("| Platform | Posts |");
        sections.push("|---|---|");
        for (const p of stats.platforms as any[]) {
          sections.push(`| ${p.platform} | ${formatNumber(p.c)} |`);
        }
        sections.push("");
      }

      if (stats.recentRuns.length > 0) {
        sections.push("### Recent runs\n");
        for (const r of stats.recentRuns as any[]) {
          const status = r.status === "ok" ? "✅" : "❌";
          sections.push(`${status} ${r.tool} — ${r.items_count} items (${r.new_items} new) — ${r.duration_ms}ms — ${r.started_at}`);
        }
      }

      return sections.join("\n");
    }

    case "recent": {
      const runs = getRecentRuns(params.limit || 10);
      if (runs.length === 0) return "No runs recorded yet.";

      const lines = runs.map((r: any) => {
        const status = r.status === "ok" ? "✅" : "❌";
        return `${status} ${r.started_at} | ${r.tool} | ${r.items_count} items (${r.new_items} new) | ${r.duration_ms}ms${r.error ? ` | Error: ${r.error}` : ""}`;
      });

      return `## Recent runs (${runs.length})\n\n${lines.join("\n")}`;
    }

    default:
      return `Unknown action: ${action}. Use: save, query, stats, recent`;
  }
}

export const definition: ToolDefinition = {
  name: "data_store",
  description: [
    "Save and query scraped posts from persistent SQLite storage.",
    "Actions: save (store posts, auto-dedup), query (search stored posts), stats (storage overview), recent (run history).",
    "Use after scraping to build a knowledge base that persists across sessions.",
  ].join(" "),
  params: {
    action: z.enum(["save", "query", "stats", "recent"]).describe("Action: save, query, stats, or recent"),
    posts_json: z.string().optional().describe("JSON array of posts (for save action)"),
    platform: z.string().optional().describe("Filter by platform: x, reddit, facebook, linkedin (for query)"),
    source: z.string().optional().describe("Filter by source URL or name (for query)"),
    min_score: z.number().optional().describe("Min engagement score (for query)"),
    since: z.string().optional().describe("Only posts scraped after this date, e.g. 2024-01-01 (for query)"),
    limit: z.number().min(1).max(500).default(20).describe("Max results (for query/recent)"),
    order_by: z.enum(["score", "timestamp", "scraped_at"]).default("score").describe("Sort order (for query)"),
  },
  execute,
};
