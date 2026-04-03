/**
 * x_thread_reader — Read full X/Twitter threads and articles.
 *
 * Handles:
 *   - Tweet threads (chains of replies by same author)
 *   - Long-form X articles
 *   - Single tweet with full context + replies
 *
 * Provider: GetXAPI (tweet detail + replies endpoints)
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { getxApiGet } from "../../lib/getxapi.js";

function extractTweetId(input: string): string {
  // Accept: URL, tweet ID, or x.com/user/status/ID
  const match = input.match(/status\/(\d+)/);
  if (match) return match[1];
  if (/^\d+$/.test(input.trim())) return input.trim();
  throw new Error(`Cannot extract tweet ID from: ${input}. Use a tweet URL or numeric ID.`);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function execute(params: Record<string, any>): Promise<string> {
  const tweetId = extractTweetId(params.tweet as string);
  const maxReplies = (params.max_replies as number) || 20;

  // 1. Get the root tweet
  const tweetResult = await getxApiGet("/twitter/tweet/detail", { id: tweetId });
  if (tweetResult.error) return `Error fetching tweet: ${tweetResult.error}`;

  const tweet = tweetResult.data?.tweet || tweetResult.data;
  if (!tweet?.text && !tweet?.id) return `Tweet not found: ${tweetId}`;

  const author = tweet.author?.userName || "unknown";
  const authorName = tweet.author?.name || author;

  // 2. Try to get article content (X long-form)
  const articleResult = await getxApiGet("/twitter/tweet/article", { id: tweetId });
  const articleContent = articleResult.data?.content || articleResult.data?.article?.content;

  // 3. Get replies (for thread detection)
  const repliesResult = await getxApiGet("/twitter/tweet/replies", { id: tweetId });
  const replies = repliesResult.data?.replies || repliesResult.data?.tweets || [];

  // 4. Detect thread: replies by same author to own tweet
  const threadTweets = Array.isArray(replies)
    ? replies.filter((r: any) => {
        const replyAuthor = r.author?.userName || r.user?.screen_name || "";
        return replyAuthor.toLowerCase() === author.toLowerCase();
      })
    : [];

  // 5. Build output
  const sections: string[] = [];

  // Header
  const likes = tweet.likeCount || 0;
  const retweets = tweet.retweetCount || 0;
  const views = tweet.viewCount || 0;
  const engagement = `❤️${formatNumber(likes)} 🔄${formatNumber(retweets)} 👁️${formatNumber(views)}`;

  sections.push(`## Thread by ${authorName} (@${author})`);
  sections.push(`${engagement} | ${tweet.createdAt || ""}`);
  sections.push(`🔗 https://x.com/${author}/status/${tweetId}`);
  sections.push("");

  // Article content (if exists)
  if (articleContent) {
    sections.push("### Article Content\n");
    sections.push(articleContent);
    sections.push("");
  }

  // Thread tweets
  if (threadTweets.length > 0) {
    sections.push(`### Thread (${threadTweets.length + 1} tweets)\n`);
    sections.push(`**1/${threadTweets.length + 1}:** ${tweet.text || ""}`);
    threadTweets.forEach((t: any, i: number) => {
      sections.push(`\n**${i + 2}/${threadTweets.length + 1}:** ${t.text || ""}`);
    });
  } else {
    sections.push(`### Original Tweet\n`);
    sections.push(tweet.text || "");
  }

  // Top replies (non-author)
  const otherReplies = Array.isArray(replies)
    ? replies
        .filter((r: any) => {
          const replyAuthor = r.author?.userName || r.user?.screen_name || "";
          return replyAuthor.toLowerCase() !== author.toLowerCase();
        })
        .slice(0, maxReplies)
    : [];

  if (otherReplies.length > 0) {
    sections.push(`\n### Top Replies (${otherReplies.length})\n`);
    otherReplies.forEach((r: any, i: number) => {
      const rUser = r.author?.userName || r.user?.screen_name || "unknown";
      const rLikes = r.likeCount || r.favorite_count || 0;
      sections.push(`${i + 1}. **@${rUser}** (❤️${formatNumber(rLikes)}): ${(r.text || "").slice(0, 200)}`);
    });
  }

  return sections.join("\n");
}

export const definition: ToolDefinition = {
  name: "x_thread_reader",
  description: [
    "Read a full X/Twitter thread, article, or tweet with replies.",
    "Detects multi-tweet threads by same author and assembles them in order.",
    "Also reads X long-form articles. Input: tweet URL or ID.",
  ].join(" "),
  params: {
    tweet: z.string().describe("Tweet URL (https://x.com/user/status/ID) or numeric tweet ID"),
    max_replies: z.number().min(0).max(50).default(20).describe("Max replies to include (0-50)"),
  },
  envVars: ["GETXAPI_KEY"],
  execute,
};
