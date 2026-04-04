/**
 * youtube_channel — Browse YouTube channel videos + latest uploads.
 *
 * Provider priority:
 *   1. TranscriptAPI (channel/latest = FREE, channel/videos = 1 credit)
 *   2. RapidAPI YouTube API (fallback)
 */

import { z } from "zod";
import type { ToolDefinition } from "../../lib/tool-registry.js";

function formatNumber(n: number | string): string {
  const num = typeof n === "string" ? parseInt(n, 10) : n;
  if (isNaN(num)) return String(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

async function execute(params: Record<string, any>): Promise<string> {
  const channel = params.channel as string;
  const mode = (params.mode as string) || "latest";
  const limit = (params.limit as number) || 15;

  // Provider 1: TranscriptAPI
  if (process.env.TRANSCRIPT_API_KEY) {
    try {
      const { transcriptApiGet } = await import("../../lib/transcript-api.js");

      if (mode === "latest") {
        // FREE endpoint — no credits
        const data = await transcriptApiGet("/youtube/channel/latest", { channel });
        const videos = data.results || [];
        const channelInfo = data.channel || {};

        const sections: string[] = [];
        sections.push(`## ${channelInfo.title || channel} — Latest Videos\n`);

        videos.slice(0, limit).forEach((v: any, i: number) => {
          const views = v.viewCount ? `👁️${formatNumber(v.viewCount)}` : "";
          const published = v.published ? v.published.split("T")[0] : "";
          const url = `https://youtube.com/watch?v=${v.videoId}`;
          sections.push(`**${i + 1}.** ${views} ${v.title || "Untitled"}`);
          sections.push(`   📅 ${published} | 🔗 ${url}`);
        });

        return sections.join("\n");
      }

      if (mode === "search") {
        const query = params.query || "";
        const data = await transcriptApiGet("/youtube/channel/search", { channel, q: query, limit: String(limit) });
        const videos = data.results || [];

        const sections: string[] = [];
        sections.push(`## ${channel} — Search: "${query}" (${videos.length} results)\n`);

        videos.slice(0, limit).forEach((v: any, i: number) => {
          const views = v.viewCountText || "";
          const url = `https://youtube.com/watch?v=${v.videoId}`;
          sections.push(`**${i + 1}.** ${v.title || "Untitled"} ${views}`);
          sections.push(`   📅 ${v.publishedTimeText || ""} | 🔗 ${url}`);
        });

        return sections.join("\n");
      }

      if (mode === "all") {
        // Paginated — 1 credit per page
        const data = await transcriptApiGet("/youtube/channel/videos", { channel });
        const videos = data.results || [];
        const info = data.playlist_info || {};

        const sections: string[] = [];
        sections.push(`## ${info.ownerName || channel} — All Videos (${info.numVideos || "?"} total)\n`);

        videos.slice(0, limit).forEach((v: any, i: number) => {
          const views = v.viewCountText || "";
          const url = `https://youtube.com/watch?v=${v.videoId}`;
          sections.push(`**${i + 1}.** ${v.title || "Untitled"} ${views}`);
          sections.push(`   🔗 ${url}`);
        });

        if (data.has_more) {
          sections.push(`\n_Showing ${Math.min(videos.length, limit)} of ${info.numVideos || "many"}. Use mode="all" with pagination for more._`);
        }

        return sections.join("\n");
      }
    } catch (e: any) {
      // Fall through
    }
  }

  // Provider 2: Fallback to youtube_search with channel name
  try {
    const searchMod = await import("../youtube-search/index.ts");
    const result = await searchMod.definition.execute({ query: channel, maxResults: limit });
    return `## ${channel} (via search fallback)\n\n${result}`;
  } catch {
    return [
      "⚠️ Could not browse YouTube channel.",
      "",
      "**Option 1 (recommended):** Set TRANSCRIPT_API_KEY — channel/latest is FREE",
      "  Get key at: https://transcriptapi.com/signup",
      "",
      "**Option 2:** Set RAPIDAPI_KEY for YouTube search fallback",
    ].join("\n");
  }
}

export const definition: ToolDefinition = {
  name: "youtube_channel",
  description: [
    "Browse YouTube channel — latest videos, search within channel, or list all videos.",
    "Modes: latest (free, newest 15 uploads), search (find videos in channel by keyword), all (paginated full list).",
  ].join(" "),
  params: {
    channel: z.string().describe("YouTube channel (@handle, URL, or channel ID)"),
    mode: z.enum(["latest", "search", "all"]).default("latest").describe("latest (free), search, or all"),
    query: z.string().optional().describe("Search query within channel (for search mode)"),
    limit: z.number().min(1).max(100).default(15).describe("Max videos to return"),
  },
  // No hard envVars — auto-detects
  execute,
};
