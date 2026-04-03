/**
 * Hidrix Tools — MCP Server
 *
 * Standalone MCP server exposing web search, web fetch, and social media
 * search tools. Works with Claude Code, Pi agent, OpenClaw, or any MCP client.
 *
 * Usage:
 *   bun run server.ts
 *
 * Configure in ~/.claude/settings.json:
 *   { "mcpServers": { "hidrix-tools": { "command": "bun", "args": ["run", "/Users/sonpiaz/hidrix-tools/server.ts"] } } }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { webSearch } from "./tools/web-search.js";
import { webFetch } from "./tools/web-fetch.js";
import { xSearch } from "./tools/x-search.js";
import { redditSearch } from "./tools/reddit-search.js";
import { youtubeSearch } from "./tools/youtube-search.js";
import { tiktokSearch } from "./tools/tiktok-search.js";
import { similarwebTraffic } from "./tools/similarweb.js";

const server = new McpServer({
  name: "hidrix-tools",
  version: "1.0.0",
});

// --- Web Search (Brave) ---
server.tool(
  "web_search",
  "Search the web using Brave Search. Returns titles, URLs, and descriptions.",
  {
    query: z.string().describe("Search query"),
    count: z.number().min(1).max(20).default(5).describe("Number of results (1-20)"),
  },
  async ({ query, count }) => {
    try {
      const result = await webSearch(query, count);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  },
);

// --- Web Fetch ---
server.tool(
  "web_fetch",
  "Fetch a URL and extract readable content as markdown. Uses Mozilla Readability for clean article extraction.",
  {
    url: z.string().url().describe("URL to fetch (http or https)"),
    maxChars: z.number().min(100).max(100000).default(50000).describe("Max characters to return"),
  },
  async ({ url, maxChars }) => {
    try {
      const result = await webFetch(url, maxChars);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  },
);

// --- X/Twitter Search ---
server.tool(
  "x_search",
  "Search X/Twitter posts. Returns top tweets matching the query. Requires RAPIDAPI_KEY + X_SEARCH_URL + X_API_HOST env vars.",
  {
    query: z.string().describe("Search query for X/Twitter"),
  },
  async ({ query }) => {
    try {
      const result = await xSearch(query);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  },
);

// --- Reddit Search ---
server.tool(
  "reddit_search",
  "Search Reddit posts. Returns relevant posts with scores, comments, and content. Requires RAPIDAPI_KEY + REDDIT_SEARCH_URL + REDDIT_API_HOST env vars.",
  {
    query: z.string().describe("Search query for Reddit"),
    sort: z.enum(["RELEVANCE", "HOT", "TOP", "NEW", "COMMENTS"]).default("RELEVANCE").describe("Sort order"),
    time: z.enum(["all", "year", "month", "week", "day", "hour"]).default("all").describe("Time filter"),
  },
  async ({ query, sort, time }) => {
    try {
      const result = await redditSearch(query, sort, time);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  },
);

// --- YouTube Search ---
server.tool(
  "youtube_search",
  "Search YouTube videos. Returns titles, channels, URLs, and descriptions. Requires RAPIDAPI_KEY env var.",
  {
    query: z.string().describe("Search query for YouTube"),
    maxResults: z.number().min(1).max(50).default(10).describe("Number of results"),
  },
  async ({ query, maxResults }) => {
    try {
      const result = await youtubeSearch(query, maxResults);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  },
);

// --- TikTok Search ---
server.tool(
  "tiktok_search",
  "Search TikTok videos. Returns videos with author, play counts, likes, and descriptions. Requires RAPIDAPI_KEY env var.",
  {
    keyword: z.string().describe("Search keyword for TikTok"),
  },
  async ({ keyword }) => {
    try {
      const result = await tiktokSearch(keyword);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  },
);

// --- SimilarWeb Traffic ---
server.tool(
  "similarweb_traffic",
  "Get website traffic analytics from SimilarWeb. Returns rank, visits, engagement, traffic sources. Requires SIMILAR_WEB_RAPIDAPI_KEY + SIMILAR_WEB_URL + SIMILAR_WEB_API_HOST env vars.",
  {
    domain: z.string().describe("Domain to analyze (e.g. 'example.com')"),
  },
  async ({ domain }) => {
    try {
      const result = await similarwebTraffic(domain);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
    }
  },
);

// --- Start server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("hidrix-tools MCP server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
