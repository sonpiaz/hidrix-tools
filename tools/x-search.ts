/**
 * X/Twitter search via RapidAPI.
 * Ported from Affitor XClient.
 */

import { rapidApiGet, requireEnv } from "../lib/rapidapi.js";

export async function xSearch(query: string): Promise<string> {
  const config = {
    baseUrl: requireEnv("X_SEARCH_URL"),
    host: requireEnv("X_API_HOST"),
    apiKey: requireEnv("RAPIDAPI_KEY"),
  };

  const result = await rapidApiGet(config, "", {
    query,
    search_type: "Top",
  });

  if (result.error) return result.error;

  const data = result.data as any;

  // Format results based on common X API response shapes
  if (data?.results && Array.isArray(data.results)) {
    return data.results
      .slice(0, 10)
      .map((tweet: any, i: number) => {
        const user = tweet.user?.screen_name || tweet.user_screen_name || "unknown";
        const text = tweet.full_text || tweet.text || "";
        const created = tweet.created_at || "";
        return `${i + 1}. @${user} (${created})\n   ${text}`;
      })
      .join("\n\n");
  }

  // Return raw if structure is unexpected
  return JSON.stringify(data, null, 2).slice(0, 5000);
}
