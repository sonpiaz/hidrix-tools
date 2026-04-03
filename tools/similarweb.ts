/**
 * SimilarWeb traffic analytics via RapidAPI.
 * Ported from Affitor SimilarWebClient.
 * Note: Uses a SEPARATE RapidAPI key (SIMILAR_WEB_RAPIDAPI_KEY).
 */

import { rapidApiGet, requireEnv } from "../lib/rapidapi.js";

export async function similarwebTraffic(domain: string): Promise<string> {
  const config = {
    baseUrl: requireEnv("SIMILAR_WEB_URL"),
    host: requireEnv("SIMILAR_WEB_API_HOST"),
    apiKey: requireEnv("SIMILAR_WEB_RAPIDAPI_KEY"),
  };

  const result = await rapidApiGet(config, "traffic", { domain });

  if (result.error) return result.error;

  const data = result.data as any;

  // Format traffic data
  if (data) {
    const lines: string[] = [`# Traffic Report: ${domain}`];

    if (data.GlobalRank?.Rank) lines.push(`Global Rank: #${data.GlobalRank.Rank}`);
    if (data.CountryRank?.Rank) lines.push(`Country Rank: #${data.CountryRank.Rank} (${data.CountryRank.Country || ""})`);
    if (data.CategoryRank?.Rank) lines.push(`Category Rank: #${data.CategoryRank.Rank} (${data.CategoryRank.Category || ""})`);
    if (data.Engagments?.Visits) lines.push(`Monthly Visits: ${data.Engagments.Visits}`);
    if (data.Engagments?.TimeOnSite) lines.push(`Avg Time on Site: ${data.Engagments.TimeOnSite}s`);
    if (data.Engagments?.PagePerVisit) lines.push(`Pages per Visit: ${data.Engagments.PagePerVisit}`);
    if (data.Engagments?.BounceRate) lines.push(`Bounce Rate: ${(data.Engagments.BounceRate * 100).toFixed(1)}%`);

    if (data.TopCountryShares && Array.isArray(data.TopCountryShares)) {
      lines.push("\n## Top Countries");
      data.TopCountryShares.slice(0, 5).forEach((c: any) => {
        lines.push(`- ${c.Country}: ${(c.Value * 100).toFixed(1)}%`);
      });
    }

    if (data.TrafficSources) {
      lines.push("\n## Traffic Sources");
      const src = data.TrafficSources;
      if (src.Search != null) lines.push(`- Search: ${(src.Search * 100).toFixed(1)}%`);
      if (src.Social != null) lines.push(`- Social: ${(src.Social * 100).toFixed(1)}%`);
      if (src.Direct != null) lines.push(`- Direct: ${(src.Direct * 100).toFixed(1)}%`);
      if (src.Referrals != null) lines.push(`- Referrals: ${(src.Referrals * 100).toFixed(1)}%`);
      if (src.Mail != null) lines.push(`- Email: ${(src.Mail * 100).toFixed(1)}%`);
    }

    return lines.join("\n");
  }

  return JSON.stringify(data, null, 2).slice(0, 5000);
}
