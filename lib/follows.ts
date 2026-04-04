/**
 * Follow list manager — track people, channels, keywords to collect from.
 *
 * Storage: ~/.hidrix-tools/follows.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DATA_DIR = join(homedir(), ".hidrix-tools");
const FOLLOWS_FILE = join(DATA_DIR, "follows.json");

export interface XFollow {
  username: string;
  topics: string[];
  frequency: "hourly" | "daily" | "weekly";
  added_at: string;
}

export interface YouTubeFollow {
  channel: string;
  topics: string[];
  frequency: "daily" | "weekly";
  added_at: string;
}

export interface KeywordFollow {
  query: string;
  platforms: string[];
  frequency: "hourly" | "daily" | "weekly";
  added_at: string;
}

export interface FollowList {
  x_users: XFollow[];
  youtube_channels: YouTubeFollow[];
  keywords: KeywordFollow[];
}

const DEFAULT: FollowList = {
  x_users: [],
  youtube_channels: [],
  keywords: [],
};

export function loadFollows(): FollowList {
  if (!existsSync(FOLLOWS_FILE)) return { ...DEFAULT };
  try {
    return JSON.parse(readFileSync(FOLLOWS_FILE, "utf8"));
  } catch {
    return { ...DEFAULT };
  }
}

export function saveFollows(data: FollowList): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FOLLOWS_FILE, JSON.stringify(data, null, 2) + "\n");
}

export function addXUser(username: string, topics: string[] = [], frequency: "hourly" | "daily" | "weekly" = "daily"): string {
  const data = loadFollows();
  const clean = username.replace(/^@/, "").trim();
  if (data.x_users.some((u) => u.username.toLowerCase() === clean.toLowerCase())) {
    return `Already following @${clean} on X`;
  }
  data.x_users.push({ username: clean, topics, frequency, added_at: new Date().toISOString() });
  saveFollows(data);
  return `✅ Following @${clean} on X (${frequency})${topics.length ? ` — topics: ${topics.join(", ")}` : ""}`;
}

export function addYouTubeChannel(channel: string, topics: string[] = [], frequency: "daily" | "weekly" = "weekly"): string {
  const data = loadFollows();
  const clean = channel.startsWith("@") ? channel : `@${channel}`;
  if (data.youtube_channels.some((c) => c.channel.toLowerCase() === clean.toLowerCase())) {
    return `Already following ${clean} on YouTube`;
  }
  data.youtube_channels.push({ channel: clean, topics, frequency, added_at: new Date().toISOString() });
  saveFollows(data);
  return `✅ Following ${clean} on YouTube (${frequency})${topics.length ? ` — topics: ${topics.join(", ")}` : ""}`;
}

export function addKeyword(query: string, platforms: string[] = ["x", "reddit"], frequency: "hourly" | "daily" | "weekly" = "daily"): string {
  const data = loadFollows();
  if (data.keywords.some((k) => k.query.toLowerCase() === query.toLowerCase())) {
    return `Already tracking keyword: "${query}"`;
  }
  data.keywords.push({ query, platforms, frequency, added_at: new Date().toISOString() });
  saveFollows(data);
  return `✅ Tracking "${query}" on ${platforms.join(", ")} (${frequency})`;
}

export function removeFollow(type: "x" | "youtube" | "keyword", identifier: string): string {
  const data = loadFollows();
  const clean = identifier.replace(/^@/, "").trim();

  switch (type) {
    case "x": {
      const before = data.x_users.length;
      data.x_users = data.x_users.filter((u) => u.username.toLowerCase() !== clean.toLowerCase());
      if (data.x_users.length === before) return `Not following @${clean} on X`;
      saveFollows(data);
      return `✅ Unfollowed @${clean} on X`;
    }
    case "youtube": {
      const before = data.youtube_channels.length;
      const cleanCh = identifier.startsWith("@") ? identifier : `@${identifier}`;
      data.youtube_channels = data.youtube_channels.filter((c) => c.channel.toLowerCase() !== cleanCh.toLowerCase());
      if (data.youtube_channels.length === before) return `Not following ${cleanCh} on YouTube`;
      saveFollows(data);
      return `✅ Unfollowed ${cleanCh} on YouTube`;
    }
    case "keyword": {
      const before = data.keywords.length;
      data.keywords = data.keywords.filter((k) => k.query.toLowerCase() !== identifier.toLowerCase());
      if (data.keywords.length === before) return `Not tracking keyword: "${identifier}"`;
      saveFollows(data);
      return `✅ Stopped tracking "${identifier}"`;
    }
  }
}

export function listFollows(): string {
  const data = loadFollows();
  const sections: string[] = [];

  sections.push("## Follow List\n");

  if (data.x_users.length > 0) {
    sections.push(`### X/Twitter (${data.x_users.length})\n`);
    for (const u of data.x_users) {
      sections.push(`- **@${u.username}** (${u.frequency})${u.topics.length ? ` — ${u.topics.join(", ")}` : ""}`);
    }
    sections.push("");
  }

  if (data.youtube_channels.length > 0) {
    sections.push(`### YouTube (${data.youtube_channels.length})\n`);
    for (const c of data.youtube_channels) {
      sections.push(`- **${c.channel}** (${c.frequency})${c.topics.length ? ` — ${c.topics.join(", ")}` : ""}`);
    }
    sections.push("");
  }

  if (data.keywords.length > 0) {
    sections.push(`### Keywords (${data.keywords.length})\n`);
    for (const k of data.keywords) {
      sections.push(`- **"${k.query}"** on ${k.platforms.join(", ")} (${k.frequency})`);
    }
    sections.push("");
  }

  const total = data.x_users.length + data.youtube_channels.length + data.keywords.length;
  if (total === 0) sections.push("_Empty. Add with:_ `follow add x @username` or `follow add youtube @channel`");

  return sections.join("\n");
}

export function getFollowsFile(): string {
  return FOLLOWS_FILE;
}
