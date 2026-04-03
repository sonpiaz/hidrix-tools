import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { extractContent, truncateText } from "../../lib/readability.js";

const MAX_RESPONSE_BYTES = 2_000_000;

async function execute({ url, maxChars }: { url: string; maxChars: number }): Promise<string> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `Invalid URL: must start with http:// or https://`;
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HidrixTools/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(30_000),
    redirect: "follow",
  });

  if (!response.ok) {
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
  const header = result.title ? `# ${result.title}\nSource: ${result.url}\n\n` : `Source: ${result.url}\n\n`;
  return truncateText(header + result.content, maxChars);
}

export const definition: ToolDefinition = {
  name: "web_fetch",
  description: "Fetch a URL and extract readable content as markdown. Uses Mozilla Readability.",
  params: {
    url: z.string().url().describe("URL to fetch (http or https)"),
    maxChars: z.number().min(100).max(100000).default(50000).describe("Max characters to return"),
  },
  execute,
};
