/**
 * Web search via Brave Search API.
 * Free tier: 2000 queries/month.
 * Docs: https://api.search.brave.com/app/documentation/web-search
 */

import { requireEnv } from "../lib/rapidapi.js";

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

export async function webSearch(query: string, count: number = 5): Promise<string> {
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

  const data = await response.json() as { web?: { results?: BraveResult[] } };
  const results = data.web?.results ?? [];

  if (results.length === 0) {
    return `No results found for: "${query}"`;
  }

  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description}`)
    .join("\n\n");
}
