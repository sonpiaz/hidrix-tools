/**
 * sofya_search: Search the web with Sofya.
 *
 * Returns full page content for each result, not just snippets, with an
 * optional AI-synthesized answer.
 *
 * Provider: Sofya (https://sofya.co)
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { requireEnv } from "../../lib/rapidapi.js";

interface SofyaSearchResult {
  title: string;
  url: string;
  content?: string;
}

interface SofyaSearchResponse {
  answer?: string | null;
  results?: SofyaSearchResult[];
}

async function execute(params: Record<string, any>): Promise<string> {
  const query = params.query as string;
  const count = (params.count as number) ?? 5;
  const includeAnswer = (params.include_answer as boolean) ?? false;
  const topic = (params.topic as string) || "general";

  const apiKey = requireEnv("SOFYA_API_KEY");

  const response = await fetch("https://sofya.co/v1/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: Math.min(Math.max(count, 1), 20),
      include_answer: includeAnswer,
      topic,
      search_depth: "basic",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    return `Sofya search error: ${response.status} ${response.statusText}`;
  }

  const data = (await response.json()) as SofyaSearchResponse;
  const results = data.results ?? [];

  if (results.length === 0) return `No results found for: "${query}"`;

  const blocks = results.map((r, i) => {
    const body = (r.content ?? "").trim().slice(0, 800);
    return `${i + 1}. **${r.title}**\n   ${r.url}\n   ${body}`;
  });

  const answer = data.answer?.trim();
  return answer ? `**Answer:** ${answer}\n\n${blocks.join("\n\n")}` : blocks.join("\n\n");
}

export const definition: ToolDefinition = {
  name: "sofya_search",
  description:
    "Search the web with Sofya. Returns full page content for each result, not just snippets, with an optional AI-synthesized answer.",
  params: {
    query: z.string().describe("Search query"),
    count: z.number().min(1).max(20).default(5).describe("Number of results (1-20)"),
    include_answer: z.boolean().default(false).describe("Add an AI-synthesized answer built from the results"),
    topic: z.enum(["general", "news"]).default("general").describe("Use 'news' for current events and breaking news"),
  },
  envVars: ["SOFYA_API_KEY"],
  execute,
};
