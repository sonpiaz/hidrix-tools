import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { requireEnv } from "../../lib/rapidapi.js";

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

async function execute({ query, count }: { query: string; count: number }): Promise<string> {
  const apiKey = requireEnv("BRAVE_API_KEY");

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(Math.max(count, 1), 20)));

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    return `Brave Search error: ${response.status} ${response.statusText}`;
  }

  const data = (await response.json()) as { web?: { results?: BraveResult[] } };
  const results = data.web?.results ?? [];

  if (results.length === 0) return `No results found for: "${query}"`;

  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description}`)
    .join("\n\n");
}

export const definition: ToolDefinition = {
  name: "web_search",
  description: "Search the web using Brave Search. Returns titles, URLs, and descriptions.",
  params: {
    query: z.string().describe("Search query"),
    count: z.number().min(1).max(20).default(5).describe("Number of results (1-20)"),
  },
  envVars: ["BRAVE_API_KEY"],
  execute,
};
