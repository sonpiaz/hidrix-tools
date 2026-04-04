/**
 * youtube_transcript — Extract transcript from YouTube videos.
 *
 * Turns any video into readable text. Essential for knowledge building.
 *
 * Provider priority:
 *   1. TranscriptAPI (TRANSCRIPT_API_KEY) — reliable, $5/mo
 *   2. Free Python lib youtube-transcript-api — no key needed, less reliable
 *   3. Error with setup instructions
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";

function extractVideoId(input: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  throw new Error(`Cannot extract video ID from: ${input}`);
}

function estimateReadingTime(text: string): string {
  const words = text.split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 250));
  return `${minutes} min read (${words} words)`;
}

async function execute(params: Record<string, any>): Promise<string> {
  const videoId = extractVideoId(params.video as string);
  const includeTimestamps = (params.timestamps as boolean) ?? false;

  // Provider 1: TranscriptAPI
  if (process.env.TRANSCRIPT_API_KEY) {
    try {
      const { transcriptApiGet } = await import("../../lib/transcript-api.js");
      const data = await transcriptApiGet("/youtube/transcript", {
        video_url: videoId,
        format: "json",
        include_timestamp: includeTimestamps ? "true" : "false",
        send_metadata: "true",
      });

      const title = data.metadata?.title || data.video_title || "Untitled";
      const author = data.metadata?.author_name || "";
      const segments = data.transcript || [];

      let text: string;
      if (Array.isArray(segments)) {
        text = segments.map((s: any) => {
          if (includeTimestamps && s.start !== undefined) {
            const mins = Math.floor(s.start / 60);
            const secs = Math.floor(s.start % 60);
            return `[${mins}:${secs.toString().padStart(2, "0")}] ${s.text}`;
          }
          return s.text;
        }).join("\n");
      } else if (typeof data.transcript === "string") {
        text = data.transcript;
      } else {
        text = JSON.stringify(data);
      }

      const sections: string[] = [];
      sections.push(`# ${title}`);
      if (author) sections.push(`Channel: ${author}`);
      sections.push(`Video: https://youtube.com/watch?v=${videoId}`);
      sections.push(`Reading time: ${estimateReadingTime(text)}`);
      sections.push("");
      sections.push(text);

      return sections.join("\n");
    } catch (e: any) {
      // Fall through to free lib
    }
  }

  // Provider 2: Free Python lib
  try {
    const { transcriptViaFreeLib } = await import("../../lib/transcript-api.js");
    const text = await transcriptViaFreeLib(videoId);
    if (text) {
      return [
        `# YouTube Transcript`,
        `Video: https://youtube.com/watch?v=${videoId}`,
        `Reading time: ${estimateReadingTime(text)}`,
        `_Source: youtube-transcript-api (free)_`,
        "",
        text,
      ].join("\n");
    }
  } catch {}

  return [
    "⚠️ Could not extract transcript.",
    "",
    "**Option 1 (recommended):** Set TRANSCRIPT_API_KEY — 100 free credits",
    "  Get key at: https://transcriptapi.com/signup",
    "",
    "**Option 2 (free):** Install youtube-transcript-api:",
    "  pip install youtube-transcript-api",
  ].join("\n");
}

export const definition: ToolDefinition = {
  name: "youtube_transcript",
  description: [
    "Extract transcript from any YouTube video — turns video into readable text.",
    "Essential for learning from videos without watching them.",
    "Supports timestamps. Works with TranscriptAPI or free Python lib.",
  ].join(" "),
  params: {
    video: z.string().describe("YouTube video URL or video ID"),
    timestamps: z.boolean().default(false).describe("Include timestamps in transcript"),
  },
  // No envVars — auto-detects TranscriptAPI or free lib
  execute,
};
