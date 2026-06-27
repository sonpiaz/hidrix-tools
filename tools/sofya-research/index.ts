/**
 * sofya_research: Deep research with Sofya.
 *
 * Breaks a question into sub-queries, searches multiple sources, and returns
 * a synthesized, cited report. Slower and more expensive than a single
 * search, so use it for open-ended questions that need real synthesis.
 *
 * Provider: Sofya (https://sofya.co)
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { requireEnv } from "../../lib/rapidapi.js";

interface SofyaResearchSource {
  title: string;
  url: string;
}

interface SofyaResearchResponse {
  report?: string;
  sources?: SofyaResearchSource[];
}

async function execute(params: Record<string, any>): Promise<string> {
  const query = params.query as string;
  const maxSources = (params.max_sources as number) ?? 20;
  const topic = (params.topic as string) || "general";

  const apiKey = requireEnv("SOFYA_API_KEY");

  const response = await fetch("https://sofya.co/v1/research", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_sources: Math.min(Math.max(maxSources, 1), 30),
      topic,
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    return `Sofya research error: ${response.status} ${response.statusText}`;
  }

  const data = (await response.json()) as SofyaResearchResponse;
  const report = data.report?.trim();

  if (!report) return `No report generated for: "${query}"`;

  const sources = data.sources ?? [];
  if (sources.length === 0) return report;

  const sourceList = sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join("\n");
  return `${report}\n\n## Sources\n\n${sourceList}`;
}

export const definition: ToolDefinition = {
  name: "sofya_research",
  description:
    "Deep research with Sofya. Breaks a question into sub-queries, searches multiple sources, and returns a synthesized, cited report. Use it for open-ended questions that need synthesis across many sources.",
  params: {
    query: z.string().describe("The research question or topic"),
    max_sources: z.number().min(1).max(30).default(20).describe("Maximum number of sources to use (1-30)"),
    topic: z.enum(["general", "news"]).default("general").describe("Use 'news' for current events and breaking news"),
  },
  envVars: ["SOFYA_API_KEY"],
  execute,
};
