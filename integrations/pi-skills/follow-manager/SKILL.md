---
name: follow-manager
description: Manage your follow list — add/remove X users, YouTube channels, keywords to track for knowledge building.
user-invocable: true
---

# Follow Manager

Manage the hidrix-tools follow list for automatic knowledge collection.

## When to use

- User says "follow @username on X" or "theo dõi @username"
- User says "add YouTube channel @channel"
- User says "track keyword 'AI agents'"
- User says "show follow list" or "danh sách follow"
- User says "unfollow @username" or "bỏ theo dõi"
- User says "collect from follows" or "thu thập dữ liệu"

## How it works

The follow list is stored at `~/.hidrix-tools/follows.json`. Use the CLI at `~/hidrix-tools/scripts/follow.ts` to manage it.

## Commands

### Add X user
```bash
bun run ~/hidrix-tools/scripts/follow.ts add x @USERNAME --topics "TOPIC1,TOPIC2" --freq daily
```

### Add YouTube channel
```bash
bun run ~/hidrix-tools/scripts/follow.ts add youtube @CHANNEL --topics "TOPIC1,TOPIC2" --freq weekly
```

### Track keyword
```bash
bun run ~/hidrix-tools/scripts/follow.ts add keyword "KEYWORD" --platforms "x,reddit,youtube" --freq daily
```

### List all follows
```bash
bun run ~/hidrix-tools/scripts/follow.ts list
```

### Remove follow
```bash
bun run ~/hidrix-tools/scripts/follow.ts remove x @USERNAME
bun run ~/hidrix-tools/scripts/follow.ts remove youtube @CHANNEL
bun run ~/hidrix-tools/scripts/follow.ts remove keyword "KEYWORD"
```

### Collect now
```bash
bun run ~/hidrix-tools/scripts/follow.ts collect
bun run ~/hidrix-tools/scripts/follow.ts collect --user @USERNAME
```

## Workflow

1. When user asks to follow someone, run the appropriate `add` command
2. Confirm what was added
3. If user asks to collect, run `collect`
4. Show summary of what was collected

## Frequency options
- `hourly` — for fast-moving topics
- `daily` — default for X users and keywords
- `weekly` — default for YouTube channels

## Platform options for keywords
- `x` — X/Twitter
- `reddit` — Reddit
- `youtube` — YouTube
- `linkedin` — LinkedIn

## Tips
- Khi user nói tiếng Việt "theo dõi", "bỏ theo dõi", "danh sách" → map sang follow/unfollow/list
- Default frequency: daily cho X, weekly cho YouTube
- Nếu user không nói topics, để trống cũng được
