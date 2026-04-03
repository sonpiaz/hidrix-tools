import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { rapidApiGet, requireEnv } from "../../lib/rapidapi.js";

async function execute({ domain }: { domain: string }): Promise<string> {
  const config = {
    baseUrl: requireEnv("SIMILAR_WEB_URL"),
    host: requireEnv("SIMILAR_WEB_API_HOST"),
    apiKey: requireEnv("SIMILAR_WEB_RAPIDAPI_KEY"),
  };

  const result = await rapidApiGet(config, "get-analysis", { url: domain });
  if (result.error) return result.error;

  const data = result.data as any;
  const lines: string[] = [`# ${domain} — Traffic Analytics`];

  if (data?.GlobalRank?.Rank) lines.push(`**Global Rank:** #${data.GlobalRank.Rank}`);
  if (data?.CountryRank?.Rank) lines.push(`**Country Rank:** #${data.CountryRank.Rank} (${data.CountryRank.Country || ""})`);
  if (data?.Engagments) {
    const e = data.Engagments;
    lines.push(`**Visits:** ${e.Visits || "N/A"}`);
    lines.push(`**Pages/Visit:** ${e.PagePerVisit || "N/A"}`);
    lines.push(`**Avg Duration:** ${e.TimeOnSite || "N/A"}s`);
    lines.push(`**Bounce Rate:** ${e.BounceRate || "N/A"}`);
  }
  if (data?.TrafficSources) {
    lines.push("\n**Traffic Sources:**");
    const t = data.TrafficSources;
    if (t.Direct != null) lines.push(`- Direct: ${(t.Direct * 100).toFixed(1)}%`);
    if (t.Search != null) lines.push(`- Search: ${(t.Search * 100).toFixed(1)}%`);
    if (t.Social != null) lines.push(`- Social: ${(t.Social * 100).toFixed(1)}%`);
    if (t.Referrals != null) lines.push(`- Referrals: ${(t.Referrals * 100).toFixed(1)}%`);
  }

  return lines.length > 1 ? lines.join("\n") : JSON.stringify(data, null, 2).slice(0, 5000);
}

export const definition: ToolDefinition = {
  name: "similarweb_traffic",
  description: "Get website traffic analytics from SimilarWeb. Returns rank, visits, engagement, traffic sources.",
  params: {
    domain: z.string().describe("Domain to analyze (e.g. 'example.com')"),
  },
  envVars: ["SIMILAR_WEB_RAPIDAPI_KEY", "SIMILAR_WEB_URL", "SIMILAR_WEB_API_HOST"],
  execute,
};
