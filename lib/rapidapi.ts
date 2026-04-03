/**
 * Shared RapidAPI client. Simplified from Affitor's API class.
 * Uses native fetch (Bun) instead of axios.
 */

export interface RapidApiConfig {
  baseUrl: string;
  host: string;
  apiKey: string;
}

export interface RapidApiResult {
  data: unknown;
  error?: string;
}

export async function rapidApiGet(
  config: RapidApiConfig,
  path: string,
  params: Record<string, string | number>,
): Promise<RapidApiResult> {
  const url = new URL(path, config.baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": config.host,
      "x-rapidapi-key": config.apiKey,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    return {
      data: null,
      error: `RapidAPI error: ${response.status} ${response.statusText}`,
    };
  }

  const data = await response.json();
  return { data };
}

export function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}. See .env.example`);
  }
  return value;
}
