#!/usr/bin/env bun
/**
 * Knowledge Compiler — collect from follows → save to data_store → compile wiki in Obsidian.
 *
 * Usage:
 *   bun run scripts/compile.ts                     # Full: collect + compile
 *   bun run scripts/compile.ts --compile-only      # Only compile (skip collection)
 *   bun run scripts/compile.ts --collect-only      # Only collect (skip compile)
 *   bun run scripts/compile.ts --user @karpathy    # Collect + compile one user only
 *
 * Output: Obsidian vault → 07 - Knowledge Base 🧠/
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { loadFollows } from "../lib/follows.js";
import { savePosts, queryPosts, getPostCount, logRun, type StoredPost } from "../lib/storage.js";
import { createHash } from "node:crypto";

// ── Config ─────────────────────────────────────────────────

const VAULT_DIR = join(homedir(), "Documents", "Obsidian Vault");
const KB_DIR = join(VAULT_DIR, "07 - Knowledge Base 🧠");
const RAW_DIR = join(KB_DIR, "raw");
const PEOPLE_DIR = join(KB_DIR, "people");
const CONCEPTS_DIR = join(KB_DIR, "concepts");
const OUTPUT_DIR = join(KB_DIR, "output");
const SIGNALS_DIR = join(KB_DIR, "signals");
const COMPETITORS_DIR = join(KB_DIR, "competitors");
const MARKETS_DIR = join(KB_DIR, "markets");
const IDEAS_DIR = join(KB_DIR, "ideas");

const args = process.argv.slice(2);
const compileOnly = args.includes("--compile-only");
const collectOnly = args.includes("--collect-only");
const specificUser = args.find((a, i) => args[i - 1] === "--user")?.replace(/^@/, "");

function log(msg: string) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

function ensureDir(dir: string) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function generateId(text: string): string {
  return createHash("md5").update(text).digest("hex").slice(0, 16);
}

// ── Step 1: Collect ────────────────────────────────────────

async function collect(): Promise<{ platform: string; posts: any[] }[]> {
  const follows = loadFollows();
  const allResults: { platform: string; posts: any[] }[] = [];

  // Collect X users
  const xUsers = specificUser
    ? follows.x_users.filter((u) => u.username.toLowerCase() === specificUser.toLowerCase())
    : follows.x_users;

  for (const user of xUsers) {
    log(`📱 Collecting X: @${user.username}`);
    try {
      const mod = await import("../tools/x-search/index.ts");
      const result = await mod.definition.execute({ query: `from:${user.username}`, sort: "latest", count: 20 });

      // Parse markdown output back to structured data
      const posts = parseMarkdownPosts(result, "x", user.username);
      allResults.push({ platform: "x", posts });
      log(`   ✅ ${posts.length} posts`);
    } catch (e: any) {
      log(`   ❌ ${e.message}`);
    }
  }

  // Collect Reddit (keywords)
  if (!specificUser) {
    for (const kw of follows.keywords) {
      for (const platform of kw.platforms) {
        if (platform === "reddit") {
          log(`🔍 Collecting Reddit: "${kw.query}"`);
          try {
            const mod = await import("../tools/reddit-subreddit-top/index.ts");
            const result = await mod.definition.execute({ subreddit: "all", sort: "top", time: "week", count: 20 });
            const posts = parseMarkdownPosts(result, "reddit", kw.query);
            allResults.push({ platform: "reddit", posts });
            log(`   ✅ ${posts.length} posts`);
          } catch (e: any) {
            log(`   ❌ ${e.message}`);
          }
        }
        if (platform === "x") {
          log(`🔍 Collecting X: "${kw.query}"`);
          try {
            const mod = await import("../tools/x-search/index.ts");
            const result = await mod.definition.execute({ query: kw.query, sort: "top", count: 20 });
            const posts = parseMarkdownPosts(result, "x", kw.query);
            allResults.push({ platform: "x", posts });
            log(`   ✅ ${posts.length} posts`);
          } catch (e: any) {
            log(`   ❌ ${e.message}`);
          }
        }
      }
    }

    // Collect YouTube transcripts for channels
    for (const ch of follows.youtube_channels) {
      log(`🎬 Collecting YouTube: ${ch.channel}`);
      try {
        // Try to get latest videos
        const mod = await import("../tools/youtube-search/index.ts");
        const result = await mod.definition.execute({ query: `${ch.channel} ${ch.topics.join(" ")}`, maxResults: 5 });
        const posts = parseMarkdownPosts(result, "youtube", ch.channel);
        allResults.push({ platform: "youtube", posts });
        log(`   ✅ ${posts.length} videos found`);
      } catch (e: any) {
        log(`   ❌ ${e.message}`);
      }
    }
  }

  return allResults;
}

// ── Parse tool output back to structured posts ─────────────

function parseMarkdownPosts(markdown: string, platform: string, source: string): any[] {
  const posts: any[] = [];
  const blocks = markdown.split(/\n(?=\*\*\d+\.)/);

  for (const block of blocks) {
    if (!block.trim() || !block.includes("**")) continue;

    // Extract text from quote blocks
    const textMatch = block.match(/^>\s*(.+?)$/m);
    const text = textMatch ? textMatch[1].replace(/^>\s*/gm, "").trim() : "";

    // Extract author
    const authorMatch = block.match(/\*\*(?:\d+\.\s*)?(.+?)\*\*/);
    const author = authorMatch ? authorMatch[1].replace(/^@/, "").trim() : source;

    // Extract URL
    const urlMatch = block.match(/🔗\s*(https?:\/\/\S+)/);
    const url = urlMatch ? urlMatch[1] : "";

    // Extract engagement numbers
    const likesMatch = block.match(/[❤️👍⬆️](\d+(?:\.\d+)?[KMB]?)/);
    const commentsMatch = block.match(/💬(\d+(?:\.\d+)?[KMB]?)/);
    const sharesMatch = block.match(/[🔄🔁](\d+(?:\.\d+)?[KMB]?)/);

    if (text.length > 10 || url) {
      posts.push({
        id: generateId(url || text.slice(0, 100)),
        platform,
        source,
        author: author.slice(0, 100),
        text: text.slice(0, 2000),
        url,
        timestamp: new Date().toISOString(),
        reactions: parseEngagementNumber(likesMatch?.[1] || "0"),
        comments: parseEngagementNumber(commentsMatch?.[1] || "0"),
        shares: parseEngagementNumber(sharesMatch?.[1] || "0"),
      });
    }
  }

  return posts;
}

function parseEngagementNumber(s: string): number {
  if (!s) return 0;
  const num = parseFloat(s);
  if (s.endsWith("M")) return Math.round(num * 1_000_000);
  if (s.endsWith("K")) return Math.round(num * 1_000);
  if (s.endsWith("B")) return Math.round(num * 1_000_000_000);
  return Math.round(num) || 0;
}

// ── Step 2: Save to data_store ─────────────────────────────

function saveToStore(allResults: { platform: string; posts: any[] }[]): { total: number; new: number } {
  let totalCount = 0;
  let newCount = 0;

  for (const { posts } of allResults) {
    const stored: StoredPost[] = posts.map((p) => ({
      id: p.id,
      platform: p.platform,
      source: p.source,
      source_type: p.platform,
      author: p.author,
      text: p.text,
      url: p.url,
      timestamp: p.timestamp,
      reactions: p.reactions,
      comments: p.comments,
      shares: p.shares,
      score: p.reactions + p.comments * 3 + p.shares * 5,
    }));

    const result = savePosts(stored);
    totalCount += stored.length;
    newCount += result.saved;
  }

  return { total: totalCount, new: newCount };
}

// ── Step 3: Compile wiki ───────────────────────────────────

async function compile() {
  log("📝 Compiling wiki...");

  // Ensure directories
  ensureDir(KB_DIR);
  ensureDir(RAW_DIR);
  ensureDir(join(RAW_DIR, "x"));
  ensureDir(join(RAW_DIR, "reddit"));
  ensureDir(join(RAW_DIR, "youtube"));
  ensureDir(PEOPLE_DIR);
  ensureDir(CONCEPTS_DIR);
  ensureDir(OUTPUT_DIR);

  const follows = loadFollows();
  const today = new Date().toISOString().split("T")[0];
  const dailyEntries: string[] = [];

  // ── Compile people articles ────────────────────────────

  for (const user of follows.x_users) {
    const posts = queryPosts({ source: user.username, limit: 50, orderBy: "score" });
    if (posts.length === 0) continue;

    const filename = `${sanitizeFilename(user.username)}.md`;
    const filepath = join(PEOPLE_DIR, filename);

    const topPosts = posts.slice(0, 10);
    const totalEngagement = posts.reduce((sum, p) => sum + p.score, 0);
    const topics = user.topics.length > 0 ? user.topics : extractTopics(posts);

    const content = [
      `# ${user.username}`,
      "",
      `> Tracked from X/Twitter | ${posts.length} posts collected | Total engagement: ${totalEngagement}`,
      "",
      `## Topics`,
      topics.map((t) => `- ${t}`).join("\n"),
      "",
      `## Top Posts`,
      "",
      ...topPosts.map((p, i) => [
        `### ${i + 1}. (score: ${Math.round(p.score)})`,
        p.text ? `> ${p.text.slice(0, 500).replace(/\n/g, "\n> ")}` : "",
        p.url ? `🔗 ${p.url}` : "",
        "",
      ].filter(Boolean).join("\n")),
      "",
      `## Key Insights`,
      "",
      `_Agent will fill this section after analyzing posts._`,
      "",
      `---`,
      `Last updated: ${today}`,
      `Source: [[_index]]`,
    ].join("\n");

    writeFileSync(filepath, content);
    dailyEntries.push(`- Updated [[${user.username}]] — ${posts.length} posts, top score: ${Math.round(topPosts[0]?.score || 0)}`);
    log(`   📄 ${filename} (${posts.length} posts)`);
  }

  // ── Compile raw data files ─────────────────────────────

  const platforms = ["x", "reddit", "youtube"];
  for (const platform of platforms) {
    const posts = queryPosts({ platform, limit: 100, orderBy: "scraped_at" });
    if (posts.length === 0) continue;

    const filename = `${platform}-${today}.md`;
    const filepath = join(RAW_DIR, platform, filename);

    const content = [
      `# ${platform.toUpperCase()} — ${today}`,
      "",
      `> ${posts.length} posts collected`,
      "",
      ...posts.map((p, i) => [
        `## ${i + 1}. ${p.author || "unknown"} (score: ${Math.round(p.score)})`,
        p.text ? `> ${p.text.slice(0, 500).replace(/\n/g, "\n> ")}` : "",
        p.url ? `🔗 ${p.url}` : "",
        "",
      ].join("\n")),
    ].join("\n");

    writeFileSync(filepath, content);
    log(`   📄 raw/${platform}/${filename} (${posts.length} posts)`);
  }

  // ── Compile concept stubs ──────────────────────────────

  const allPosts = queryPosts({ limit: 200, orderBy: "score" });
  const conceptCounts = extractConceptCounts(allPosts);
  const topConcepts = Object.entries(conceptCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);

  for (const [concept, count] of topConcepts) {
    const filename = `${sanitizeFilename(concept)}.md`;
    const filepath = join(CONCEPTS_DIR, filename);

    // Only create if not exists (don't overwrite manually edited articles)
    if (!existsSync(filepath)) {
      const relatedPosts = allPosts.filter((p) => (p.text || "").toLowerCase().includes(concept.toLowerCase())).slice(0, 5);

      const content = [
        `# ${concept}`,
        "",
        `> Mentioned in ${count} posts across collected data`,
        "",
        `## Summary`,
        "",
        `_Agent will fill this section._`,
        "",
        `## Related Posts`,
        "",
        ...relatedPosts.map((p, i) =>
          `${i + 1}. ${p.author || "unknown"}: "${(p.text || "").slice(0, 100)}..." — [[${sanitizeFilename(p.source || "")}]]`
        ),
        "",
        `## Related Concepts`,
        "",
        topConcepts.filter(([c]) => c !== concept).slice(0, 5).map(([c]) => `- [[${sanitizeFilename(c)}]]`).join("\n"),
        "",
        `---`,
        `Last updated: ${today}`,
      ].join("\n");

      writeFileSync(filepath, content);
      dailyEntries.push(`- New concept: [[${concept}]] (${count} mentions)`);
      log(`   📄 concepts/${filename}`);
    }
  }

  // ── B2+B3+B5: Signals, Competitors, Ideas ───────

  const signals = extractSignals(allPosts);
  if (signals.length > 0) {
    compileSignals(signals, today, dailyEntries);
    compileCompetitors(allPosts, signals, today, dailyEntries);
    generateIdeas(signals, today, dailyEntries);
  }

  // ── Write master index ─────────────────────────────────

  const indexContent = [
    `# 🧠 Knowledge Base Index`,
    "",
    `Last compiled: ${new Date().toISOString()}`,
    `Total posts: ${getPostCount()}`,
    "",
    `## People`,
    "",
    ...follows.x_users.map((u) => {
      const count = queryPosts({ source: u.username, limit: 1 }).length > 0 ? "✅" : "⏳";
      return `- ${count} [[${sanitizeFilename(u.username)}|@${u.username}]] — ${u.topics.join(", ")}`;
    }),
    "",
    `## Top Concepts`,
    "",
    ...topConcepts.slice(0, 15).map(([c, n]) => `- [[${sanitizeFilename(c)}|${c}]] (${n} mentions)`),
    "",
    `## 📡 Signals`,
    "",
    `- [[signals/pain-point|Pain Points]]`,
    `- [[signals/alternative-seeking|Alternative Seeking]]`,
    `- [[signals/feature-request|Feature Requests]]`,
    `- [[signals/pricing-signal|Pricing Signals]]`,
    `- [[signals/positive-signal|Positive Signals]]`,
    `- [[signals/trend-signal|Trend Signals]]`,
    "",
    `## 🏭 Markets`,
    "",
    ...Object.values(COMPETITOR_MARKETS).map(({ label }) => `- [[${sanitizeFilename(label)}|${label}]]`),
    "",
    `## 💡 Ideas`,
    "",
    `- [[ideas/auto-generated|Auto-generated Business Ideas]]`,
    "",
    `## Raw Data`,
    "",
    ...platforms.map((p) => `- [[raw/${p}]] — ${getPostCount(p)} posts`),
    "",
    `## Follow List`,
    "",
    `- X: ${follows.x_users.map((u) => `@${u.username}`).join(", ") || "none"}`,
    `- YouTube: ${follows.youtube_channels.map((c) => c.channel).join(", ") || "none"}`,
    `- Keywords: ${follows.keywords.map((k) => `"${k.query}"`).join(", ") || "none"}`,
    "",
    `---`,
    `_Compiled by hidrix-tools. Edit people/ and concepts/ articles freely — they won't be overwritten._`,
  ].join("\n");

  writeFileSync(join(KB_DIR, "_index.md"), indexContent);
  log(`   📄 _index.md`);

  // ── Write daily log ────────────────────────────────────

  const dailyLogPath = join(KB_DIR, "_daily-log.md");
  const existingLog = existsSync(dailyLogPath) ? readFileSync(dailyLogPath, "utf8") : "# Daily Log\n";

  const newEntry = [
    "",
    `## ${today}`,
    "",
    ...dailyEntries,
    dailyEntries.length === 0 ? "- No new updates" : "",
  ].join("\n");

  // Prepend new entry after title
  const titleEnd = existingLog.indexOf("\n") + 1;
  const updatedLog = existingLog.slice(0, titleEnd) + newEntry + "\n" + existingLog.slice(titleEnd);
  writeFileSync(dailyLogPath, updatedLog);
  log(`   📄 _daily-log.md`);
}

// ── B2: Signal extraction ─────────────────────────────────

const SIGNAL_PATTERNS: Record<string, { keywords: string[]; label: string }> = {
  pain_point: {
    keywords: ["expensive", "too costly", "overpriced", "costs too much", "waste of money", "not worth", "terrible", "awful", "frustrating", "broken", "unreliable", "slow", "laggy", "latency"],
    label: "🔴 Pain Point",
  },
  alternative_seeking: {
    keywords: ["alternative to", "replacement for", "switching from", "moved away from", "instead of", "better than", "looking for", "anyone know"],
    label: "🔍 Alternative Seeking",
  },
  feature_request: {
    keywords: ["wish it had", "would be great if", "missing feature", "need a way to", "please add", "feature request", "should support", "doesn't support", "can't do"],
    label: "✨ Feature Request",
  },
  pricing_signal: {
    keywords: ["pricing", "free tier", "rate limit", "too limited", "pay per", "subscription", "credits", "tokens per", "cost per", "$/", "per month", "per minute"],
    label: "💰 Pricing Signal",
  },
  positive_signal: {
    keywords: ["love", "amazing", "switched to", "game changer", "best tool", "incredible", "impressed", "10x", "blazing fast", "highly recommend"],
    label: "💚 Positive Signal",
  },
  trend_signal: {
    keywords: ["just launched", "new api", "now supports", "announcing", "just released", "open sourced", "breaking", "first to", "just shipped"],
    label: "🚀 Trend Signal",
  },
};

// B3: Competitor definitions
const COMPETITOR_MARKETS: Record<string, { competitors: string[]; label: string }> = {
  "llm-api-gateway": {
    competitors: ["openrouter", "portkey", "litellm", "helicone", "requesty", "kong ai", "vercel ai gateway", "llm gateway"],
    label: "LLM API Gateway",
  },
  "llm-inference": {
    competitors: ["together ai", "togetherai", "fireworks ai", "fireworksai", "groq", "anyscale", "modal", "replicate", "deepinfra", "novita"],
    label: "LLM Inference Provider",
  },
  "speech-to-text": {
    competitors: ["deepgram", "assembly ai", "assemblyai", "whisper", "rev ai", "speechmatics", "google stt"],
    label: "Speech-to-Text",
  },
  "voice-ai": {
    competitors: ["eleven labs", "elevenlabs", "play.ht", "murf ai", "resemble ai", "cartesia"],
    label: "Voice AI / TTS",
  },
  "ugc-ai": {
    competitors: ["heygen", "synthesia", "d-id", "colossyan", "elai"],
    label: "UGC AI / Avatar",
  },
  "llm-provider": {
    competitors: ["openai", "anthropic", "google gemini", "mistral", "cohere", "ai21"],
    label: "LLM Model Provider",
  },
};

interface Signal {
  type: string;
  label: string;
  text: string;
  author: string;
  url: string;
  score: number;
  platform: string;
  competitor?: string;
  market?: string;
}

function extractSignals(posts: StoredPost[]): Signal[] {
  const signals: Signal[] = [];

  for (const post of posts) {
    const text = (post.text || "").toLowerCase();
    if (text.length < 20) continue;

    // Detect which competitor is mentioned
    let mentionedCompetitor: string | undefined;
    let mentionedMarket: string | undefined;
    for (const [market, { competitors }] of Object.entries(COMPETITOR_MARKETS)) {
      for (const comp of competitors) {
        if (text.includes(comp)) {
          mentionedCompetitor = comp;
          mentionedMarket = market;
          break;
        }
      }
      if (mentionedCompetitor) break;
    }

    // Detect signal types
    for (const [type, { keywords, label }] of Object.entries(SIGNAL_PATTERNS)) {
      const matched = keywords.some((kw) => text.includes(kw));
      if (matched) {
        signals.push({
          type,
          label,
          text: (post.text || "").slice(0, 300),
          author: post.author || "unknown",
          url: post.url || "",
          score: post.score || 0,
          platform: post.platform || "",
          competitor: mentionedCompetitor,
          market: mentionedMarket,
        });
      }
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

function compileSignals(signals: Signal[], today: string, dailyEntries: string[]) {
  ensureDir(SIGNALS_DIR);

  const byType: Record<string, Signal[]> = {};
  for (const s of signals) {
    if (!byType[s.type]) byType[s.type] = [];
    byType[s.type].push(s);
  }

  for (const [type, items] of Object.entries(byType)) {
    const pattern = SIGNAL_PATTERNS[type];
    if (!pattern) continue;

    const filename = `${type.replace(/_/g, "-")}.md`;
    const filepath = join(SIGNALS_DIR, filename);

    const content = [
      `# ${pattern.label}`,
      "",
      `> ${items.length} signals detected. Last updated: ${today}`,
      "",
      ...items.slice(0, 30).map((s, i) => {
        const comp = s.competitor ? ` | Competitor: [[${sanitizeFilename(s.competitor)}]]` : "";
        return [
          `### ${i + 1}. (score: ${Math.round(s.score)})${comp}`,
          `> ${s.text.replace(/\n/g, "\n> ")}`,
          `— ${s.author}, ${s.platform} | ${s.url}`,
          "",
        ].join("\n");
      }),
      "---",
      `Last updated: ${today}`,
    ].join("\n");

    writeFileSync(filepath, content);
    log(`   📡 signals/${filename} (${items.length} signals)`);
  }

  dailyEntries.push(`- 📡 ${signals.length} signals detected: ${Object.entries(byType).map(([t, s]) => `${t}(${s.length})`).join(", ")}`);
}

// B3: Compile competitor profiles
function compileCompetitors(posts: StoredPost[], signals: Signal[], today: string, dailyEntries: string[]) {
  ensureDir(COMPETITORS_DIR);

  // Count mentions per competitor
  const competitorData: Record<string, {
    market: string;
    marketLabel: string;
    mentions: StoredPost[];
    signals: Signal[];
  }> = {};

  for (const [market, { competitors, label }] of Object.entries(COMPETITOR_MARKETS)) {
    for (const comp of competitors) {
      const mentions = posts.filter((p) => (p.text || "").toLowerCase().includes(comp));
      const compSignals = signals.filter((s) => s.competitor === comp);

      if (mentions.length > 0 || compSignals.length > 0) {
        competitorData[comp] = {
          market,
          marketLabel: label,
          mentions,
          signals: compSignals,
        };
      }
    }
  }

  for (const [comp, data] of Object.entries(competitorData)) {
    const filename = `${sanitizeFilename(comp)}.md`;
    const filepath = join(COMPETITORS_DIR, filename);

    // Simple sentiment
    const positive = data.signals.filter((s) => s.type === "positive_signal").length;
    const negative = data.signals.filter((s) => s.type === "pain_point").length;
    const neutral = data.mentions.length - positive - negative;

    // Pricing signals
    const pricingSignals = data.signals.filter((s) => s.type === "pricing_signal");
    const painPoints = data.signals.filter((s) => s.type === "pain_point");
    const positives = data.signals.filter((s) => s.type === "positive_signal");
    const featureReqs = data.signals.filter((s) => s.type === "feature_request");

    const content = [
      `# ${comp.charAt(0).toUpperCase() + comp.slice(1)}`,
      "",
      `> ${data.marketLabel} | Market: [[${sanitizeFilename(data.marketLabel)}]]`,
      "",
      `## Mentions`,
      `- ${data.mentions.length} mentions across collected data`,
      `- Sentiment: ${positive} positive, ${neutral} neutral, ${negative} negative`,
      "",
      ...(pricingSignals.length > 0 ? [
        `## Pricing Signals`,
        ...pricingSignals.slice(0, 5).map((s) => `- "${s.text.slice(0, 150)}" — ${s.author}`),
        "",
      ] : []),
      ...(painPoints.length > 0 ? [
        `## Pain Points`,
        ...painPoints.slice(0, 5).map((s) => `- "${s.text.slice(0, 150)}" — ${s.author}`),
        "",
      ] : []),
      ...(positives.length > 0 ? [
        `## Positive Signals`,
        ...positives.slice(0, 5).map((s) => `- "${s.text.slice(0, 150)}" — ${s.author}`),
        "",
      ] : []),
      ...(featureReqs.length > 0 ? [
        `## Feature Requests`,
        ...featureReqs.slice(0, 5).map((s) => `- "${s.text.slice(0, 150)}" — ${s.author}`),
        "",
      ] : []),
      `## Top Posts`,
      "",
      ...data.mentions.slice(0, 5).map((p, i) => [
        `${i + 1}. (score: ${Math.round(p.score)}) ${p.author || "unknown"}`,
        `   > ${(p.text || "").slice(0, 200)}`,
        `   ${p.url || ""}`,
      ].join("\n")),
      "",
      `## Related`,
      `- Market: [[${sanitizeFilename(data.marketLabel)}]]`,
      `- Signals: [[pain-point]] | [[pricing-signal]] | [[positive-signal]]`,
      "",
      "---",
      `Last updated: ${today} | Sources: ${data.mentions.length} posts`,
    ].join("\n");

    writeFileSync(filepath, content);
    log(`   🏢 competitors/${filename} (${data.mentions.length} mentions, ${data.signals.length} signals)`);
  }

  // Compile market overview pages
  ensureDir(MARKETS_DIR);
  for (const [market, { competitors, label }] of Object.entries(COMPETITOR_MARKETS)) {
    const marketComps = competitors.filter((c) => competitorData[c]);
    if (marketComps.length === 0) continue;

    const filename = `${sanitizeFilename(label)}.md`;
    const filepath = join(MARKETS_DIR, filename);

    const allMarketSignals = signals.filter((s) => s.market === market);
    const painCount = allMarketSignals.filter((s) => s.type === "pain_point").length;
    const altCount = allMarketSignals.filter((s) => s.type === "alternative_seeking").length;
    const trendCount = allMarketSignals.filter((s) => s.type === "trend_signal").length;

    const content = [
      `# ${label} Market`,
      "",
      `> ${marketComps.length} competitors tracked | ${allMarketSignals.length} signals this period`,
      "",
      `## Players`,
      "",
      `| Company | Mentions | Pain Points | Positive | Score |`,
      `|---|---|---|---|---|`,
      ...marketComps.map((c) => {
        const d = competitorData[c];
        const pos = d.signals.filter((s) => s.type === "positive_signal").length;
        const neg = d.signals.filter((s) => s.type === "pain_point").length;
        const totalScore = d.mentions.reduce((sum, p) => sum + p.score, 0);
        return `| [[${sanitizeFilename(c)}|${c}]] | ${d.mentions.length} | ${neg} | ${pos} | ${Math.round(totalScore)} |`;
      }),
      "",
      `## Market Signals`,
      `- 🔴 Pain points: ${painCount}`,
      `- 🔍 Alternative seeking: ${altCount}`,
      `- 🚀 Trends: ${trendCount}`,
      "",
      ...(altCount > 0 ? [
        `## Opportunity Indicators`,
        `- ${altCount} people looking for alternatives`,
        `- Top pain: ${allMarketSignals.filter((s) => s.type === "pain_point").slice(0, 3).map((s) => `"${s.text.slice(0, 80)}"`).join(", ") || "none detected"}`,
        "",
      ] : []),
      "---",
      `Last updated: ${today}`,
    ].join("\n");

    writeFileSync(filepath, content);
    dailyEntries.push(`- 🏭 Market: [[${sanitizeFilename(label)}|${label}]] — ${marketComps.length} competitors, ${allMarketSignals.length} signals`);
    log(`   🏭 markets/${filename} (${marketComps.length} competitors)`);
  }
}

// B5: Generate ideas from signals
function generateIdeas(signals: Signal[], today: string, dailyEntries: string[]) {
  ensureDir(IDEAS_DIR);

  const ideas: { title: string; confidence: string; signals: string[]; related: string[] }[] = [];

  // Pattern 1: Many pain points + alternative seeking for same competitor
  const painByComp: Record<string, number> = {};
  const altByComp: Record<string, number> = {};
  for (const s of signals) {
    if (!s.competitor) continue;
    if (s.type === "pain_point") painByComp[s.competitor] = (painByComp[s.competitor] || 0) + 1;
    if (s.type === "alternative_seeking") altByComp[s.competitor] = (altByComp[s.competitor] || 0) + 1;
  }

  for (const [comp, painCount] of Object.entries(painByComp)) {
    const altCount = altByComp[comp] || 0;
    if (painCount >= 2 || altCount >= 1) {
      const topPain = signals.filter((s) => s.competitor === comp && s.type === "pain_point").slice(0, 3);
      ideas.push({
        title: `Better alternative to ${comp}`,
        confidence: painCount >= 3 && altCount >= 2 ? "🟢 High" : "🟡 Medium",
        signals: [
          `${painCount} pain points detected`,
          `${altCount} people seeking alternatives`,
          ...topPain.map((s) => `"${s.text.slice(0, 100)}"`),
        ],
        related: [`[[${sanitizeFilename(comp)}]]`, `[[pain-point]]`, `[[alternative-seeking]]`],
      });
    }
  }

  // Pattern 2: Feature requests nobody addresses
  const featureReqs = signals.filter((s) => s.type === "feature_request");
  if (featureReqs.length >= 2) {
    ideas.push({
      title: "Feature gap: " + featureReqs[0].text.slice(0, 80),
      confidence: featureReqs.length >= 5 ? "🟢 High" : "🟡 Medium",
      signals: featureReqs.slice(0, 5).map((s) => `"${s.text.slice(0, 100)}" (${s.author})`),
      related: [`[[feature-request]]`],
    });
  }

  // Pattern 3: Trend signals (new API/launch = opportunity to build on top)
  const trends = signals.filter((s) => s.type === "trend_signal");
  for (const t of trends.slice(0, 3)) {
    ideas.push({
      title: `Build on: ${t.text.slice(0, 80)}`,
      confidence: "🟡 Exploratory",
      signals: [`"${t.text.slice(0, 150)}" — ${t.author}`],
      related: [`[[trend-signal]]`],
    });
  }

  if (ideas.length === 0) return;

  const content = [
    `# 💡 Business Ideas`,
    "",
    `> Auto-generated from ${signals.length} market signals. Last updated: ${today}`,
    `> Review and validate before acting.`,
    "",
    ...ideas.map((idea, i) => [
      `## ${i + 1}. ${idea.title}`,
      `**Confidence:** ${idea.confidence}`,
      "",
      `**Signals:**`,
      ...idea.signals.map((s) => `- ${s}`),
      "",
      `**Related:** ${idea.related.join(" | ")}`,
      "",
    ].join("\n")),
    "---",
    `Generated: ${today} | Based on ${signals.length} signals`,
  ].join("\n");

  writeFileSync(join(IDEAS_DIR, "auto-generated.md"), content);
  dailyEntries.push(`- 💡 ${ideas.length} business ideas generated`);
  log(`   💡 ideas/auto-generated.md (${ideas.length} ideas)`);
}

// ── Topic extraction ───────────────────────────────────────

function extractTopics(posts: StoredPost[]): string[] {
  const KEYWORDS: Record<string, string[]> = {
    "AI": ["ai", "artificial intelligence", "machine learning", "ml", "deep learning"],
    "LLM": ["llm", "language model", "gpt", "claude", "gemini", "chatgpt"],
    "Agents": ["agent", "autonomous", "tool use", "mcp"],
    "Startup": ["startup", "founder", "fundraise", "vc", "investor"],
    "Coding": ["code", "programming", "developer", "engineer", "vibe coding"],
    "Product": ["product", "saas", "launch", "ship", "build"],
    "Content": ["content", "newsletter", "youtube", "podcast", "creator"],
    "Open Source": ["open source", "github", "oss", "repo"],
  };

  const allText = posts.map((p) => (p.text || "").toLowerCase()).join(" ");
  return Object.entries(KEYWORDS)
    .filter(([_, kws]) => kws.some((kw) => allText.includes(kw)))
    .map(([topic]) => topic);
}

function extractConceptCounts(posts: StoredPost[]): Record<string, number> {
  const CONCEPTS: Record<string, string[]> = {
    "LLM Knowledge Base": ["knowledge base", "wiki", "obsidian", "second brain"],
    "MCP Protocol": ["mcp", "model context protocol"],
    "AI Agents": ["ai agent", "autonomous agent", "tool use"],
    "Vibe Coding": ["vibe coding", "vibe code"],
    "RAG": ["rag", "retrieval augmented"],
    "Fine-tuning": ["finetune", "fine-tune", "fine tuning"],
    "Prompt Engineering": ["prompt engineer", "prompting", "system prompt"],
    "Open Source AI": ["open source", "llama", "mistral", "deepseek"],
    "AI Startup": ["ai startup", "ai company", "ai product"],
    "Content Creation": ["content creat", "newsletter", "youtube", "podcast"],
    "Indie Hacking": ["indie hacker", "solo founder", "bootstrapp"],
    "Scaling": ["scaling", "scale up", "growth"],
    "Developer Tools": ["dev tool", "developer tool", "cli tool", "ide"],
    "Embeddings": ["embedding", "vector", "semantic search"],
    "Transformer": ["transformer", "attention mechanism", "self-attention"],
  };

  const counts: Record<string, number> = {};
  for (const post of posts) {
    const text = (post.text || "").toLowerCase();
    for (const [concept, keywords] of Object.entries(CONCEPTS)) {
      if (keywords.some((kw) => text.includes(kw))) {
        counts[concept] = (counts[concept] || 0) + 1;
      }
    }
  }
  return counts;
}

// ── Main ───────────────────────────────────────────────────

log("🚀 Knowledge Compiler starting");

if (!compileOnly) {
  log("📡 Step 1: Collecting from follows...");
  const results = await collect();

  log("💾 Step 2: Saving to data_store...");
  const saved = saveToStore(results);
  log(`   Saved: ${saved.new} new / ${saved.total} total`);

  logRun({
    id: generateId(`compile-${Date.now()}`),
    tool: "compile",
    status: "ok",
    items_count: saved.total,
    new_items: saved.new,
    duration_ms: 0,
  });
}

if (!collectOnly) {
  log("📝 Step 3: Compiling wiki...");
  await compile();
}

log("✅ Done! Open Obsidian → 07 - Knowledge Base 🧠");
