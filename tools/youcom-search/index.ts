/**
 * You.com Search — Web search via You.com API.
 *
 * Provides web search results (titles, URLs, descriptions) as an alternative
 * to the Brave-powered web_search tool. Requires YDC_API_KEY.
 *
 * Get a free API key at https://you.com/platform/api-keys
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { requireEnv } from "../../lib/rapidapi.js";

interface YouResult {
  title: string;
  url: string;
  snippet: string;
}

interface YouSearchResponse {
  results?: YouResult[];
  search_metadata?: {
    total_results?: number;
  };
}

async function execute({ query, count }: { query: string; count: number }): Promise<string> {
  const apiKey = requireEnv("YDC_API_KEY");

  const url = new URL("https://api.you.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("num_results", String(Math.min(Math.max(count, 1), 20)));

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    return `You.com Search error: ${response.status} ${response.statusText}`;
  }

  const data = (await response.json()) as YouSearchResponse;
  const results = data.results ?? [];

  if (results.length === 0) {
    return `No results found for: "${query}"`;
  }

  return results
    .map(
      (r, i) =>
        `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`,
    )
    .join("\n\n");
}

export const definition: ToolDefinition = {
  name: "youcom_search",
  description:
    "Search the web using You.com. Returns titles, URLs, and descriptions. Alternative to web_search.",
  params: {
    query: z.string().describe("Search query"),
    count: z
      .number()
      .min(1)
      .max(20)
      .default(5)
      .describe("Number of results (1-20)"),
  },
  envVars: ["YDC_API_KEY"],
  execute,
};