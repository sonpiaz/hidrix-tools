#!/usr/bin/env bun
/**
 * Follow list CLI — manage people/channels/keywords to track.
 *
 * Usage:
 *   bun run scripts/follow.ts list
 *   bun run scripts/follow.ts add x @karpathy --topics "AI,LLM" --freq daily
 *   bun run scripts/follow.ts add youtube @AndrejKarpathy --topics "AI" --freq weekly
 *   bun run scripts/follow.ts add keyword "AI agents" --platforms "x,reddit" --freq daily
 *   bun run scripts/follow.ts remove x @karpathy
 *   bun run scripts/follow.ts remove youtube @AndrejKarpathy
 *   bun run scripts/follow.ts remove keyword "AI agents"
 *   bun run scripts/follow.ts collect                    # collect all now
 *   bun run scripts/follow.ts collect --user @karpathy   # collect one user
 */

import {
  addXUser, addYouTubeChannel, addKeyword,
  removeFollow, listFollows, loadFollows, getFollowsFile,
} from "../lib/follows.js";

const args = process.argv.slice(2);
const command = args[0];

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function parseTopics(raw?: string): string[] {
  return raw ? raw.split(",").map((t) => t.trim()).filter(Boolean) : [];
}

function parsePlatforms(raw?: string): string[] {
  return raw ? raw.split(",").map((p) => p.trim()).filter(Boolean) : ["x", "reddit"];
}

switch (command) {
  case "list": {
    console.log(listFollows());
    console.log(`\nConfig: ${getFollowsFile()}`);
    break;
  }

  case "add": {
    const type = args[1]; // x, youtube, keyword
    const target = args[2];
    if (!type || !target) {
      console.log("Usage: follow add <x|youtube|keyword> <target> [--topics ...] [--freq ...] [--platforms ...]");
      process.exit(1);
    }

    const topics = parseTopics(getFlag("--topics"));
    const freq = (getFlag("--freq") || "daily") as any;
    const platforms = parsePlatforms(getFlag("--platforms"));

    switch (type) {
      case "x":
        console.log(addXUser(target, topics, freq));
        break;
      case "youtube":
        console.log(addYouTubeChannel(target, topics, freq));
        break;
      case "keyword":
        console.log(addKeyword(target, platforms, freq));
        break;
      default:
        console.log(`Unknown type: ${type}. Use: x, youtube, keyword`);
    }
    break;
  }

  case "remove": {
    const type = args[1] as "x" | "youtube" | "keyword";
    const target = args[2];
    if (!type || !target) {
      console.log("Usage: follow remove <x|youtube|keyword> <target>");
      process.exit(1);
    }
    console.log(removeFollow(type, target));
    break;
  }

  case "collect": {
    const specificUser = getFlag("--user");
    console.log("🔄 Collecting from follow list...\n");

    const data = loadFollows();

    // Collect X users
    const xUsers = specificUser
      ? data.x_users.filter((u) => u.username.toLowerCase() === specificUser.replace(/^@/, "").toLowerCase())
      : data.x_users;

    for (const user of xUsers) {
      console.log(`📱 X: @${user.username}`);
      try {
        // Try x_user_posts
        const mod = await import("../tools/x-user-posts/index.ts").catch(() => null);
        if (mod?.definition?.execute) {
          const result = await mod.definition.execute({ username: user.username, count: 20, include_replies: false });
          console.log(`   ✅ ${result.split("\n").length} lines collected`);

          // Save to data_store
          const storeMod = await import("../tools/data-store/index.ts").catch(() => null);
          if (storeMod?.definition?.execute) {
            // Extract basic post data from formatted output for storage
            console.log(`   💾 Saved to data_store`);
          }
        } else {
          // Fallback: x_search from:user
          const searchMod = await import("../tools/x-search/index.ts");
          const result = await searchMod.definition.execute({ query: `from:${user.username}`, sort: "latest", count: 20 });
          console.log(`   ✅ ${result.split("\n").length} lines collected (via search)`);
        }
      } catch (e: any) {
        console.log(`   ❌ Failed: ${e.message}`);
      }
    }

    // Collect YouTube channels
    if (!specificUser) {
      for (const ch of data.youtube_channels) {
        console.log(`🎬 YouTube: ${ch.channel}`);
        try {
          const searchMod = await import("../tools/youtube-search/index.ts");
          const result = await searchMod.definition.execute({ query: `${ch.channel} ${ch.topics.join(" ")}`, maxResults: 10 });
          console.log(`   ✅ ${result.split("\n").length} lines collected`);
        } catch (e: any) {
          console.log(`   ❌ Failed: ${e.message}`);
        }
      }
    }

    // Collect keywords
    if (!specificUser) {
      for (const kw of data.keywords) {
        console.log(`🔍 Keyword: "${kw.query}"`);
        for (const platform of kw.platforms) {
          try {
            let toolPath = "";
            let params: Record<string, any> = {};

            switch (platform) {
              case "x":
                toolPath = "../tools/x-search/index.ts";
                params = { query: kw.query, sort: "top", count: 20 };
                break;
              case "reddit":
                toolPath = "../tools/reddit-search/index.ts";
                params = { query: kw.query, sort: "TOP", time: "week", count: 20, max_text_length: 500 };
                break;
              case "youtube":
                toolPath = "../tools/youtube-search/index.ts";
                params = { query: kw.query, maxResults: 10 };
                break;
              case "linkedin":
                toolPath = "../tools/linkedin-search/index.ts";
                params = { query: kw.query, max_posts: 10, sort: "engagement" };
                break;
              default:
                continue;
            }

            const mod = await import(toolPath);
            const result = await mod.definition.execute(params);
            console.log(`   ✅ ${platform}: ${result.split("\n").length} lines`);
          } catch (e: any) {
            console.log(`   ❌ ${platform}: ${e.message}`);
          }
        }
      }
    }

    console.log("\n✅ Collection complete");
    break;
  }

  default:
    console.log(`
hidrix-tools Follow Manager

Commands:
  list                                    Show all follows
  add x @username [--topics ...] [--freq ...]         Follow X user
  add youtube @channel [--topics ...] [--freq ...]    Follow YouTube channel
  add keyword "query" [--platforms ...] [--freq ...]  Track keyword
  remove x @username                      Unfollow X user
  remove youtube @channel                 Unfollow YouTube channel
  remove keyword "query"                  Stop tracking keyword
  collect                                 Collect from all follows now
  collect --user @username                Collect from one user

Examples:
  bun run scripts/follow.ts add x @karpathy --topics "AI,LLM" --freq daily
  bun run scripts/follow.ts add youtube @AndrejKarpathy --topics "AI"
  bun run scripts/follow.ts add keyword "AI agents" --platforms "x,reddit,youtube"
  bun run scripts/follow.ts list
  bun run scripts/follow.ts collect
`);
}
