/**
 * Fetch a URL and extract readable content as markdown.
 * Uses Mozilla Readability for article extraction.
 */

import { extractContent, truncateText } from "../lib/readability.js";

const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_CHARS = 50_000;

export async function webFetch(
  url: string,
  maxChars: number = MAX_CHARS,
): Promise<string> {
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

  // Handle non-HTML content
  if (!contentType.includes("html") && !contentType.includes("xml")) {
    const text = await response.text();
    return truncateText(text, maxChars);
  }

  const html = await response.text();
  if (html.length > MAX_RESPONSE_BYTES) {
    return `HTML too large: ${html.length} chars`;
  }

  const result = await extractContent(html, url);

  const header = result.title ? `# ${result.title}\nSource: ${result.url}\n\n` : `Source: ${result.url}\n\n`;
  return truncateText(header + result.content, maxChars);
}
