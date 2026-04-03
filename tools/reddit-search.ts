/**
 * Reddit search via RapidAPI.
 * Ported from Affitor RedditClient.
 */

import { rapidApiGet, requireEnv } from "../lib/rapidapi.js";

export async function redditSearch(
  query: string,
  sort: string = "RELEVANCE",
  time: string = "all",
): Promise<string> {
  const config = {
    baseUrl: requireEnv("REDDIT_SEARCH_URL"),
    host: requireEnv("REDDIT_API_HOST"),
    apiKey: requireEnv("RAPIDAPI_KEY"),
  };

  const result = await rapidApiGet(config, "search_posts_v3", {
    query,
    sort,
    time,
    nsfw: 0,
  });

  if (result.error) return result.error;

  const data = result.data as any;

  // Format results
  if (data?.data && Array.isArray(data.data)) {
    return data.data
      .slice(0, 10)
      .map((post: any, i: number) => {
        const sub = post.subreddit || post.subreddit_name || "";
        const title = post.title || "";
        const score = post.score ?? post.ups ?? 0;
        const comments = post.num_comments ?? 0;
        const url = post.url || post.permalink || "";
        const selftext = post.selftext ? `\n   ${post.selftext.slice(0, 200)}` : "";
        return `${i + 1}. r/${sub} | ${score} pts | ${comments} comments\n   **${title}**${selftext}\n   ${url}`;
      })
      .join("\n\n");
  }

  return JSON.stringify(data, null, 2).slice(0, 5000);
}
