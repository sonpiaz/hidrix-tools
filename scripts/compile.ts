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
