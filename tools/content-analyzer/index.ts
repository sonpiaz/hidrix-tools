/**
 * content_analyzer — Analyze topics, patterns, and trends from posts.
 *
 * Pure logic — no LLM, no external API.
 * Extracts: topic clusters, content patterns, posting time heatmap, author leaderboard.
 *
 * Designed to work with output from facebook_scraper or content_scorer.
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";

// ── Topic keywords ─────────────────────────────────────────

const TOPIC_KEYWORDS: Record<string, string[]> = {
  ai_tools: ["chatgpt", "claude", "gemini", "cursor", "copilot", "openai", "anthropic", "ai", "llm", "gpt", "machine learning"],
  business: ["startup", "marketing", "sales", "funding", "revenue", "growth", "business", "entrepreneur", "investor", "pitch"],
  vietnam_tech: ["vietnam", "việt nam", "saigon", "hanoi", "hcmc", "vnese", "vn"],
  learning: ["tutorial", "guide", "how to", "learn", "course", "workshop", "training", "lesson"],
  community: ["meetup", "event", "collaboration", "networking", "conference", "hackathon"],
  tools: ["tool", "app", "software", "platform", "saas", "product", "extension", "plugin"],
  career: ["job", "hire", "hiring", "career", "resume", "interview", "salary", "remote", "freelance"],
  crypto_web3: ["crypto", "bitcoin", "blockchain", "web3", "nft", "defi", "token"],
  content: ["content", "video", "podcast", "blog", "youtube", "tiktok", "reels", "newsletter"],
  design: ["design", "figma", "ui", "ux", "branding", "logo", "creative"],
};

// ── Analysis functions ─────────────────────────────────────

function analyzeTopics(posts: any[]): Record<string, { count: number; avgEngagement: number; topPost: string }> {
  const topics: Record<string, { count: number; totalEngagement: number; topScore: number; topPost: string }> = {};

  for (const post of posts) {
    const text = ((post.text || "") + " " + (post.author || "")).toLowerCase();
    const engagement = (Number(post.reactions) || 0) + (Number(post.comments) || 0) * 3 + (Number(post.shares) || 0) * 5;

    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      const matched = keywords.some((kw) => text.includes(kw));
      if (matched) {
        if (!topics[topic]) topics[topic] = { count: 0, totalEngagement: 0, topScore: 0, topPost: "" };
        topics[topic].count++;
        topics[topic].totalEngagement += engagement;
        if (engagement > topics[topic].topScore) {
          topics[topic].topScore = engagement;
          topics[topic].topPost = (post.text || "").slice(0, 100);
        }
      }
    }
  }

  const result: Record<string, { count: number; avgEngagement: number; topPost: string }> = {};
  for (const [topic, data] of Object.entries(topics)) {
    result[topic] = {
      count: data.count,
      avgEngagement: Math.round(data.totalEngagement / data.count),
      topPost: data.topPost,
    };
  }
  return result;
}

function analyzePatterns(posts: any[]): {
  avgLength: number;
  withMedia: number;
  withLinks: number;
  questionPosts: number;
  listPosts: number;
} {
  let totalLength = 0;
  let withMedia = 0;
  let withLinks = 0;
  let questionPosts = 0;
  let listPosts = 0;

  for (const post of posts) {
    const text = post.text || "";
    totalLength += text.length;
    if (text.match(/https?:\/\//)) withLinks++;
    if (text.match(/\.(jpg|png|gif|mp4|video)/i) || post.image || post.video) withMedia++;
    if (text.includes("?")) questionPosts++;
    if (text.match(/^\d+[\.\)]/m) || text.match(/^[-•]/m)) listPosts++;
  }

  return {
    avgLength: Math.round(totalLength / Math.max(posts.length, 1)),
    withMedia: Math.round((withMedia / Math.max(posts.length, 1)) * 100),
    withLinks: Math.round((withLinks / Math.max(posts.length, 1)) * 100),
    questionPosts: Math.round((questionPosts / Math.max(posts.length, 1)) * 100),
    listPosts: Math.round((listPosts / Math.max(posts.length, 1)) * 100),
  };
}

function analyzeTimingHeatmap(posts: any[]): Record<string, number> {
  const hourCounts: Record<string, number> = {};
  const dayCounts: Record<string, number> = {};

  for (const post of posts) {
    if (!post.timestamp) continue;
    const date = new Date(post.timestamp);
    if (isNaN(date.getTime())) continue;

    const hour = date.getUTCHours();
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()];

    const hourKey = `${hour}:00 UTC`;
    hourCounts[hourKey] = (hourCounts[hourKey] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }

  return { ...dayCounts, ...hourCounts };
}

function analyzeAuthors(posts: any[]): Array<{ author: string; posts: number; totalEngagement: number; avgEngagement: number }> {
  const authors: Record<string, { posts: number; totalEngagement: number }> = {};

  for (const post of posts) {
    const author = post.author || "unknown";
    if (!authors[author]) authors[author] = { posts: 0, totalEngagement: 0 };
    authors[author].posts++;
    authors[author].totalEngagement +=
      (Number(post.reactions) || 0) + (Number(post.comments) || 0) * 3 + (Number(post.shares) || 0) * 5;
  }

  return Object.entries(authors)
    .map(([author, data]) => ({
      author,
      posts: data.posts,
      totalEngagement: data.totalEngagement,
      avgEngagement: Math.round(data.totalEngagement / data.posts),
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 20);
}

// ── Main execute ───────────────────────────────────────────

async function execute(params: Record<string, any>): Promise<string> {
  const postsJson = params.posts_json as string;
  const analysisType = params.analysis_type as string;

  let posts: any[];
  try {
    posts = JSON.parse(postsJson);
    if (!Array.isArray(posts)) throw new Error("not array");
  } catch {
    return "Error: posts_json must be a valid JSON array of post objects";
  }

  if (posts.length === 0) return "No posts to analyze.";

  const sections: string[] = [`## Content Analysis — ${posts.length} posts\n`];

  // Topics
  if (analysisType === "full" || analysisType === "topics") {
    const topics = analyzeTopics(posts);
    const sorted = Object.entries(topics).sort((a, b) => b[1].count - a[1].count);
    sections.push("### 📊 Topic Clusters\n");
    sections.push("| Topic | Posts | Avg Engagement | Top Post |");
    sections.push("|---|---|---|---|");
    for (const [topic, data] of sorted) {
      sections.push(`| ${topic} | ${data.count} | ${data.avgEngagement} | ${data.topPost}... |`);
    }
    sections.push("");
  }

  // Patterns
  if (analysisType === "full" || analysisType === "patterns") {
    const patterns = analyzePatterns(posts);
    sections.push("### 🎯 Content Patterns\n");
    sections.push(`- **Avg post length**: ${patterns.avgLength} chars`);
    sections.push(`- **Posts with media**: ${patterns.withMedia}%`);
    sections.push(`- **Posts with links**: ${patterns.withLinks}%`);
    sections.push(`- **Question posts**: ${patterns.questionPosts}%`);
    sections.push(`- **List-format posts**: ${patterns.listPosts}%`);
    sections.push("");
  }

  // Timing
  if (analysisType === "full" || analysisType === "trends") {
    const timing = analyzeTimingHeatmap(posts);
    sections.push("### ⏰ Posting Time Heatmap\n");
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (const day of days) {
      if (timing[day]) sections.push(`- **${day}**: ${timing[day]} posts`);
    }
    sections.push("");

    // Top hours
    const hours = Object.entries(timing)
      .filter(([k]) => k.includes("UTC"))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (hours.length > 0) {
      sections.push("**Peak hours (UTC):**");
      for (const [hour, count] of hours) {
        sections.push(`- ${hour}: ${count} posts`);
      }
      sections.push("");
    }
  }

  // Authors
  if (analysisType === "full" || analysisType === "trends") {
    const authors = analyzeAuthors(posts);
    sections.push("### 👥 Top Authors\n");
    sections.push("| Author | Posts | Total Engagement | Avg Engagement |");
    sections.push("|---|---|---|---|");
    for (const a of authors.slice(0, 10)) {
      sections.push(`| ${a.author} | ${a.posts} | ${a.totalEngagement} | ${a.avgEngagement} |`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

export const definition: ToolDefinition = {
  name: "content_analyzer",
  description:
    "Analyze posts for topic clusters, content patterns, posting time trends, and author leaderboard. Input: JSON array of posts. No external API needed.",
  params: {
    posts_json: z.string().describe("JSON array of post objects with fields: text, author, url, timestamp, reactions, comments, shares"),
    analysis_type: z
      .enum(["full", "topics", "patterns", "trends"])
      .default("full")
      .describe("Type of analysis: full (all), topics, patterns, or trends"),
  },
  execute,
};
