# hidrix-tools Roadmap

## Phase 0 — README & Documentation

### Mục tiêu
Viết lại README và docs để bất kỳ ai (agent hoặc human) đều hiểu ngay hidrix-tools là gì, dùng cho gì, cài thế nào.

### README.md — viết lại hoàn toàn

**What**: hidrix-tools là MCP tool server — cung cấp khả năng search, scrape, analyze data từ internet cho bất kỳ AI agent nào hỗ trợ MCP protocol.

**Why**: AI agents (Claude, Codex, pi, OpenClaw, Hermes...) mặc định không có khả năng search web, đọc social media, hay scrape data. hidrix-tools bổ sung những khả năng đó qua chuẩn MCP — plug vào agent nào cũng được, không vendor lock-in.

**For whom**:

| Agent / Platform | Cách dùng | Tested |
|---|---|---|
| Claude Code / Claude Desktop | `~/.claude/settings.json` → mcpServers | ✅ |
| OpenClaw | `openclaw.json` → mcp_servers | ✅ Compatible |
| Hermes Agent | `~/.hermes/config.yaml` → mcp_servers | ✅ Compatible |
| Cursor | MCP settings | ✅ Compatible |
| pi (coding agent) | MCP config | ✅ |
| Codex CLI | MCP config | ✅ Compatible |
| Any MCP client | stdio transport | ✅ |

**Use cases thực tế**:

1. **Research agent** — "Tìm top 10 bài viết về AI trên Reddit tuần này, so sánh với X/Twitter, tóm tắt trend"
2. **Content pipeline** — "Scrape 20 FB groups về marketing VN, rank top 100 bài theo engagement, phân tích pattern"
3. **Competitive intel** — "Xem đối thủ đang chạy quảng cáo gì trên Facebook, với budget bao nhiêu"
4. **Market research** — "Tìm hiểu sentiment về sản phẩm X trên Reddit + X + YouTube"
5. **Lead research** — "Tìm LinkedIn posts về AI tools, identify active thought leaders"
6. **Content creation** — "Đọc 5 bài article dài nhất trên X tuần này về topic Y, tổng hợp insights"

**Architecture diagram**:

```
┌─────────────────────────────────────────────┐
│         Any MCP-compatible Agent             │
│  (Claude, OpenClaw, Hermes, Cursor, pi...)  │
└──────────────────┬──────────────────────────┘
                   │ MCP protocol (stdio)
                   ▼
┌─────────────────────────────────────────────┐
│            hidrix-tools MCP server           │
│                                              │
│  ┌─── Search ───┐  ┌─── Scrape ───┐        │
│  │ web_search   │  │ facebook_    │        │
│  │ x_search     │  │   scraper    │        │
│  │ reddit_search│  │ web_fetch    │        │
│  │ youtube_     │  └──────────────┘        │
│  │   search     │                           │
│  │ tiktok_      │  ┌─── Analyze ──┐        │
│  │   search     │  │ content_     │        │
│  └──────────────┘  │   scorer     │        │
│                     │ content_     │        │
│  ┌─── Intel ────┐  │   analyzer   │        │
│  │ similarweb   │  └──────────────┘        │
│  └──────────────┘                           │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────┼──────────┬──────────┐
    ▼          ▼          ▼          ▼
  Brave     RapidAPI    Apify    Meta API
  Search    (X,Reddit,  (FB      (Ad Library
            YT,TikTok)  scrape)   free)
```

### Files

| File | Action |
|---|---|
| `README.md` | Viết lại hoàn toàn |
| `docs/architecture.md` | Mới — architecture + provider abstraction |
| `docs/compatibility.md` | Mới — setup guide per agent platform |

### Effort: ~1h

---

## Phase 1 — X/Twitter upgrade

### Vấn đề hiện tại

`x_search` chỉ có:
- 1 param: `query`
- 10 results hardcoded
- Chỉ trả text + username + date
- Không có: engagement (likes, retweets, replies, views)
- Không có: time filter, sort options
- Không đọc được thread dài (chỉ thấy tweet đầu)
- Không lấy được posts từ 1 user cụ thể

### Cần làm

#### 1.1 Upgrade `x_search`

```typescript
// Hiện tại
params: { query: string }

// Sau upgrade
params: {
  query: string,
  sort: "Top" | "Latest" | "People" | "Media",  // NEW
  count: number (1-50),                           // NEW (hiện hardcode 10)
  time_filter: "all" | "day" | "week" | "month",  // NEW — nếu RapidAPI hỗ trợ
}

// Output hiện tại
"1. @user (date)\n   text"

// Output sau upgrade  
"1. @user (date) | ❤️ 1.2K 🔄 340 💬 89 👁️ 45K\n   text (full, not truncated)"
```

**Cần check**: RapidAPI X Search API có trả engagement data không? Nếu không → tìm API khác hoặc Apify actor.

#### 1.2 New tool: `x_thread_reader`

**Vấn đề**: Nhiều content hay trên X nằm trong threads (chuỗi tweets) hoặc long-form articles. Agent không đọc được vì `x_search` chỉ trả tweet đầu tiên.

```typescript
// Input
params: {
  tweet_url: string,  // URL của tweet đầu thread
  // hoặc
  tweet_id: string,
}

// Output
"## Thread by @user (12 tweets)\n\n1/12: first tweet...\n2/12: second tweet...\n..."
```

**Provider options**:
- RapidAPI: tìm API có thread unroll
- Apify: `apify/twitter-thread-scraper`
- Fallback: `web_fetch` trên threadreaderapp.com/thread/{id}

#### 1.3 New tool: `x_user_posts`

**Vấn đề**: Agent muốn xem "user X viết gì gần đây" nhưng không có cách lấy.

```typescript
params: {
  username: string,        // @username
  count: number (1-50),
  include_replies: boolean, // default false
}

// Output: list of user's recent posts with engagement
```

### Files thay đổi

| File | Action |
|---|---|
| `tools/x-search/index.ts` | Upgrade: thêm params, engagement data |
| `tools/x-thread-reader/index.ts` | Mới |
| `tools/x-user-posts/index.ts` | Mới |

### Effort: ~2-3h (phụ thuộc RapidAPI capabilities)

---

## Phase 2 — Reddit upgrade

### Vấn đề hiện tại

`reddit_search` chỉ có:
- Text bị cắt 200 chars (`post.selftext.slice(0, 200)`)
- 10 results hardcoded
- Không đọc được full post + comments
- Không lấy được top posts từ 1 subreddit cụ thể
- Không có media/link extraction

### Cần làm

#### 2.1 Upgrade `reddit_search`

```typescript
// Hiện tại
output: "1. r/sub | 42 pts | 5 comments\n   **Title**\n   text (200 chars)..."

// Sau upgrade
output: "1. r/sub | 42 pts | 5 comments | 🏆 92% upvoted\n   **Title**\n   text (full, up to 2000 chars)\n   Top comment: ..."

// Thêm params
params: {
  query: string,
  sort: "RELEVANCE" | "HOT" | "TOP" | "NEW" | "COMMENTS",
  time: "all" | "year" | "month" | "week" | "day" | "hour",
  count: number (1-50),           // NEW
  subreddit: string (optional),   // NEW — limit to 1 subreddit
  include_top_comment: boolean,   // NEW
}
```

#### 2.2 New tool: `reddit_thread_reader`

**Vấn đề**: Nhiều subreddit có discussion threads rất dài và giá trị (AskReddit, ExperiencedDevs, etc). Agent cần đọc full thread + comment tree.

```typescript
params: {
  post_url: string,           // reddit post URL
  max_comments: number (1-100),
  sort: "best" | "top" | "new" | "controversial",
}

// Output: full post + comment tree formatted as markdown
"## [Title] (r/subreddit, 1.2K pts)\n\nFull post text...\n\n### Top Comments\n\n1. u/user1 (234 pts): comment text...\n   └─ u/user2 (45 pts): reply...\n2. ..."
```

**Provider**: RapidAPI Reddit API hoặc Reddit JSON API (`{url}.json`)

#### 2.3 New tool: `reddit_subreddit_top`

```typescript
params: {
  subreddit: string,          // e.g. "MachineLearning"
  time: "day" | "week" | "month" | "year" | "all",
  count: number (1-50),
}

// Output: top posts from subreddit with engagement
```

### Files thay đổi

| File | Action |
|---|---|
| `tools/reddit-search/index.ts` | Upgrade: count, subreddit filter, full text |
| `tools/reddit-thread-reader/index.ts` | Mới |
| `tools/reddit-subreddit-top/index.ts` | Mới |

### Effort: ~2-3h

---

## Phase 3 — LinkedIn

### Hiện tại: Không có tool nào

### Khó khăn

LinkedIn chặn scraping rất mạnh. Không có official API cho content search. Options:
- **RapidAPI**: Có vài LinkedIn scraper APIs
- **Apify**: Có LinkedIn actors (cần proxy)
- **Proxycurl**: Paid API cho profile data ($0.01/request)
- **Google dorking**: `site:linkedin.com/posts "keyword"` qua web_search

### Cần làm

#### 3.1 New tool: `linkedin_search`

```typescript
params: {
  query: string,
  type: "posts" | "people" | "companies",
  count: number (1-20),
}

// Output: LinkedIn posts/profiles matching query
```

**Provider priority**: 
1. RapidAPI LinkedIn API (nếu có + ổn định)
2. Apify LinkedIn actor
3. Fallback: `web_search` với `site:linkedin.com` filter

#### 3.2 New tool: `linkedin_profile`

```typescript
params: {
  url: string,  // linkedin.com/in/username hoặc linkedin.com/company/name
}

// Output: profile summary, recent posts, engagement
```

**Provider**: Proxycurl hoặc RapidAPI

### Files

| File | Action |
|---|---|
| `tools/linkedin-search/index.ts` | Mới |
| `tools/linkedin-profile/index.ts` | Mới |
| `lib/proxycurl.ts` | Mới (nếu dùng Proxycurl) |

### Effort: ~3-4h (phụ thuộc provider availability)

---

## Phase 4 — web_fetch upgrade

### Vấn đề hiện tại

- Không extract metadata (author, date, tags)
- Không handle JS-rendered pages (SPA, paywalled sites)
- Không batch fetch
- X articles (x.com long posts) có thể không render đúng

### Cần làm

#### 4.1 Upgrade `web_fetch`

```typescript
// Thêm output
"# Article Title\n"
"Author: Name | Date: 2026-04-01 | Reading time: 5 min\n"
"Tags: ai, startup\n"
"---\n"
"Article content..."

// Thêm params
params: {
  url: string,
  maxChars: number,
  extract_metadata: boolean,  // NEW
  js_render: boolean,         // NEW — use Apify web scraper for JS pages
}
```

#### 4.2 New tool: `web_fetch_batch`

```typescript
params: {
  urls: string,  // comma-separated URLs
  maxChars: number,
  summary_only: boolean,  // chỉ trả title + first 500 chars mỗi URL
}

// Output: multiple articles concatenated
```

#### 4.3 X/Twitter article reader

X long-form posts (Spaces transcripts, long tweets, articles) cần xử lý đặc biệt:
- `x.com/{user}/status/{id}` → cần expand full text
- Có thể dùng `web_fetch` + special parser cho x.com domain
- Hoặc tích hợp vào `x_thread_reader` (Phase 1)

### Files

| File | Action |
|---|---|
| `tools/web-fetch/index.ts` | Upgrade: metadata, JS render fallback |
| `tools/web-fetch-batch/index.ts` | Mới |

### Effort: ~2h

---

## Phase 5 — Extension layer

### Khi nào cần

- OpenClaw hay Hermes agent muốn **auto-schedule** scraping (weekly, daily)
- Cần **persistent storage** để cache results và track changes
- Cần **realtime monitoring** (alert khi competitor post, trend mới)
- Cần **cross-session data** (agent session A scrape → agent session B analyze)

### Tools hiện tại KHÔNG cần extension

Tất cả tools hiện tại đều stateless — agent gọi, trả kết quả, xong. Đây là design đúng cho MCP tools.

### Extension cần khi có use case sau

| Use case | Tại sao cần extension |
|---|---|
| Weekly auto-scrape 20 FB groups → save to DB | Cần cron + storage |
| Monitor competitor: alert khi có bài mới | Cần long-running process + webhook |
| Build knowledge base từ scraped data | Cần vector DB + indexing |
| Cross-agent data sharing | Cần persistent storage layer |

### Nếu build extension layer

```
hidrix-tools/
├── tools/          ← MCP tools (stateless, hiện tại)
├── extensions/     ← Extensions (stateful, long-running)
│   ├── scheduler/        ← Cron scheduler
│   │   └── index.ts
│   ├── storage/          ← SQLite persistent storage
│   │   └── index.ts
│   └── monitor/          ← Content monitoring + alerts
│       └── index.ts
├── lib/
│   ├── extension-registry.ts  ← Extension lifecycle (init/run/shutdown)
│   └── storage.ts             ← SQLite wrapper
```

### Compatibility với OpenClaw / Hermes

| Platform | Dùng tools | Dùng extensions |
|---|---|---|
| OpenClaw | ✅ Qua MCP | ✅ Có thể wrap thành OpenClaw skill/extension |
| Hermes | ✅ Qua MCP | ✅ Có thể wrap thành Hermes plugin |
| Claude Code | ✅ Qua MCP | ❌ Không có extension system |
| Cursor | ✅ Qua MCP | ❌ Không có extension system |

**Kết luận**: Extension layer chỉ build khi có user thực sự cần auto-schedule hoặc monitoring. Hiện tại tools là đủ.

### Effort: ~5-8h (nếu cần)

---

## Priority & Timeline

| Phase | Effort | Impact | Priority |
|---|---|---|---|
| Phase 0 — README & Docs | ~1h | 🟢 High — first impression, adoption | **P0 — làm ngay** |
| Phase 1 — X/Twitter upgrade | ~2-3h | 🟢 High — X là source quan trọng nhất | **P1** |
| Phase 2 — Reddit upgrade | ~2-3h | 🟡 Medium — Reddit = deep discussions | **P2** |
| Phase 4 — web_fetch upgrade | ~2h | 🟡 Medium — hỗ trợ tất cả phases khác | **P2** (song song Phase 2) |
| Phase 3 — LinkedIn | ~3-4h | 🟡 Medium — khó vì LinkedIn chặn | **P3** |
| Phase 5 — Extensions | ~5-8h | 🔵 Low now — chỉ khi có demand | **P4 — later** |

**Total nếu làm hết Phase 0-4: ~10-13h**

---

## Checklist mỗi phase

- [ ] Research provider API capabilities (RapidAPI, Apify, official API)
- [ ] Build tool(s)
- [ ] Test với real data
- [ ] Update README tools table
- [ ] Update `.env.example`
- [ ] Update `docs/known-issues.md` nếu có quirks
- [ ] Commit + PR
