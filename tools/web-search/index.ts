import { z } from "zod";
import { tavily } from "@tavily/core";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { requireEnv } from "../../lib/rapidapi.js";

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

function formatResults(results: SearchResult[], query: string): string {
  if (results.length === 0) return `No results found for: "${query}"`;
  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description}`)
    .join("\n\n");
}

async function searchBrave(query: string, count: number): Promise<SearchResult[]> {
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
    throw new Error(`Brave Search error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { web?: { results?: SearchResult[] } };
  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

async function searchTavily(query: string, count: number): Promise<SearchResult[]> {
  const apiKey = requireEnv("TAVILY_API_KEY");
  const client = tavily({ apiKey });

  const response = await client.search(query, {
    maxResults: Math.min(Math.max(count, 1), 20),
  });

  return (response.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.content,
  }));
}

function getSearchProvider(): "brave" | "tavily" {
  const provider = process.env.SEARCH_PROVIDER?.toLowerCase();
  if (provider === "tavily") return "tavily";
  return "brave";
}

async function execute({ query, count }: { query: string; count: number }): Promise<string> {
  const provider = getSearchProvider();

  if (provider === "tavily") {
    try {
      const results = await searchTavily(query, count);
      return formatResults(results, query);
    } catch (err) {
      // Fall back to Brave if Tavily fails and BRAVE_API_KEY is available
      if (process.env.BRAVE_API_KEY) {
        try {
          const results = await searchBrave(query, count);
          return formatResults(results, query);
        } catch {
          // Both providers failed; return original Tavily error
        }
      }
      return `Tavily Search error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  try {
    const results = await searchBrave(query, count);
    return formatResults(results, query);
  } catch (err) {
    // Fall back to Tavily if Brave fails and TAVILY_API_KEY is available
    if (process.env.TAVILY_API_KEY) {
      try {
        const results = await searchTavily(query, count);
        return formatResults(results, query);
      } catch {
        // Both providers failed; return original Brave error
      }
    }
    return err instanceof Error ? err.message : String(err);
  }
}

export const definition: ToolDefinition = {
  name: "web_search",
  description: "Search the web using Brave Search or Tavily. Returns titles, URLs, and descriptions.",
  params: {
    query: z.string().describe("Search query"),
    count: z.number().min(1).max(20).default(5).describe("Number of results (1-20)"),
  },
  envVars: ["BRAVE_API_KEY"],
  execute,
};
