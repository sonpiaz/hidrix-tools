/**
 * TranscriptAPI client — YouTube transcripts, channel browse, search.
 *
 * Docs: https://transcriptapi.com/docs/api
 * Pricing: $5/mo = 1000 credits. Free: 100 credits.
 * Free endpoints: channel/latest, channel/resolve
 *
 * Fallback: youtube-transcript-api Python lib (free, no key)
 */

const BASE_URL = "https://transcriptapi.com/api/v2";

export function requireTranscriptApiKey(): string {
  const key = process.env.TRANSCRIPT_API_KEY;
  if (!key) throw new Error("Missing TRANSCRIPT_API_KEY. Get one at https://transcriptapi.com/signup (100 free credits)");
  return key;
}

export async function transcriptApiGet(path: string, params: Record<string, string>): Promise<any> {
  const key = requireTranscriptApiKey();
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TranscriptAPI error (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json();
}

/**
 * Fallback: extract transcript using youtube-transcript-api Python lib.
 * Free, no API key needed. Requires Python3 + pip install youtube-transcript-api.
 */
export async function transcriptViaFreeLib(videoId: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["python3", "-c", `
import json
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    transcript = YouTubeTranscriptApi().fetch("${videoId}")
    texts = [s.text for s in transcript]
    print(json.dumps({"text": " ".join(texts), "segments": len(texts)}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`], { stdout: "pipe", stderr: "pipe" });

    const output = await new Response(proc.stdout).text();
    const result = JSON.parse(output.trim());
    if (result.error) return null;
    return result.text;
  } catch {
    return null;
  }
}
