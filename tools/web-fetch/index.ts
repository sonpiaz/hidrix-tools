/**
 * web_fetch — Fetch a URL and extract readable content as markdown.
 *
 * Upgraded:
 *   - Extract metadata (author, date, tags, reading time)
 *   - Handle X/Twitter URLs specially (extract tweet text)
 *   - JS-rendered page fallback via Apify web scraper (optional)
 *   - Better error messages
 *
 * Provider: Mozilla Readability (built-in), Tavily Extract (optional), Apify (optional fallback)
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { extractContent, truncateText } from "../../lib/readability.js";

type FetchProvider = "readability" | "tavily" | "apify";

const MAX_RESPONSE_BYTES = 2_000_000;

// ── Metadata extraction ────────────────────────────────────

interface PageMetadata {
  author?: string;
  date?: string;
  tags?: string[];
  readingTime?: string;
  description?: string;
  siteName?: string;
}

function extractMetadata(html: string): PageMetadata {
  const meta: PageMetadata = {};

  // Author
  const authorMatch =
    html.match(/name=["'](?:author|article:author)["']\s+content=["']([^"']+)["']/i) ||
    html.match(/property=["'](?:article:author|og:author)["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+name=["']author["']/i);
  if (authorMatch) meta.author = authorMatch[1].trim();

  // Date
  const dateMatch =
    html.match(/name=["'](?:article:published_time|date|pubdate|publish_date)["']\s+content=["']([^"']+)["']/i) ||
    html.match(/property=["'](?:article:published_time|og:published_time)["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+property=["']article:published_time["']/i) ||
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (dateMatch) {
    const d = new Date(dateMatch[1]);
    meta.date = isNaN(d.getTime()) ? dateMatch[1] : d.toISOString().split("T")[0];
  }

  // Description
  const descMatch =
    html.match(/name=["']description["']\s+content=["']([^"']+)["']/i) ||
    html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+name=["']description["']/i);
  if (descMatch) meta.description = descMatch[1].trim().slice(0, 300);

  // Site name
  const siteMatch =
    html.match(/property=["']og:site_name["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+property=["']og:site_name["']/i);
  if (siteMatch) meta.siteName = siteMatch[1].trim();

  // Tags/keywords
  const tagsMatch =
    html.match(/name=["']keywords["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+name=["']keywords["']/i);
  if (tagsMatch) {
    meta.tags = tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
  }

  return meta;
}

function estimateReadingTime(text: string): string {
  const words = text.split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 250));
  return `${minutes} min read`;
}

// ── X/Twitter special handling ─────────────────────────────

function isXUrl(url: string): boolean {
  return /^https?:\/\/(x\.com|twitter\.com)\//i.test(url);
}

async function fetchXTweet(url: string): Promise<string | null> {
  // Try GetXAPI if available
  if (process.env.GETXAPI_KEY) {
    try {
      const { getxApiGet } = await import("../../lib/getxapi.js");
      const match = url.match(/status\/(\d+)/);
      if (!match) return null;

      const result = await getxApiGet("/twitter/tweet/detail", { id: match[1] });
      if (result.error || !result.data) return null;

      const tweet = result.data.tweet || result.data;
      const author = tweet.author?.userName || "unknown";
      const name = tweet.author?.name || author;
      const text = tweet.text || "";
      const likes = tweet.likeCount || 0;
      const retweets = tweet.retweetCount || 0;
      const date = tweet.createdAt || "";

      return [
        `# Tweet by ${name} (@${author})`,
        `❤️ ${likes} | 🔄 ${retweets} | 📅 ${date}`,
        `Source: ${url}`,
        "",
        text,
      ].join("\n");
    } catch {
      return null;
    }
  }
  return null;
}

// ── JS-rendered fallback ───────────────────────────────────

async function fetchViaApify(url: string, maxChars: number): Promise<string | null> {
  if (!process.env.APIFY_API_TOKEN) return null;

  try {
    const { runActor } = await import("../../lib/apify.js");
    const result = await runActor("apify/web-scraper", {
      startUrls: [{ url }],
      pageFunction: `async function pageFunction(context) {
        const { page } = context;
        await page.waitForTimeout(3000);
        const text = await page.evaluate(() => document.body.innerText);
        const title = await page.evaluate(() => document.title);
        return { title, text: text.slice(0, ${maxChars}) };
      }`,
      maxPagesPerCrawl: 1,
    });

    if (result.error || result.items.length === 0) return null;

    const item = result.items[0];
    const header = item.title ? `# ${item.title}\nSource: ${url}\n\n` : `Source: ${url}\n\n`;
    return header + (item.text || "");
  } catch {
    return null;
  }
}

// ── Tavily Extract ──────────────────────────────────────────

async function fetchViaTavily(url: string, maxChars: number): Promise<string | null> {
  if (!process.env.TAVILY_API_KEY) return null;

  try {
    const { tavily } = await import("@tavily/core");
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

    const response = await client.extract([url], {
      extractDepth: "advanced",
      format: "markdown",
    });

    if (!response.results || response.results.length === 0) return null;

    const item = response.results[0];
    const rawContent = item.raw_content || "";
    if (!rawContent) return null;

    const sections: string[] = [];
    if (item.url) sections.push(`Source: ${item.url}`);
    sections.push("");
    sections.push(rawContent);

    return truncateText(sections.join("\n"), maxChars);
  } catch {
    return null;
  }
}

// ── Main execute ───────────────────────────────────────────

async function execute(params: Record<string, any>): Promise<string> {
  const url = params.url as string;
  const maxChars = (params.max_chars as number) || 50000;
  const includeMetadata = (params.extract_metadata as boolean) ?? true;
  const jsRender = (params.js_render as boolean) || false;
  const fetchProvider = ((process.env.FETCH_PROVIDER as FetchProvider) || "readability");

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `Invalid URL: must start with http:// or https://`;
  }

  // X/Twitter special handling
  if (isXUrl(url)) {
    const tweetContent = await fetchXTweet(url);
    if (tweetContent) return truncateText(tweetContent, maxChars);
    // Fall through to normal fetch if GetXAPI not available
  }

  // Tavily Extract: use when FETCH_PROVIDER=tavily
  if (fetchProvider === "tavily") {
    const tavilyResult = await fetchViaTavily(url, maxChars);
    if (tavilyResult) return tavilyResult;
    // Fall through to Readability if Tavily fails
  }

  // Normal fetch
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HidrixTools/2.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(30_000),
    redirect: "follow",
  });

  if (!response.ok) {
    // JS-rendered fallback
    if (jsRender) {
      const apifyResult = await fetchViaApify(url, maxChars);
      if (apifyResult) return truncateText(apifyResult, maxChars);
    }
    return `Fetch error: ${response.status} ${response.statusText} for ${url}`;
  }

  const contentType = response.headers.get("content-type") || "";
  const contentLength = Number(response.headers.get("content-length") || "0");

  if (contentLength > MAX_RESPONSE_BYTES) {
    return `Response too large: ${contentLength} bytes (max ${MAX_RESPONSE_BYTES})`;
  }

  const html = await response.text();

  if (!contentType.includes("html") && !contentType.includes("xml")) {
    return truncateText(html, maxChars);
  }

  if (html.length > MAX_RESPONSE_BYTES) return `HTML too large: ${html.length} chars`;

  const result = await extractContent(html, url);

  // If Readability yields very little content, try Tavily before Apify
  if (result.content.length < 200 && fetchProvider !== "tavily" && process.env.TAVILY_API_KEY) {
    const tavilyResult = await fetchViaTavily(url, maxChars);
    if (tavilyResult) return tavilyResult;
  }

  // Build header with metadata
  const sections: string[] = [];

  if (result.title) sections.push(`# ${result.title}`);

  if (includeMetadata) {
    const meta = extractMetadata(html);
    const metaParts: string[] = [];
    if (meta.author) metaParts.push(`Author: ${meta.author}`);
    if (meta.date) metaParts.push(`Date: ${meta.date}`);
    if (meta.siteName) metaParts.push(`Site: ${meta.siteName}`);
    const readingTime = estimateReadingTime(result.content);
    metaParts.push(`Reading time: ${readingTime}`);

    if (metaParts.length > 0) sections.push(metaParts.join(" | "));
    if (meta.tags?.length) sections.push(`Tags: ${meta.tags.join(", ")}`);
    if (meta.description) sections.push(`> ${meta.description}`);
  }

  sections.push(`Source: ${result.url}`);
  sections.push("");
  sections.push(result.content);

  return truncateText(sections.join("\n"), maxChars);
}

export const definition: ToolDefinition = {
  name: "web_fetch",
  description: [
    "Fetch a URL and extract readable content as markdown.",
    "Extracts metadata (author, date, tags, reading time).",
    "Handles X/Twitter URLs specially (shows tweet with engagement).",
    "Optional Tavily Extract for JS-heavy pages (set FETCH_PROVIDER=tavily).",
    "Optional JS rendering for SPA/paywalled pages (requires APIFY_API_TOKEN).",
  ].join(" "),
  params: {
    url: z.string().url().describe("URL to fetch (http or https)"),
    max_chars: z.number().min(100).max(100000).default(50000).describe("Max characters to return"),
    extract_metadata: z.boolean().default(true).describe("Extract author, date, tags, reading time"),
    js_render: z.boolean().default(false).describe("Use headless browser for JS-rendered pages (requires APIFY_API_TOKEN)"),
  },
  execute,
};
