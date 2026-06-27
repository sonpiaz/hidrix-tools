/**
 * sofya_extract: Pull specific information from a web page with Sofya.
 *
 * Give a URL and a prompt describing what to extract (for example a pricing
 * table or contact details). Sofya fetches the page and uses AI to return
 * just what you asked for.
 *
 * Provider: Sofya (https://sofya.co)
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";
import { requireEnv } from "../../lib/rapidapi.js";

interface SofyaExtractResponse {
  content?: string;
  url?: string;
}

async function execute(params: Record<string, any>): Promise<string> {
  const url = params.url as string;
  const prompt = params.prompt as string;

  const apiKey = requireEnv("SOFYA_API_KEY");

  const response = await fetch("https://sofya.co/v1/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url, prompt }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    return `Sofya extract error: ${response.status} ${response.statusText}`;
  }

  const data = (await response.json()) as SofyaExtractResponse;
  const content = data.content?.trim();

  if (!content) return `No content extracted from: ${url}`;

  return content;
}

export const definition: ToolDefinition = {
  name: "sofya_extract",
  description:
    "Extract specific information from a web page with Sofya. Give a URL and a prompt describing what to pull out, such as pricing, contact details, or specifications.",
  params: {
    url: z.string().describe("The URL to extract from"),
    prompt: z.string().describe("What to extract, for example 'list all pricing tiers and their prices'"),
  },
  envVars: ["SOFYA_API_KEY"],
  execute,
};
