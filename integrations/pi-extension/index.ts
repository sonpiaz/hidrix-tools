/**
 * hidrix-tools — Pi extension
 *
 * Bridges hidrix-tools into pi as native custom tools.
 * Pi doesn't support MCP, so this extension imports tool definitions
 * directly and registers them via pi.registerTool().
 *
 * Tools registered:
 *   - web_search, web_fetch
 *   - x_search, x_thread_reader, x_user_posts
 *   - reddit_search, reddit_thread_reader, reddit_subreddit_top
 *   - facebook_scraper, content_scorer, content_analyzer
 *   - similarweb_traffic, youtube_search, tiktok_search
 *
 * Usage logging: appends to ~/.hidrix-tools/usage.jsonl
 *
 * Install: copy to ~/.pi/agent/extensions/hidrix-tools/
 * Reload: /reload in pi
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { appendFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ── Config ─────────────────────────────────────────────────

const TOOLS_DIR = join(homedir(), "hidrix-tools");
const LOG_DIR = join(homedir(), ".hidrix-tools");
const LOG_FILE = join(LOG_DIR, "usage.jsonl");

// ── Load .env from hidrix-tools ────────────────────────────
// Pi extensions don't auto-load .env, so we do it manually.

function loadDotEnv() {
  const envPath = join(TOOLS_DIR, ".env");
  if (!existsSync(envPath)) return;
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex < 0) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      // Don't override existing env vars
      if (!process.env[key] && value) {
        process.env[key] = value;
      }
    }
  } catch {}
}

loadDotEnv();

// ── Usage logging ──────────────────────────────────────────

function logUsage(tool: string, input: Record<string, any>, status: string, error?: string, ms?: number) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      tool,
      input: Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, typeof v === "string" && v.length > 200 ? v.slice(0, 200) + "..." : v])
      ),
      status,
      ...(error && { error: error.slice(0, 500) }),
      ...(ms && { ms }),
      agent: "pi",
    };
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch {
    // Silent — logging should never break tool execution
  }
}

// ── Tool loader ────────────────────────────────────────────

interface HidrixToolDef {
  name: string;
  description: string;
  execute: (params: Record<string, any>) => Promise<string>;
}

async function loadHidrixTool(toolDir: string): Promise<HidrixToolDef | null> {
  try {
    const mod = await import(join(TOOLS_DIR, "tools", toolDir, "index.ts"));
    if (mod.definition?.name && mod.definition?.execute) {
      return mod.definition;
    }
  } catch (e: any) {
    // Tool not loadable (missing deps, syntax error, etc.)
    return null;
  }
  return null;
}

// ── Tool definitions for pi ────────────────────────────────
// Define pi-compatible schemas for each hidrix tool.
// We use TypeBox (what pi expects) instead of Zod (what hidrix uses internally).

const TOOL_SCHEMAS: Record<string, { label: string; description: string; promptSnippet: string; parameters: any }> = {
  "web-search": {
    label: "Web Search",
    description: "Search the web using Brave Search. Returns titles, URLs, and descriptions.",
    promptSnippet: "Search the web for information",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      count: Type.Optional(Type.Number({ description: "Number of results (1-20)", default: 5 })),
    }),
  },
  "web-fetch": {
    label: "Web Fetch",
    description: "Fetch a URL and extract readable content as markdown. Extracts metadata (author, date, tags). Handles X/Twitter URLs specially.",
    promptSnippet: "Fetch and read any URL as clean markdown",
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" }),
      max_chars: Type.Optional(Type.Number({ description: "Max characters to return", default: 50000 })),
      extract_metadata: Type.Optional(Type.Boolean({ description: "Extract author, date, tags", default: true })),
      js_render: Type.Optional(Type.Boolean({ description: "Use headless browser for JS pages", default: false })),
    }),
  },
  "x-search": {
    label: "X Search",
    description: "Search X/Twitter posts with full engagement data (likes, retweets, replies, views). Supports advanced operators: from:user, min_faves:100, since:YYYY-MM-DD.",
    promptSnippet: "Search X/Twitter posts with engagement data",
    parameters: Type.Object({
      query: Type.String({ description: "Search query. Supports: from:user, min_faves:100, since:YYYY-MM-DD, filter:links" }),
      sort: Type.Optional(StringEnum(["top", "latest"] as const, { description: "Sort order", default: "top" })),
      count: Type.Optional(Type.Number({ description: "Number of results (1-100)", default: 20 })),
    }),
  },
  "x-thread-reader": {
    label: "X Thread Reader",
    description: "Read a full X/Twitter thread, article, or tweet with replies. Detects multi-tweet threads and assembles them in order.",
    promptSnippet: "Read full X/Twitter threads and articles",
    parameters: Type.Object({
      tweet: Type.String({ description: "Tweet URL or numeric tweet ID" }),
      max_replies: Type.Optional(Type.Number({ description: "Max replies to include (0-50)", default: 20 })),
    }),
  },
  "x-user-posts": {
    label: "X User Posts",
    description: "Get recent posts from a specific X/Twitter user with full engagement data.",
    promptSnippet: "Get recent X/Twitter posts from a specific user",
    parameters: Type.Object({
      username: Type.String({ description: "X username (@handle, username, or profile URL)" }),
      count: Type.Optional(Type.Number({ description: "Number of posts (1-100)", default: 20 })),
      include_replies: Type.Optional(Type.Boolean({ description: "Include replies", default: false })),
    }),
  },
  "reddit-search": {
    label: "Reddit Search",
    description: "Search Reddit posts with full content and engagement data. Filter by subreddit, sort, time range.",
    promptSnippet: "Search Reddit posts with full text and engagement",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      sort: Type.Optional(StringEnum(["RELEVANCE", "HOT", "TOP", "NEW", "COMMENTS"] as const, { default: "RELEVANCE" })),
      time: Type.Optional(StringEnum(["all", "year", "month", "week", "day", "hour"] as const, { default: "all" })),
      count: Type.Optional(Type.Number({ description: "Number of results (1-50)", default: 20 })),
      subreddit: Type.Optional(Type.String({ description: "Limit to specific subreddit" })),
      max_text_length: Type.Optional(Type.Number({ description: "Max chars for post text", default: 1000 })),
    }),
  },
  "reddit-thread-reader": {
    label: "Reddit Thread Reader",
    description: "Read a full Reddit post with comment tree. Uses free Reddit JSON API — no API key needed.",
    promptSnippet: "Read full Reddit post + comments",
    parameters: Type.Object({
      post_url: Type.String({ description: "Reddit post URL" }),
      max_comments: Type.Optional(Type.Number({ description: "Max comments (1-100)", default: 30 })),
      max_depth: Type.Optional(Type.Number({ description: "Max reply depth (1-10)", default: 3 })),
      sort: Type.Optional(StringEnum(["best", "top", "new", "controversial"] as const, { default: "best" })),
    }),
  },
  "reddit-subreddit-top": {
    label: "Reddit Subreddit Top",
    description: "Get top posts from a specific subreddit. Uses free Reddit JSON API.",
    promptSnippet: "Get top posts from any subreddit",
    parameters: Type.Object({
      subreddit: Type.String({ description: "Subreddit name (e.g. MachineLearning)" }),
      sort: Type.Optional(StringEnum(["top", "hot", "new", "rising"] as const, { default: "top" })),
      time: Type.Optional(StringEnum(["day", "week", "month", "year", "all"] as const, { default: "week" })),
      count: Type.Optional(Type.Number({ description: "Number of posts (1-100)", default: 20 })),
    }),
  },
  "facebook-scraper": {
    label: "Facebook Scraper",
    description: "Scrape Facebook groups, pages, keyword search, or Meta Ad Library. 4 modes: group, page, search, ads.",
    promptSnippet: "Scrape Facebook content (groups, pages, ads)",
    parameters: Type.Object({
      source_type: StringEnum(["group", "page", "search", "ads"] as const, { description: "What to scrape" }),
      targets: Type.String({ description: "Comma-separated: group URLs, page URLs/names, keywords, or ad search terms" }),
      max_posts: Type.Optional(Type.Number({ description: "Max posts (1-500)", default: 50 })),
      sort: Type.Optional(StringEnum(["relevant", "chronological"] as const, { default: "relevant" })),
      since: Type.Optional(Type.String({ description: "Only posts newer than YYYY-MM-DD (group mode)" })),
      countries: Type.Optional(Type.String({ description: "Country codes for ads mode (e.g. US,VN)", default: "US" })),
      page_ids: Type.Optional(Type.String({ description: "FB page IDs for ads mode" })),
      ad_status: Type.Optional(StringEnum(["active", "inactive", "all"] as const, { default: "active" })),
    }),
  },
  "content-scorer": {
    label: "Content Scorer",
    description: "Score and rank posts by weighted engagement with time-decay. Input: JSON array of posts.",
    promptSnippet: "Score and rank content by engagement",
    parameters: Type.Object({
      posts_json: Type.String({ description: "JSON array of post objects" }),
      top_n: Type.Optional(Type.Number({ description: "Return top N posts", default: 100 })),
      w_reactions: Type.Optional(Type.Number({ description: "Weight for reactions (0-1)", default: 0.4 })),
      w_comments: Type.Optional(Type.Number({ description: "Weight for comments (0-1)", default: 0.3 })),
      w_shares: Type.Optional(Type.Number({ description: "Weight for shares (0-1)", default: 0.2 })),
      w_recency: Type.Optional(Type.Number({ description: "Weight for recency (0-1)", default: 0.1 })),
    }),
  },

  "linkedin-search": {
    label: "LinkedIn Search",
    description: "Search LinkedIn posts by keyword with engagement data. No login needed.",
    promptSnippet: "Search LinkedIn posts with engagement data",
    parameters: Type.Object({
      query: Type.String({ description: "Search keywords. Comma-separate for multiple queries." }),
      max_posts: Type.Optional(Type.Number({ description: "Max posts (1-100)", default: 20 })),
      sort: Type.Optional(StringEnum(["engagement", "recent", "reactions", "comments"] as const, { default: "engagement" })),
      date_filter: Type.Optional(StringEnum(["any", "past-24h", "past-week", "past-month"] as const, { default: "any" })),
      min_engagement: Type.Optional(Type.Number({ description: "Min engagement threshold", default: 0 })),
    }),
  },
  "linkedin-profile": {
    label: "LinkedIn Profile",
    description: "Get recent posts from a LinkedIn profile with engagement data. No login needed.",
    promptSnippet: "Get LinkedIn profile's recent posts",
    parameters: Type.Object({
      profile_url: Type.String({ description: "LinkedIn profile URL or username" }),
      max_posts: Type.Optional(Type.Number({ description: "Max posts (1-50)", default: 20 })),
    }),
  },
  "content-analyzer": {
    label: "Content Analyzer",
    description: "Analyze posts for topic clusters, content patterns, posting time trends, and author leaderboard.",
    promptSnippet: "Analyze content for topics, patterns, and trends",
    parameters: Type.Object({
      posts_json: Type.String({ description: "JSON array of post objects" }),
      analysis_type: Type.Optional(StringEnum(["full", "topics", "patterns", "trends"] as const, { default: "full" })),
    }),
  },
};

// ── Main extension ─────────────────────────────────────────

export default function hidrixToolsExtension(pi: ExtensionAPI) {
  let loadedCount = 0;
  let skippedCount = 0;

  // Load and register each tool
  for (const [toolDir, schema] of Object.entries(TOOL_SCHEMAS)) {
    // Try to load the hidrix tool module
    const toolPath = join(TOOLS_DIR, "tools", toolDir, "index.ts");

    pi.registerTool({
      name: `hidrix_${toolDir.replace(/-/g, "_")}`,
      label: schema.label,
      description: schema.description,
      promptSnippet: schema.promptSnippet,
      parameters: schema.parameters,

      async execute(toolCallId, params, signal, onUpdate, ctx) {
        const startMs = Date.now();

        try {
          // Dynamically import the hidrix tool
          const mod = await import(toolPath);
          const def = mod.definition;

          if (!def?.execute) {
            throw new Error(`Tool ${toolDir} has no execute function`);
          }

          // Stream progress
          onUpdate?.({
            content: [{ type: "text", text: `Calling ${schema.label}...` }],
            details: {},
          });

          // Execute
          const result = await def.execute(params);
          const elapsed = Date.now() - startMs;

          // Log usage
          logUsage(toolDir, params, "ok", undefined, elapsed);

          return {
            content: [{ type: "text", text: result }],
            details: { elapsed },
          };
        } catch (e: any) {
          const elapsed = Date.now() - startMs;
          logUsage(toolDir, params, "error", e.message, elapsed);
          throw e; // Let pi handle the error
        }
      },
    });

    loadedCount++;
  }

  // Register /hidrix command for status
  pi.registerCommand("hidrix", {
    description: "Show hidrix-tools status and usage stats",
    handler: async (_args, ctx) => {
      const lines = [
        `hidrix-tools: ${loadedCount} tools registered`,
        `Tools dir: ${TOOLS_DIR}`,
        `Usage log: ${LOG_FILE}`,
      ];

      // Show recent usage if log exists
      if (existsSync(LOG_FILE)) {
        try {
          const { readFileSync } = await import("node:fs");
          const logContent = readFileSync(LOG_FILE, "utf8");
          const entries = logContent.trim().split("\n").filter(Boolean);
          const recent = entries.slice(-5);
          lines.push("", `Recent usage (${entries.length} total):`);
          for (const line of recent) {
            try {
              const entry = JSON.parse(line);
              lines.push(`  ${entry.ts?.slice(11, 19)} ${entry.tool} ${entry.status} ${entry.ms ? entry.ms + "ms" : ""}`);
            } catch {}
          }
        } catch {}
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // Log extension load
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus("hidrix", `hidrix-tools: ${loadedCount} tools`);
  });
}
