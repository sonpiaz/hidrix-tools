/**
 * HTML to markdown extraction. Ported from hidrix-ai web-fetch-utils.ts.
 * Zero internal dependencies — only needs @mozilla/readability + linkedom.
 */

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const MAX_HTML_CHARS = 1_000_000;

// Invisible Unicode used in prompt injection attacks
const INVISIBLE_UNICODE_RE =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u206A-\u206F\uFEFF\u{E0000}-\u{E007F}]/gu;

function stripInvisibleUnicode(text: string): string {
  return text.replace(INVISIBLE_UNICODE_RE, "");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/gi, (_, dec) => String.fromCharCode(Number.parseInt(dec, 10)));
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ""));
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function sanitizeHtml(html: string): string {
  let sanitized = html.replace(/<!--[\s\S]*?-->/g, "");
  // Remove dangerous tags
  sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, "");
  sanitized = sanitized.replace(/<style[\s\S]*?<\/style>/gi, "");
  sanitized = sanitized.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  sanitized = sanitized.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  sanitized = sanitized.replace(/<form[\s\S]*?<\/form>/gi, "");
  return sanitized;
}

function htmlToMarkdown(html: string): { text: string; title?: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? normalizeWhitespace(stripTags(titleMatch[1])) : undefined;

  let text = sanitizeHtml(html);

  // Convert links
  text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, body) => {
    const label = normalizeWhitespace(stripTags(body));
    return label ? `[${label}](${href})` : href;
  });

  // Convert headings
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => {
    const prefix = "#".repeat(Math.max(1, Math.min(6, Number.parseInt(level, 10))));
    return `\n${prefix} ${normalizeWhitespace(stripTags(body))}\n`;
  });

  // Convert list items
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, body) => {
    const label = normalizeWhitespace(stripTags(body));
    return label ? `\n- ${label}` : "";
  });

  // Convert line breaks and block elements
  text = text
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|table|tr|ul|ol)>/gi, "\n");

  text = stripTags(text);
  text = normalizeWhitespace(text);
  return { text, title };
}

export interface ExtractResult {
  title?: string;
  content: string;
  url: string;
}

export async function extractContent(html: string, url: string): Promise<ExtractResult> {
  if (html.length > MAX_HTML_CHARS) {
    // Fallback to basic extraction for huge pages
    const { text, title } = htmlToMarkdown(html);
    return { title, content: stripInvisibleUnicode(text), url };
  }

  try {
    const { document } = parseHTML(sanitizeHtml(html));
    try {
      (document as { baseURI?: string }).baseURI = url;
    } catch {}

    const reader = new Readability(document, { charThreshold: 0 });
    const parsed = reader.parse();

    if (parsed?.content) {
      const { text, title: mdTitle } = htmlToMarkdown(parsed.content);
      return {
        title: parsed.title || mdTitle,
        content: stripInvisibleUnicode(text),
        url,
      };
    }
  } catch {}

  // Fallback to basic extraction
  const { text, title } = htmlToMarkdown(html);
  return { title, content: stripInvisibleUnicode(text), url };
}

export function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars) + "\n\n[Content truncated]";
}
